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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          active: boolean
          branch_id: string
          created_at: string
          id: string
          name: string
          shop_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          active?: boolean
          branch_id: string
          created_at?: string
          id?: string
          name: string
          shop_id: string
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          active?: boolean
          branch_id?: string
          created_at?: string
          id?: string
          name?: string
          shop_id?: string
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          created_at: string
          default_pay: string | null
          id: string
          name: string
          pay_buttons: string[] | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          default_pay?: string | null
          id?: string
          name: string
          pay_buttons?: string[] | null
          shop_id: string
        }
        Update: {
          created_at?: string
          default_pay?: string | null
          id?: string
          name?: string
          pay_buttons?: string[] | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          shop_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          shop_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      day_closes: {
        Row: {
          branch_id: string
          business_date: string
          closed_at: string
          closed_by: string
          counted_cash: number
          difference: number | null
          expected_cash: number
          id: string
          note: string | null
          shop_id: string
        }
        Insert: {
          branch_id: string
          business_date: string
          closed_at?: string
          closed_by: string
          counted_cash: number
          difference?: number | null
          expected_cash: number
          id?: string
          note?: string | null
          shop_id: string
        }
        Update: {
          branch_id?: string
          business_date?: string
          closed_at?: string
          closed_by?: string
          counted_cash?: number
          difference?: number | null
          expected_cash?: number
          id?: string
          note?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_closes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_closes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_lines: {
        Row: {
          account_id: string | null
          amount: number
          branch_id: string
          customer_id: string | null
          id: number
          shop_id: string
          transaction_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          branch_id: string
          customer_id?: string | null
          id?: never
          shop_id: string
          transaction_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          branch_id?: string
          customer_id?: string | null
          id?: never
          shop_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "ledger_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_dues"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ledger_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_lines_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          branch_id: string | null
          created_at: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          shop_id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          shop_id: string
          user_id: string
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          created_at?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          aliases: string[]
          category: string
          commission_rule: Json | null
          created_at: string
          created_by: string | null
          fee_rule: Json | null
          flow: Database["public"]["Enums"]["flow_type"]
          id: string
          name: string
          portal_cost_rule: Json | null
          reviewed: boolean
          shop_id: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          category?: string
          commission_rule?: Json | null
          created_at?: string
          created_by?: string | null
          fee_rule?: Json | null
          flow: Database["public"]["Enums"]["flow_type"]
          id?: string
          name: string
          portal_cost_rule?: Json | null
          reviewed?: boolean
          shop_id: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          category?: string
          commission_rule?: Json | null
          created_at?: string
          created_by?: string | null
          fee_rule?: Json | null
          flow?: Database["public"]["Enums"]["flow_type"]
          id?: string
          name?: string
          portal_cost_rule?: Json | null
          reviewed?: boolean
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          branch_id: string
          business_date: string
          client_id: string
          commission: number
          created_at: string
          created_by: string
          customer_id: string | null
          earning: number
          fee: number
          id: string
          kind: Database["public"]["Enums"]["txn_kind"]
          note: string | null
          portal_cost: number
          reversal_of: string | null
          service_id: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          business_date: string
          client_id: string
          commission?: number
          created_at?: string
          created_by: string
          customer_id?: string | null
          earning?: number
          fee?: number
          id?: string
          kind: Database["public"]["Enums"]["txn_kind"]
          note?: string | null
          portal_cost?: number
          reversal_of?: string | null
          service_id?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          business_date?: string
          client_id?: string
          commission?: number
          created_at?: string
          created_by?: string
          customer_id?: string | null
          earning?: number
          fee?: number
          id?: string
          kind?: Database["public"]["Enums"]["txn_kind"]
          note?: string | null
          portal_cost?: number
          reversal_of?: string | null
          service_id?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_dues"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          active: boolean | null
          balance: number | null
          branch_id: string | null
          name: string | null
          shop_id: string | null
          type: Database["public"]["Enums"]["account_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_dues: {
        Row: {
          customer_id: string | null
          due: number | null
          name: string | null
          phone: string | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calc_rule: { Args: { p_amount: number; p_rule: Json }; Returns: number }
      close_day: {
        Args: { p_branch_id: string; p_counted_cash: number; p_note?: string }
        Returns: string
      }
      create_shop: {
        Args: { p_owner_name: string; p_shop_name: string }
        Returns: string
      }
      is_valid_rule: { Args: { p_rule: Json }; Returns: boolean }
      post_expense: {
        Args: {
          p_account_id: string
          p_amount: number
          p_branch_id: string
          p_client_id: string
          p_note?: string
        }
        Returns: string
      }
      post_opening_balance: {
        Args: {
          p_account_id: string
          p_amount: number
          p_client_id: string
          p_note?: string
        }
        Returns: string
      }
      post_service: {
        Args: {
          p_amount: number
          p_branch_id: string
          p_client_id: string
          p_commission?: number
          p_customer_id?: string
          p_fee?: number
          p_note?: string
          p_payments: Json
          p_portal_cost?: number
          p_service_id: string
          p_wallet_account_id?: string
        }
        Returns: string
      }
      post_transfer: {
        Args: {
          p_amount: number
          p_client_id: string
          p_from_account_id: string
          p_note?: string
          p_to_account_id: string
        }
        Returns: string
      }
      post_udhaar_given: {
        Args: {
          p_account_id: string
          p_amount: number
          p_branch_id: string
          p_client_id: string
          p_customer_id: string
          p_note?: string
        }
        Returns: string
      }
      post_udhaar_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_branch_id: string
          p_client_id: string
          p_customer_id: string
          p_note?: string
        }
        Returns: string
      }
      report_groups: {
        Args: {
          p_branch?: string
          p_from: string
          p_group: string
          p_to: string
        }
        Returns: {
          entries: number
          key: string
          label: string
          profit: number
        }[]
      }
      report_totals: {
        Args: { p_branch?: string; p_from: string; p_to: string }
        Returns: {
          charges: number
          commission: number
          entries: number
          expenses: number
          profit: number
        }[]
      }
      reverse_transaction: {
        Args: {
          p_client_id: string
          p_reason: string
          p_transaction_id: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "cash" | "wallet" | "bank"
      flow_type:
        | "cash_out"
        | "cash_in"
        | "pay_through"
        | "application"
        | "counter_sale"
      txn_kind:
        | "service"
        | "expense"
        | "transfer"
        | "udhaar_payment"
        | "opening_balance"
        | "reversal"
        | "udhaar_given"
      user_role: "owner" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ["cash", "wallet", "bank"],
      flow_type: [
        "cash_out",
        "cash_in",
        "pay_through",
        "application",
        "counter_sale",
      ],
      txn_kind: [
        "service",
        "expense",
        "transfer",
        "udhaar_payment",
        "opening_balance",
        "reversal",
        "udhaar_given",
      ],
      user_role: ["owner", "staff"],
    },
  },
} as const
