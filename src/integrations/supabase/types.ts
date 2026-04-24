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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blocked_ips: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          ip: string
          notes: string | null
          reason: string
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip: string
          notes?: string | null
          reason?: string
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip?: string
          notes?: string | null
          reason?: string
        }
        Relationships: []
      }
      flyer_gallery: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string
          title: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          title: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          title?: string
        }
        Relationships: []
      }
      freelancers: {
        Row: {
          accepted_at: string | null
          available: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string | null
          hourly_rate: number | null
          id: string
          invited_at: string
          invited_by: string
          invited_email: string
          is_online: boolean
          last_seen: string | null
          specialty: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          available?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          invited_at?: string
          invited_by: string
          invited_email: string
          is_online?: boolean
          last_seen?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          available?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          invited_at?: string
          invited_by?: string
          invited_email?: string
          is_online?: boolean
          last_seen?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hired_users: {
        Row: {
          accepted_at: string | null
          email: string
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string
          role: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by: string
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string
          role?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_download_tokens: {
        Row: {
          created_at: string
          expires_at: string
          invoice_number: string
          order_id: string
          token: string
          used_count: number
        }
        Insert: {
          created_at?: string
          expires_at?: string
          invoice_number: string
          order_id: string
          token: string
          used_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          invoice_number?: string
          order_id?: string
          token?: string
          used_count?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          assigned_to: string | null
          attachment_kind: string | null
          attachment_url: string | null
          body: string | null
          conversation_user_id: string
          created_at: string
          id: string
          is_admin_sender: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_kind?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_user_id: string
          created_at?: string
          id?: string
          is_admin_sender?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          assigned_to?: string | null
          attachment_kind?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_user_id?: string
          created_at?: string
          id?: string
          is_admin_sender?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          assigned_to: string | null
          created_at: string | null
          currency: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          paid_at: string | null
          payment_entity: string | null
          payment_method: string | null
          payment_reference: string | null
          plan_id: string | null
          service_type: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_entity?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plan_id?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_entity?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          plan_id?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          image_url: string
          notes: string | null
          order_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          image_url: string
          notes?: string | null
          order_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          image_url?: string
          notes?: string | null
          order_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          tax_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          is_admin_device: boolean | null
          p256dh: string
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          is_admin_device?: boolean | null
          p256dh: string
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          is_admin_device?: boolean | null
          p256dh?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          created_at: string
          details: string | null
          id: string
          ip: string | null
          kind: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          ip?: string | null
          kind: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          ip?: string | null
          kind?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      service_plans: {
        Row: {
          active: boolean | null
          billing_cycle: string | null
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          highlighted: boolean | null
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          billing_cycle?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          highlighted?: boolean | null
          id?: string
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          billing_cycle?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          highlighted?: boolean | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          approved: boolean
          author_name: string
          created_at: string
          id: string
          message: string
          photo_url: string | null
          rating: number
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          author_name: string
          created_at?: string
          id?: string
          message: string
          photo_url?: string | null
          rating?: number
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          author_name?: string
          created_at?: string
          id?: string
          message?: string
          photo_url?: string | null
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      is_active_freelancer: { Args: { _user_id: string }; Returns: boolean }
      next_invoice_number: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "freelancer"
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
      app_role: ["admin", "user", "freelancer"],
    },
  },
} as const
