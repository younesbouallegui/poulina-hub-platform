export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          created_at: string
          hostname: string | null
          id: string
          ip_address: string | null
          name: string
          os: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          name: string
          os?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          name?: string
          os?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitoring_alerts: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          description: string | null
          external_id: string
          host_id: string | null
          id: string
          provider_id: string | null
          raw: Json | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          description?: string | null
          external_id: string
          host_id?: string | null
          id?: string
          provider_id?: string | null
          raw?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          description?: string | null
          external_id?: string
          host_id?: string | null
          id?: string
          provider_id?: string | null
          raw?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_alerts_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "monitoring_hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_alerts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "monitoring_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_hosts: {
        Row: {
          available: boolean | null
          created_at: string
          external_id: string
          hostname: string | null
          id: string
          ip_address: string | null
          name: string
          provider_id: string | null
          raw: Json | null
          status: string | null
          tags: Json | null
          updated_at: string
        }
        Insert: {
          available?: boolean | null
          created_at?: string
          external_id: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          name: string
          provider_id?: string | null
          raw?: Json | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          available?: boolean | null
          created_at?: string
          external_id?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          name?: string
          provider_id?: string | null
          raw?: Json | null
          status?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_hosts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "monitoring_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_providers: {
        Row: {
          config: Json
          created_at: string
          health_score: number | null
          id: string
          kind: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          secret_ref: string | null
          status: string
          sync_interval_minutes: number | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          health_score?: number | null
          id?: string
          kind: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          secret_ref?: string | null
          status?: string
          sync_interval_minutes?: number | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          health_score?: number | null
          id?: string
          kind?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          secret_ref?: string | null
          status?: string
          sync_interval_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      monitoring_sync_logs: {
        Row: {
          alerts_synced: number | null
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          hosts_synced: number | null
          id: string
          message: string | null
          metadata: Json | null
          provider_id: string | null
          records_ingested: number | null
          result: string | null
          started_at: string
          status: string
        }
        Insert: {
          alerts_synced?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          hosts_synced?: number | null
          id?: string
          message?: string | null
          metadata?: Json | null
          provider_id?: string | null
          records_ingested?: number | null
          result?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          alerts_synced?: number | null
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          hosts_synced?: number | null
          id?: string
          message?: string | null
          metadata?: Json | null
          provider_id?: string | null
          records_ingested?: number | null
          result?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_sync_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "monitoring_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "operator" | "auditor" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "operator", "auditor", "viewer"],
    },
  },
} as const
