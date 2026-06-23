// Shared SSO token helpers (HMAC-SHA256 compact JWS).
// IMPORTANT: This file is intentionally self-contained so it can be copied
// verbatim into the Poulina AI Knowledge Supabase project. The two platforms
// MUST run identical sign/verify code to interop.

export const SSO_VERSION = "sso-v1";
export const SSO_TTL_SECONDS = 60;

export type SsoIssuer = "hub" | "knowledge";

export interface SsoPayload {
  iss: SsoIssuer;
  aud: SsoIssuer;
  sub: string;          // zabbix userid
  username: string;     // zabbix username
  name: string;         // display name
  roles: string[];
  iat: number;          // seconds
  exp: number;          // seconds
  nonce: string;        // uuid
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64urlEncode = (bytes: Uint8Array): string => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const b64urlEncodeStr = (s: string) => b64urlEncode(enc.encode(s));
const b64urlDecode = (s: string): Uint8Array => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const importKey = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const constantTimeEq = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export async function signSsoToken(payload: SsoPayload, secret: string): Promise<string> {
  if (!secret) throw new Error("SSO_SHARED_SECRET is missing");
  const header = { alg: "HS256", typ: "SSO", ver: SSO_VERSION };
  const headerB64 = b64urlEncodeStr(JSON.stringify(header));
  const payloadB64 = b64urlEncodeStr(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await importKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(signingInput)));
  return `${signingInput}.${b64urlEncode(sig)}`;
}

export interface VerifyOptions {
  expectedAudience: SsoIssuer;
  expectedIssuer?: SsoIssuer;
  clockSkewSeconds?: number;
}

export async function verifySsoToken(
  token: string,
  secret: string,
  opts: VerifyOptions,
): Promise<SsoPayload> {
  if (!secret) throw new Error("SSO_SHARED_SECRET is missing");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed SSO token");
  const [headerB64, payloadB64, sigB64] = parts;
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlDecode(sigB64),
    enc.encode(`${headerB64}.${payloadB64}`),
  );
  // Use a second constant-time check on the raw bytes as belt-and-suspenders.
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${headerB64}.${payloadB64}`)),
  );
  if (!valid || !constantTimeEq(expectedSig, b64urlDecode(sigB64))) {
    throw new Error("SSO token signature is invalid");
  }
  const payload = JSON.parse(dec.decode(b64urlDecode(payloadB64))) as SsoPayload;
  const skew = opts.clockSkewSeconds ?? 5;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + skew < now) {
    throw new Error("SSO token has expired");
  }
  if (typeof payload.iat !== "number" || payload.iat - skew > now) {
    throw new Error("SSO token is not yet valid");
  }
  if (payload.aud !== opts.expectedAudience) {
    throw new Error(`SSO token audience mismatch (expected ${opts.expectedAudience}, got ${payload.aud})`);
  }
  if (opts.expectedIssuer && payload.iss !== opts.expectedIssuer) {
    throw new Error(`SSO token issuer mismatch (expected ${opts.expectedIssuer}, got ${payload.iss})`);
  }
  if (!payload.nonce || !payload.sub || !payload.username) {
    throw new Error("SSO token is missing required claims");
  }
  return payload;
}
