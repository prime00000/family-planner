export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      archive: {
        Row: {
          completed_at: string | null
          completed_by: string
          id: string
          plan_task_id: string
          task_data: Json
          team_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by: string
          id?: string
          plan_task_id: string
          task_data: Json
          team_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string
          id?: string
          plan_task_id?: string
          task_data?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      big_task_tags: {
        Row: {
          big_task_id: string
          tag_id: string
        }
        Insert: {
          big_task_id: string
          tag_id: string
        }
        Update: {
          big_task_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "big_task_tags_big_task_id_fkey"
            columns: ["big_task_id"]
            isOneToOne: false
            referencedRelation: "big_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "big_task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      big_tasks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          importance: number | null
          status: string | null
          submitted_by: string
          team_id: string
          title: string
          updated_at: string | null
          urgency: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by: string
          team_id: string
          title: string
          updated_at?: string | null
          urgency?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by?: string
          team_id?: string
          title?: string
          updated_at?: string | null
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "big_tasks_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "big_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          created_at: string | null
          description: string
          frequency: string | null
          id: string
          importance: number | null
          last_scheduled: string | null
          submitted_by: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          frequency?: string | null
          id?: string
          importance?: number | null
          last_scheduled?: string | null
          submitted_by: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          frequency?: string | null
          id?: string
          importance?: number | null
          last_scheduled?: string | null
          submitted_by?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tags: {
        Row: {
          maintenance_id: string
          tag_id: string
        }
        Insert: {
          maintenance_id: string
          tag_id: string
        }
        Update: {
          maintenance_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tags_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string | null
          description: string
          id: string
          importance: number | null
          status: string | null
          submitted_by: string
          team_id: string
          updated_at: string | null
          urgency: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by: string
          team_id: string
          updated_at?: string | null
          urgency?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by?: string
          team_id?: string
          updated_at?: string | null
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_tasks: {
        Row: {
          assignee_id: string
          big_task_id: string | null
          completed_at: string | null
          created_at: string | null
          day_of_week: number | null
          description: string
          id: string
          maintenance_id: string | null
          status: string | null
          task_id: string | null
          updated_at: string | null
          weekly_plan_id: string
        }
        Insert: {
          assignee_id: string
          big_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description: string
          id?: string
          maintenance_id?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          weekly_plan_id: string
        }
        Update: {
          assignee_id?: string
          big_task_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description?: string
          id?: string
          maintenance_id?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string | null
          weekly_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_tasks_big_task_id_fkey"
            columns: ["big_task_id"]
            isOneToOne: false
            referencedRelation: "big_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_tasks_maintenance_id_fkey"
            columns: ["maintenance_id"]
            isOneToOne: false
            referencedRelation: "maintenance_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_tasks_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          team_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          big_task_id: string | null
          created_at: string | null
          description: string
          id: string
          importance: number | null
          status: string | null
          submitted_by: string
          team_id: string
          updated_at: string | null
          urgency: number | null
        }
        Insert: {
          big_task_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by: string
          team_id: string
          updated_at?: string | null
          urgency?: number | null
        }
        Update: {
          big_task_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          importance?: number | null
          status?: string | null
          submitted_by?: string
          team_id?: string
          updated_at?: string | null
          urgency?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_big_task_id_fkey"
            columns: ["big_task_id"]
            isOneToOne: false
            referencedRelation: "big_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          role: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_plans: {
        Row: {
          ai_conversation: Json | null
          created_at: string | null
          created_by: string
          id: string
          status: string | null
          team_id: string
          updated_at: string | null
          week_start_date: string
        }
        Insert: {
          ai_conversation?: Json | null
          created_at?: string | null
          created_by: string
          id?: string
          status?: string | null
          team_id: string
          updated_at?: string | null
          week_start_date: string
        }
        Update: {
          ai_conversation?: Json | null
          created_at?: string | null
          created_by?: string
          id?: string
          status?: string | null
          team_id?: string
          updated_at?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_team_ids: {
        Args: { user_uuid: string }
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
