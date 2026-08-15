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
    PostgrestVersion: "13.0.5"
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
      bank_sync_credentials: {
        Row: {
          bank: string
          consecutive_failures: number
          created_at: string
          encrypted_password: string
          id: string
          is_active: boolean
          key_version: number
          last_error: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          notify_email: boolean
          rut: string
          sync_schedule: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bank: string
          consecutive_failures?: number
          created_at?: string
          encrypted_password: string
          id?: string
          is_active?: boolean
          key_version?: number
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          notify_email?: boolean
          rut: string
          sync_schedule?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bank?: string
          consecutive_failures?: number
          created_at?: string
          encrypted_password?: string
          id?: string
          is_active?: boolean
          key_version?: number
          last_error?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          notify_email?: boolean
          rut?: string
          sync_schedule?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_sync_log: {
        Row: {
          bank: string
          created_at: string
          error: string | null
          id: string
          imported: number
          imported_items: Json | null
          skipped: number
          skipped_items: Json | null
          status: string
          sync_date: string
          trigger: string
          user_id: string
        }
        Insert: {
          bank: string
          created_at?: string
          error?: string | null
          id?: string
          imported?: number
          imported_items?: Json | null
          skipped?: number
          skipped_items?: Json | null
          status: string
          sync_date?: string
          trigger: string
          user_id: string
        }
        Update: {
          bank?: string
          created_at?: string
          error?: string | null
          id?: string
          imported?: number
          imported_items?: Json | null
          skipped?: number
          skipped_items?: Json | null
          status?: string
          sync_date?: string
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      card_transactions: {
        Row: {
          amount: number
          billing_date: string | null
          card_id: string
          created_at: string
          description: string | null
          id: string
          is_billed: boolean | null
          is_paid: boolean | null
          transaction_date: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          billing_date?: string | null
          card_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_billed?: boolean | null
          is_paid?: boolean | null
          transaction_date?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_date?: string | null
          card_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_billed?: boolean | null
          is_paid?: boolean | null
          transaction_date?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_card_summary"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_transactions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      category_limits: {
        Row: {
          alert_at_percentage: number | null
          category_name: string
          created_at: string | null
          id: string
          monthly_limit: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_at_percentage?: number | null
          category_name: string
          created_at?: string | null
          id?: string
          monthly_limit: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_at_percentage?: number | null
          category_name?: string
          created_at?: string | null
          id?: string
          monthly_limit?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chilean_holidays: {
        Row: {
          created_at: string
          date: string
          inalienable: boolean
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          date: string
          inalienable?: boolean
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          inalienable?: boolean
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      chilean_holidays_sync: {
        Row: {
          holiday_count: number
          synced_at: string
          year: number
        }
        Insert: {
          holiday_count: number
          synced_at?: string
          year: number
        }
        Update: {
          holiday_count?: number
          synced_at?: string
          year?: number
        }
        Relationships: []
      }
      comparables: {
        Row: {
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          cleaning_fee: number | null
          comuna: string | null
          created_at: string
          distance_km: number | null
          id: string
          is_superhost: boolean | null
          latitude: number | null
          longitude: number | null
          max_guests: number | null
          notes: string | null
          occupancy_rate: number | null
          price_per_month: number | null
          price_per_night: number | null
          property_id: string
          rating: number | null
          reviews_count: number | null
          source_url: string | null
          surface_m2: number | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cleaning_fee?: number | null
          comuna?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          is_superhost?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          notes?: string | null
          occupancy_rate?: number | null
          price_per_month?: number | null
          price_per_night?: number | null
          property_id: string
          rating?: number | null
          reviews_count?: number | null
          source_url?: string | null
          surface_m2?: number | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cleaning_fee?: number | null
          comuna?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          is_superhost?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          notes?: string | null
          occupancy_rate?: number | null
          price_per_month?: number | null
          price_per_night?: number | null
          property_id?: string
          rating?: number | null
          reviews_count?: number | null
          source_url?: string | null
          surface_m2?: number | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comparables_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          billing_day: number
          color: string | null
          created_at: string
          credit_limit: number
          id: string
          is_active: boolean | null
          last_4_digits: string | null
          name: string
          payment_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_day: number
          color?: string | null
          created_at?: string
          credit_limit?: number
          id?: string
          is_active?: boolean | null
          last_4_digits?: string | null
          name: string
          payment_day: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_day?: number
          color?: string | null
          created_at?: string
          credit_limit?: number
          id?: string
          is_active?: boolean | null
          last_4_digits?: string | null
          name?: string
          payment_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fintual_investments: {
        Row: {
          created_at: string
          deposited: number
          fund_name: string | null
          goal_id: string
          goal_name: string
          id: string
          nav: number
          profit: number
          profit_percentage: number | null
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deposited: number
          fund_name?: string | null
          goal_id: string
          goal_name: string
          id?: string
          nav: number
          profit: number
          profit_percentage?: number | null
          snapshot_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deposited?: number
          fund_name?: string | null
          goal_id?: string
          goal_name?: string
          id?: string
          nav?: number
          profit?: number
          profit_percentage?: number | null
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      fintual_sync_log: {
        Row: {
          duration_ms: number | null
          error_details: Json | null
          errors_count: number | null
          goals_synced: number | null
          id: string
          status: string | null
          sync_date: string
          users_synced: number | null
        }
        Insert: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number | null
          goals_synced?: number | null
          id?: string
          status?: string | null
          sync_date?: string
          users_synced?: number | null
        }
        Update: {
          duration_ms?: number | null
          error_details?: Json | null
          errors_count?: number | null
          goals_synced?: number | null
          id?: string
          status?: string | null
          sync_date?: string
          users_synced?: number | null
        }
        Relationships: []
      }
      fintual_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          last_synced_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_synced_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_synced_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_purchases: {
        Row: {
          card_id: string
          category_name: string | null
          created_at: string
          description: string
          first_installment_date: string
          id: string
          installment_amount: number
          is_active: boolean | null
          notes: string | null
          paid_installments: number
          purchase_date: string
          total_amount: number
          total_installments: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          category_name?: string | null
          created_at?: string
          description: string
          first_installment_date: string
          id?: string
          installment_amount: number
          is_active?: boolean | null
          notes?: string | null
          paid_installments?: number
          purchase_date?: string
          total_amount: number
          total_installments: number
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          category_name?: string | null
          created_at?: string
          description?: string
          first_installment_date?: string
          id?: string
          installment_amount?: number
          is_active?: boolean | null
          notes?: string | null
          paid_installments?: number
          purchase_date?: string
          total_amount?: number
          total_installments?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_purchases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_card_summary"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "installment_purchases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_analyses: {
        Row: {
          airbnb_nightly_rate: number | null
          airbnb_platform_fee_percent: number | null
          break_even_occupancy: number | null
          cap_rate: number | null
          cash_on_cash: number | null
          closing_costs: number
          contribuciones_annual: number
          created_at: string
          down_payment_percent: number
          gastos_comunes: number
          gross_rent_multiplier: number | null
          id: string
          insurance_annual: number
          maintenance_percent: number
          monthly_cashflow: number | null
          monthly_mortgage_payment: number | null
          monthly_rent: number | null
          mortgage_rate: number
          mortgage_years: number
          noi_annual: number | null
          occupancy_rate: number | null
          property_id: string
          property_management_percent: number
          purchase_price: number
          renovation_costs: number
          strategy: string
          total_investment: number | null
          updated_at: string
          user_id: string
          utilities: number
        }
        Insert: {
          airbnb_nightly_rate?: number | null
          airbnb_platform_fee_percent?: number | null
          break_even_occupancy?: number | null
          cap_rate?: number | null
          cash_on_cash?: number | null
          closing_costs?: number
          contribuciones_annual?: number
          created_at?: string
          down_payment_percent?: number
          gastos_comunes?: number
          gross_rent_multiplier?: number | null
          id?: string
          insurance_annual?: number
          maintenance_percent?: number
          monthly_cashflow?: number | null
          monthly_mortgage_payment?: number | null
          monthly_rent?: number | null
          mortgage_rate?: number
          mortgage_years?: number
          noi_annual?: number | null
          occupancy_rate?: number | null
          property_id: string
          property_management_percent?: number
          purchase_price: number
          renovation_costs?: number
          strategy?: string
          total_investment?: number | null
          updated_at?: string
          user_id: string
          utilities?: number
        }
        Update: {
          airbnb_nightly_rate?: number | null
          airbnb_platform_fee_percent?: number | null
          break_even_occupancy?: number | null
          cap_rate?: number | null
          cash_on_cash?: number | null
          closing_costs?: number
          contribuciones_annual?: number
          created_at?: string
          down_payment_percent?: number
          gastos_comunes?: number
          gross_rent_multiplier?: number | null
          id?: string
          insurance_annual?: number
          maintenance_percent?: number
          monthly_cashflow?: number | null
          monthly_mortgage_payment?: number | null
          monthly_rent?: number | null
          mortgage_rate?: number
          mortgage_years?: number
          noi_annual?: number | null
          occupancy_rate?: number | null
          property_id?: string
          property_management_percent?: number
          purchase_price?: number
          renovation_costs?: number
          strategy?: string
          total_investment?: number | null
          updated_at?: string
          user_id?: string
          utilities?: number
        }
        Relationships: [
          {
            foreignKeyName: "investment_analyses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_goals: {
        Row: {
          created_at: string
          daily_minutes_target: number
          emoji: string
          id: string
          is_active: boolean
          level_current: string | null
          level_target: string | null
          north_star: string | null
          topic: string
          updated_at: string
          user_id: string
          weekly_days_target: number
        }
        Insert: {
          created_at?: string
          daily_minutes_target?: number
          emoji?: string
          id?: string
          is_active?: boolean
          level_current?: string | null
          level_target?: string | null
          north_star?: string | null
          topic: string
          updated_at?: string
          user_id: string
          weekly_days_target?: number
        }
        Update: {
          created_at?: string
          daily_minutes_target?: number
          emoji?: string
          id?: string
          is_active?: boolean
          level_current?: string | null
          level_target?: string | null
          north_star?: string | null
          topic?: string
          updated_at?: string
          user_id?: string
          weekly_days_target?: number
        }
        Relationships: []
      }
      learning_item_sightings: {
        Row: {
          context: string | null
          created_at: string
          id: string
          item_id: string
          session_id: string | null
          timestamp_seconds: number | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          item_id: string
          session_id?: string | null
          timestamp_seconds?: number | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          item_id?: string
          session_id?: string | null
          timestamp_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_item_sightings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "learning_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_item_sightings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_items: {
        Row: {
          created_at: string
          expression: string
          first_session_id: string | null
          goal_id: string
          id: string
          item_type: string
          last_seen_at: string
          mastery: string
          meaning: string | null
          meaning_es: string | null
          my_sentence: string | null
          normalized: string
          times_seen: number
          translation_es: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expression: string
          first_session_id?: string | null
          goal_id: string
          id?: string
          item_type?: string
          last_seen_at?: string
          mastery?: string
          meaning?: string | null
          meaning_es?: string | null
          my_sentence?: string | null
          normalized: string
          times_seen?: number
          translation_es?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expression?: string
          first_session_id?: string | null
          goal_id?: string
          id?: string
          item_type?: string
          last_seen_at?: string
          mastery?: string
          meaning?: string | null
          meaning_es?: string | null
          my_sentence?: string | null
          normalized?: string
          times_seen?: number
          translation_es?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_items_first_session_id_fkey"
            columns: ["first_session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_items_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sessions: {
        Row: {
          comp_details: number | null
          comp_explain: number | null
          comp_main_idea: number | null
          comp_subtitles: number | null
          consumed_seconds: number
          content_author: string | null
          content_duration_seconds: number | null
          content_thumbnail: string | null
          content_title: string | null
          content_type: string
          content_url: string | null
          created_at: string
          difficulty: string | null
          effective_seconds: number
          elapsed_seconds: number | null
          ended_at: string | null
          external_id: string | null
          goal_id: string
          id: string
          last_heartbeat_at: string | null
          last_position_seconds: number
          last_resumed_at: string | null
          main_idea_text: string | null
          pause_count: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comp_details?: number | null
          comp_explain?: number | null
          comp_main_idea?: number | null
          comp_subtitles?: number | null
          consumed_seconds?: number
          content_author?: string | null
          content_duration_seconds?: number | null
          content_thumbnail?: string | null
          content_title?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          difficulty?: string | null
          effective_seconds?: number
          elapsed_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          goal_id: string
          id?: string
          last_heartbeat_at?: string | null
          last_position_seconds?: number
          last_resumed_at?: string | null
          main_idea_text?: string | null
          pause_count?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comp_details?: number | null
          comp_explain?: number | null
          comp_main_idea?: number | null
          comp_subtitles?: number | null
          consumed_seconds?: number
          content_author?: string | null
          content_duration_seconds?: number | null
          content_thumbnail?: string | null
          content_title?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          difficulty?: string | null
          effective_seconds?: number
          elapsed_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          goal_id?: string
          id?: string
          last_heartbeat_at?: string | null
          last_position_seconds?: number
          last_resumed_at?: string | null
          main_idea_text?: string | null
          pause_count?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_queue: {
        Row: {
          content_author: string | null
          content_duration_seconds: number | null
          content_thumbnail: string | null
          content_title: string | null
          content_type: string
          content_url: string | null
          created_at: string
          external_id: string | null
          goal_id: string
          id: string
          note: string | null
          session_id: string | null
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        Insert: {
          content_author?: string | null
          content_duration_seconds?: number | null
          content_thumbnail?: string | null
          content_title?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          external_id?: string | null
          goal_id: string
          id?: string
          note?: string | null
          session_id?: string | null
          updated_at?: string
          user_id: string
          watched_at?: string | null
        }
        Update: {
          content_author?: string | null
          content_duration_seconds?: number | null
          content_thumbnail?: string | null
          content_title?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          external_id?: string | null
          goal_id?: string
          id?: string
          note?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_queue_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_transcripts: {
        Row: {
          created_at: string
          cue_count: number
          cues: Json
          external_id: string
          id: string
          lang: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cue_count?: number
          cues: Json
          external_id: string
          id?: string
          lang?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cue_count?: number
          cues?: Json
          external_id?: string
          id?: string
          lang?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          created_at: string | null
          id: string
          savings_goal: number | null
          splurge_categories: string[]
          splurge_fund_monthly: number | null
          splurge_fund_start: string | null
          total_budget: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          savings_goal?: number | null
          splurge_categories?: string[]
          splurge_fund_monthly?: number | null
          splurge_fund_start?: string | null
          total_budget?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          savings_goal?: number | null
          splurge_categories?: string[]
          splurge_fund_monthly?: number | null
          splurge_fund_start?: string | null
          total_budget?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          bathrooms: number
          bedrooms: number
          bodegas: number | null
          comuna: string
          created_at: string
          favorito: boolean
          floor: number | null
          gastos_comunes: number | null
          has_condominio_cerrado: boolean | null
          has_jardin: boolean | null
          has_piscina: boolean | null
          has_quincho: boolean | null
          id: string
          images: string[] | null
          latitude: number | null
          longitude: number | null
          notes: string | null
          orientation: string | null
          parking: number
          price_clp: number
          price_per_m2: number | null
          price_uf: number | null
          region: string
          source: string
          source_url: string | null
          status: string
          surface_m2: number
          terrain_m2: number | null
          title: string | null
          type: string
          updated_at: string
          user_id: string
          year_built: number | null
        }
        Insert: {
          address: string
          bathrooms?: number
          bedrooms?: number
          bodegas?: number | null
          comuna: string
          created_at?: string
          favorito?: boolean
          floor?: number | null
          gastos_comunes?: number | null
          has_condominio_cerrado?: boolean | null
          has_jardin?: boolean | null
          has_piscina?: boolean | null
          has_quincho?: boolean | null
          id?: string
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          orientation?: string | null
          parking?: number
          price_clp: number
          price_per_m2?: number | null
          price_uf?: number | null
          region?: string
          source?: string
          source_url?: string | null
          status?: string
          surface_m2: number
          terrain_m2?: number | null
          title?: string | null
          type: string
          updated_at?: string
          user_id: string
          year_built?: number | null
        }
        Update: {
          address?: string
          bathrooms?: number
          bedrooms?: number
          bodegas?: number | null
          comuna?: string
          created_at?: string
          favorito?: boolean
          floor?: number | null
          gastos_comunes?: number | null
          has_condominio_cerrado?: boolean | null
          has_jardin?: boolean | null
          has_piscina?: boolean | null
          has_quincho?: boolean | null
          id?: string
          images?: string[] | null
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          orientation?: string | null
          parking?: number
          price_clp?: number
          price_per_m2?: number | null
          price_uf?: number | null
          region?: string
          source?: string
          source_url?: string | null
          status?: string
          surface_m2?: number
          terrain_m2?: number | null
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          year_built?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_expenses: {
        Row: {
          amount_owed: number
          created_at: string
          debtor_name: string
          detail: string | null
          direction: string
          id: string
          paid: boolean
          paid_at: string | null
          paid_transaction_id: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount_owed: number
          created_at?: string
          debtor_name: string
          detail?: string | null
          direction?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          paid_transaction_id?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount_owed?: number
          created_at?: string
          debtor_name?: string
          detail?: string | null
          direction?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          paid_transaction_id?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_expenses_paid_transaction_id_fkey"
            columns: ["paid_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          bank_description: string | null
          bank_settlement_date: string | null
          card_id: string | null
          category_name: string
          created_at: string
          date: string
          detail: string | null
          id: string
          import_source: string | null
          installment_id: string | null
          reimbursement_for_category: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_description?: string | null
          bank_settlement_date?: string | null
          card_id?: string | null
          category_name: string
          created_at?: string
          date?: string
          detail?: string | null
          id?: string
          import_source?: string | null
          installment_id?: string | null
          reimbursement_for_category?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_description?: string | null
          bank_settlement_date?: string | null
          card_id?: string | null
          category_name?: string
          created_at?: string
          date?: string
          detail?: string | null
          id?: string
          import_source?: string | null
          installment_id?: string | null
          reimbursement_for_category?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_card_summary"
            referencedColumns: ["card_id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installment_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_classes: {
        Row: {
          cancellation_reason: string | null
          created_at: string | null
          date: string
          duration_hours: number
          id: string
          is_paid: boolean
          notes: string | null
          price_per_hour: number
          status: string
          student_id: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string | null
          date?: string
          duration_hours?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          price_per_hour?: number
          status?: string
          student_id: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string | null
          date?: string
          duration_hours?: number
          id?: string
          is_paid?: boolean
          notes?: string | null
          price_per_hour?: number
          status?: string
          student_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutoring_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "tutoring_students"
            referencedColumns: ["id"]
          },
        ]
      }
      tutoring_students: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          accent_color_1: string | null
          accent_color_2: string | null
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          nav_preferences: Json | null
          nickname: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color_1?: string | null
          accent_color_2?: string | null
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          nav_preferences?: Json | null
          nickname?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color_1?: string | null
          accent_color_2?: string | null
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          nav_preferences?: Json | null
          nickname?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      credit_card_summary: {
        Row: {
          active_installment_count: number | null
          available_credit: number | null
          billing_day: number | null
          card_id: string | null
          card_name: string | null
          color: string | null
          credit_limit: number | null
          is_active: boolean | null
          last_4_digits: string | null
          next_payment_installments: number | null
          payment_day: number | null
          total_used_credit: number | null
          used_credit_installments: number | null
          used_credit_transactions: number | null
          user_id: string | null
        }
        Relationships: []
      }
      shared_expenses_with_transaction: {
        Row: {
          amount_owed: number | null
          created_at: string | null
          debtor_name: string | null
          detail: string | null
          direction: string | null
          id: string | null
          paid: boolean | null
          paid_at: string | null
          paid_transaction_id: string | null
          transaction_amount: number | null
          transaction_category: string | null
          transaction_date: string | null
          transaction_detail: string | null
          transaction_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_expenses_paid_transaction_id_fkey"
            columns: ["paid_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_expenses_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      capture_learning_expression: {
        Args: {
          p_context?: string
          p_expression: string
          p_goal_id: string
          p_item_type?: string
          p_meaning?: string
          p_meaning_es?: string
          p_session_id: string
          p_timestamp_seconds?: number
          p_translation_es?: string
        }
        Returns: Json
      }
      get_next_billing_date: {
        Args: { p_billing_day: number; p_from_date?: string }
        Returns: string
      }
      get_pending_by_creditor: {
        Args: { p_user_id: string }
        Returns: {
          count_expenses: number
          creditor_name: string
          total_owed: number
        }[]
      }
      get_pending_by_debtor: {
        Args: { p_user_id: string }
        Returns: {
          count_expenses: number
          debtor_name: string
          total_owed: number
        }[]
      }
      get_shared_expense_summary: {
        Args: { p_transaction_id: string; p_user_id: string }
        Returns: {
          all_paid: boolean
          total_debtors: number
          total_owed: number
          total_paid: number
          total_pending: number
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
