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
      identity_audit: {
        Row: {
          action: string
          actor_auth_user_id: string | null
          actor_username: string | null
          actor_zabbix_userid: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          metadata: Json | null
          source: string | null
          target_username: string | null
          target_zabbix_userid: string | null
        }
        Insert: {
          action: string
          actor_auth_user_id?: string | null
          actor_username?: string | null
          actor_zabbix_userid?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          target_username?: string | null
          target_zabbix_userid?: string | null
        }
        Update: {
          action?: string
          actor_auth_user_id?: string | null
          actor_username?: string | null
          actor_zabbix_userid?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          target_username?: string | null
          target_zabbix_userid?: string | null
        }
        Relationships: []
      }
      monitoring_alerts: {
        Row: {
          created_at: string
          description: string | null
          external_id: string
          host_id: string | null
          id: string
          provider_id: string | null
          raw: Json | null
          severity: string | null
          status: string | null
          title: string | null
          triggered_at: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id: string
          host_id?: string | null
          id?: string
          provider_id?: string | null
          raw?: Json | null
          severity?: string | null
          status?: string | null
          title?: string | null
          triggered_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string
          host_id?: string | null
          id?: string
          provider_id?: string | null
          raw?: Json | null
          severity?: string | null
          status?: string | null
          title?: string | null
          triggered_at?: string | null
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
      monitoring_host_groups: {
        Row: {
          created_at: string
          external_id: string
          id: string
          name: string
          provider_id: string | null
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          name: string
          provider_id?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          name?: string
          provider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_host_groups_provider_id_fkey"
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
          last_seen: string | null
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
          last_seen?: string | null
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
          last_seen?: string | null
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
          health_score: number
          id: string
          kind: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          secret_ref: string | null
          status: string
          sync_interval_minutes: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          health_score?: number
          id?: string
          kind: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          secret_ref?: string | null
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          health_score?: number
          id?: string
          kind?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          secret_ref?: string | null
          status?: string
          sync_interval_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      monitoring_sync_logs: {
        Row: {
          duration_ms: number | null
          finished_at: string | null
          id: string
          message: string | null
          provider_id: string | null
          records_ingested: number
          result: string
          started_at: string
        }
        Insert: {
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          message?: string | null
          provider_id?: string | null
          records_ingested?: number
          result?: string
          started_at?: string
        }
        Update: {
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          message?: string | null
          provider_id?: string | null
          records_ingested?: number
          result?: string
          started_at?: string
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
      provider_health: {
        Row: {
          health_score: number | null
          id: string
          latency_ms: number | null
          message: string | null
          provider_id: string | null
          recorded_at: string
          status: string | null
        }
        Insert: {
          health_score?: number | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          provider_id?: string | null
          recorded_at?: string
          status?: string | null
        }
        Update: {
          health_score?: number | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          provider_id?: string | null
          recorded_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_health_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "monitoring_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      zbx_role_map: {
        Row: {
          platform_role: Database["public"]["Enums"]["app_role"]
          role_type: number | null
          roleid: string | null
        }
        Insert: {
          platform_role: Database["public"]["Enums"]["app_role"]
          role_type?: number | null
          roleid?: string | null
        }
        Update: {
          platform_role?: Database["public"]["Enums"]["app_role"]
          role_type?: number | null
          roleid?: string | null
        }
        Relationships: []
      }
      zbx_roles: {
        Row: {
          last_synced_at: string
          name: string
          readonly: number | null
          roleid: string
          type: number
        }
        Insert: {
          last_synced_at?: string
          name: string
          readonly?: number | null
          roleid: string
          type: number
        }
        Update: {
          last_synced_at?: string
          name?: string
          readonly?: number | null
          roleid?: string
          type?: number
        }
        Relationships: []
      }
      zbx_user_group_members: {
        Row: {
          usrgrpid: string
          zabbix_userid: string
        }
        Insert: {
          usrgrpid: string
          zabbix_userid: string
        }
        Update: {
          usrgrpid?: string
          zabbix_userid?: string
        }
        Relationships: [
          {
            foreignKeyName: "zbx_user_group_members_usrgrpid_fkey"
            columns: ["usrgrpid"]
            isOneToOne: false
            referencedRelation: "zbx_user_groups"
            referencedColumns: ["usrgrpid"]
          },
          {
            foreignKeyName: "zbx_user_group_members_zabbix_userid_fkey"
            columns: ["zabbix_userid"]
            isOneToOne: false
            referencedRelation: "zbx_users"
            referencedColumns: ["zabbix_userid"]
          },
        ]
      }
      zbx_user_groups: {
        Row: {
          gui_access: number | null
          last_synced_at: string
          name: string
          users_status: number | null
          usrgrpid: string
        }
        Insert: {
          gui_access?: number | null
          last_synced_at?: string
          name: string
          users_status?: number | null
          usrgrpid: string
        }
        Update: {
          gui_access?: number | null
          last_synced_at?: string
          name?: string
          users_status?: number | null
          usrgrpid?: string
        }
        Relationships: []
      }
      zbx_users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          last_synced_at: string
          name: string | null
          roleid: string | null
          status: number | null
          surname: string | null
          type: number | null
          updated_at: string
          username: string
          zabbix_userid: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          last_synced_at?: string
          name?: string | null
          roleid?: string | null
          status?: number | null
          surname?: string | null
          type?: number | null
          updated_at?: string
          username: string
          zabbix_userid: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          last_synced_at?: string
          name?: string | null
          roleid?: string | null
          status?: number | null
          surname?: string | null
          type?: number | null
          updated_at?: string
          username?: string
          zabbix_userid?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_platform_roles: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
          username: string
          zabbix_userid: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "operator" | "viewer" | "auditor"
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
      app_role: ["super_admin", "admin", "operator", "viewer", "auditor"],
    },
  },
} as const
