import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "fr";

type Dict = Record<string, string>;

const en: Dict = {
  // Nav
  "nav.dashboard": "Dashboard",
  "nav.incidents": "Incidents",
  "nav.ai": "AI Insights",
  "nav.infra": "Infrastructure",
  "nav.sla": "SLA & Reports",
  "nav.settings": "Settings",
  "nav.adminOnly": "Admin only",

  // Top bar
  "top.search": "Search anything…",
  "top.allOperational": "All systems operational",
  "top.notifications": "Notifications",
  "top.signOut": "Sign out",
  "top.profile": "Profile",
  "top.theme.dark": "Dark mode",
  "top.theme.light": "Light mode",

  // Common
  "common.role": "Role",
  "common.assignedServers": "Assigned services",
  "common.healthy": "Healthy",
  "common.warning": "Warning",
  "common.critical": "Critical",
  "common.status": "Status",
  "common.severity": "Severity",
  "common.date": "Date",
  "common.all": "All",
  "common.export": "Export",
  "common.acknowledge": "Acknowledge",
  "common.close": "Close",
  "common.open": "Open",
  "common.resolved": "Resolved",
  "common.acknowledged": "Acknowledged",
  "common.cpu": "CPU",
  "common.memory": "Memory",
  "common.disk": "Disk",
  "common.uptime": "Uptime",
  "common.region": "Region",
  "common.type": "Type",
  "common.actions": "Actions",
  "common.details": "Details",
  "common.save": "Save changes",
  "common.cancel": "Cancel",
  "common.language": "Language",

  // Dashboard
  "dash.title": "Dashboard",
  "dash.subtitle": "Operational overview of your assigned services",
  "dash.welcome": "Welcome back",
  "dash.yourScope": "Your scope",
  "dash.servicesHealthy": "Services healthy",
  "dash.openIncidents": "Open incidents",
  "dash.avgUptime": "Avg uptime",
  "dash.servers": "Your servers",
  "dash.recentIncidents": "Recent incidents",
  "dash.noIncidents": "No active incidents in your scope.",
  "dash.viewAll": "View all",
  "dash.cpuLoad": "CPU load — last 24h",
  "dash.memoryLoad": "Memory load — last 24h",

  // Incidents
  "inc.title": "Incidents",
  "inc.subtitle": "Incidents related to your assigned infrastructure",
  "inc.filterSeverity": "Severity",
  "inc.filterStatus": "Status",
  "inc.empty": "No incidents match your filters.",
  "inc.detailsTitle": "Incident details",
  "inc.acknowledged": "Incident acknowledged.",
  "inc.closed": "Incident closed.",
  "inc.notAllowed": "Your role does not allow this action.",

  // Infrastructure
  "infra.title": "Infrastructure",
  "infra.subtitle": "Servers and services assigned to you",
  "infra.expand": "Expand",
  "infra.collapse": "Collapse",
  "infra.noServers": "No servers assigned to your account.",

  // SLA
  "sla.title": "SLA & Reports",
  "sla.subtitle": "Service-level compliance and uptime reports",
  "sla.compliance": "SLA compliance",
  "sla.uptime": "Uptime per service",
  "sla.exportPdf": "Export PDF",
  "sla.exportCsv": "Export CSV",
  "sla.exported": "Report exported",

  // Settings
  "settings.title": "Settings",
  "settings.subtitle": "Manage your profile and preferences",
  "settings.profile": "Profile",
  "settings.notifications": "Notifications",
  "settings.appearance": "Appearance",
  "settings.system": "System configuration",
  "settings.systemRestricted": "System configuration is restricted to administrators.",
  "settings.emailAlerts": "Email alerts",
  "settings.slackAlerts": "Slack alerts",
  "settings.smsAlerts": "SMS alerts",
  "settings.theme": "Theme",
  "settings.changePwd": "Change password",
  "settings.currentPwd": "Current password",
  "settings.newPwd": "New password",
  "settings.confirmPwd": "Confirm new password",
  "settings.preferences": "Preferences",
  "settings.saved": "Settings saved",
};

const fr: Dict = {
  "nav.dashboard": "Tableau de bord",
  "nav.incidents": "Incidents",
  "nav.ai": "IA Insights",
  "nav.infra": "Infrastructure",
  "nav.sla": "SLA & Rapports",
  "nav.settings": "Paramètres",
  "nav.adminOnly": "Admin uniquement",

  "top.search": "Rechercher…",
  "top.allOperational": "Tous les systèmes opérationnels",
  "top.notifications": "Notifications",
  "top.signOut": "Se déconnecter",
  "top.profile": "Profil",
  "top.theme.dark": "Mode sombre",
  "top.theme.light": "Mode clair",

  "common.role": "Rôle",
  "common.assignedServers": "Services assignés",
  "common.healthy": "Sain",
  "common.warning": "Avertissement",
  "common.critical": "Critique",
  "common.status": "Statut",
  "common.severity": "Sévérité",
  "common.date": "Date",
  "common.all": "Tous",
  "common.export": "Exporter",
  "common.acknowledge": "Acquitter",
  "common.close": "Fermer",
  "common.open": "Ouvert",
  "common.resolved": "Résolu",
  "common.acknowledged": "Acquitté",
  "common.cpu": "CPU",
  "common.memory": "Mémoire",
  "common.disk": "Disque",
  "common.uptime": "Disponibilité",
  "common.region": "Région",
  "common.type": "Type",
  "common.actions": "Actions",
  "common.details": "Détails",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.language": "Langue",

  "dash.title": "Tableau de bord",
  "dash.subtitle": "Vue d'ensemble de vos services assignés",
  "dash.welcome": "Bon retour",
  "dash.yourScope": "Votre périmètre",
  "dash.servicesHealthy": "Services sains",
  "dash.openIncidents": "Incidents ouverts",
  "dash.avgUptime": "Disponibilité moy.",
  "dash.servers": "Vos serveurs",
  "dash.recentIncidents": "Incidents récents",
  "dash.noIncidents": "Aucun incident actif dans votre périmètre.",
  "dash.viewAll": "Voir tout",
  "dash.cpuLoad": "Charge CPU — dernières 24h",
  "dash.memoryLoad": "Charge mémoire — dernières 24h",

  "inc.title": "Incidents",
  "inc.subtitle": "Incidents liés à votre infrastructure",
  "inc.filterSeverity": "Sévérité",
  "inc.filterStatus": "Statut",
  "inc.empty": "Aucun incident ne correspond aux filtres.",
  "inc.detailsTitle": "Détails de l'incident",
  "inc.acknowledged": "Incident acquitté.",
  "inc.closed": "Incident fermé.",
  "inc.notAllowed": "Votre rôle ne permet pas cette action.",

  "infra.title": "Infrastructure",
  "infra.subtitle": "Serveurs et services qui vous sont assignés",
  "infra.expand": "Déplier",
  "infra.collapse": "Replier",
  "infra.noServers": "Aucun serveur n'est assigné à votre compte.",

  "sla.title": "SLA & Rapports",
  "sla.subtitle": "Conformité SLA et rapports de disponibilité",
  "sla.compliance": "Conformité SLA",
  "sla.uptime": "Disponibilité par service",
  "sla.exportPdf": "Exporter PDF",
  "sla.exportCsv": "Exporter CSV",
  "sla.exported": "Rapport exporté",

  "settings.title": "Paramètres",
  "settings.subtitle": "Gérez votre profil et vos préférences",
  "settings.profile": "Profil",
  "settings.notifications": "Notifications",
  "settings.appearance": "Apparence",
  "settings.system": "Configuration système",
  "settings.systemRestricted": "La configuration système est réservée aux administrateurs.",
  "settings.emailAlerts": "Alertes e-mail",
  "settings.slackAlerts": "Alertes Slack",
  "settings.smsAlerts": "Alertes SMS",
  "settings.theme": "Thème",
  "settings.changePwd": "Changer le mot de passe",
  "settings.currentPwd": "Mot de passe actuel",
  "settings.newPwd": "Nouveau mot de passe",
  "settings.confirmPwd": "Confirmer le nouveau",
  "settings.preferences": "Préférences",
  "settings.saved": "Paramètres enregistrés",
};

const dictionaries: Record<Lang, Dict> = { en, fr };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem("poulina-lang") as Lang | null;
    return stored === "fr" ? "fr" : "en";
  });

  useEffect(() => {
    localStorage.setItem("poulina-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => setLangState(l);
  const t = (key: string) => dictionaries[lang][key] ?? dictionaries.en[key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
