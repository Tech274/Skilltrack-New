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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          summary: string | null
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          summary?: string | null
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          summary?: string | null
          target_id?: string | null
          target_table?: string
        }
        Relationships: []
      }
      access_rules: {
        Row: {
          active: boolean
          asset_id: string | null
          asset_type: string
          certification_slug: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          metadata: Json
          required_plan: string | null
          required_role: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          asset_id?: string | null
          asset_type: string
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          required_plan?: string | null
          required_role?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          asset_id?: string | null
          asset_type?: string
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          metadata?: Json
          required_plan?: string | null
          required_role?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          audience: string
          body: string | null
          category: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          audience?: string
          body?: string | null
          category: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: []
      }
      ai_action_audit: {
        Row: {
          action: string
          actor_id: string | null
          area: string
          created_at: string
          id: string
          model: string | null
          org_id: string | null
          payload: Json | null
          prompt: string | null
          prompt_version_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          area: string
          created_at?: string
          id?: string
          model?: string | null
          org_id?: string | null
          payload?: Json | null
          prompt?: string | null
          prompt_version_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          area?: string
          created_at?: string
          id?: string
          model?: string | null
          org_id?: string | null
          payload?: Json | null
          prompt?: string | null
          prompt_version_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_action_audit_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extraction_jobs: {
        Row: {
          column_map: Json | null
          created_at: string
          created_by: string | null
          error: string | null
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          id: string
          model: string | null
          org_id: string | null
          prompt: string | null
          prompt_version_id: string | null
          source: string
          status: string
          summary: Json | null
          tabular_headers: Json | null
          target_entity: string
          updated_at: string
        }
        Insert: {
          column_map?: Json | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          model?: string | null
          org_id?: string | null
          prompt?: string | null
          prompt_version_id?: string | null
          source?: string
          status?: string
          summary?: Json | null
          tabular_headers?: Json | null
          target_entity: string
          updated_at?: string
        }
        Update: {
          column_map?: Json | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          model?: string | null
          org_id?: string | null
          prompt?: string | null
          prompt_version_id?: string | null
          source?: string
          status?: string
          summary?: Json | null
          tabular_headers?: Json | null
          target_entity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_extraction_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_jobs_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extraction_staged_rows: {
        Row: {
          created_at: string
          id: string
          job_id: string
          normalized: Json | null
          org_id: string | null
          payload: Json
          position: number
          status: string
          target_row_id: string | null
          updated_at: string
          validation_errors: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          normalized?: Json | null
          org_id?: string | null
          payload?: Json
          position?: number
          status?: string
          target_row_id?: string | null
          updated_at?: string
          validation_errors?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          normalized?: Json | null
          org_id?: string | null
          payload?: Json
          position?: number
          status?: string
          target_row_id?: string | null
          updated_at?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extraction_staged_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_extraction_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extraction_staged_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          comment: string | null
          created_at: string
          feature: string
          id: string
          rating: number
          target_id: string | null
          target_payload: Json | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          feature: string
          id?: string
          rating: number
          target_id?: string | null
          target_payload?: Json | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          feature?: string
          id?: string
          rating?: number
          target_id?: string | null
          target_payload?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ai_org_defaults: {
        Row: {
          created_at: string
          default_model: string | null
          llm_timeout_ms: number | null
          max_output_tokens: number | null
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          default_model?: string | null
          llm_timeout_ms?: number | null
          max_output_tokens?: number | null
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          default_model?: string | null
          llm_timeout_ms?: number | null
          max_output_tokens?: number | null
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_org_defaults_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          created_at: string
          created_by: string | null
          form_key: string
          id: string
          is_active: boolean
          model: string | null
          notes: string | null
          schema_json: Json | null
          system_prompt: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          form_key: string
          id?: string
          is_active?: boolean
          model?: string | null
          notes?: string | null
          schema_json?: Json | null
          system_prompt: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          form_key?: string
          id?: string
          is_active?: boolean
          model?: string | null
          notes?: string | null
          schema_json?: Json | null
          system_prompt?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      ai_recs_audit: {
        Row: {
          created_at: string
          error: string | null
          fallback: boolean
          id: string
          message: string | null
          recommendation_count: number
          source: string
          strategy: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          fallback?: boolean
          id?: string
          message?: string | null
          recommendation_count?: number
          source: string
          strategy: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          fallback?: boolean
          id?: string
          message?: string | null
          recommendation_count?: number
          source?: string
          strategy?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      brand_settings: {
        Row: {
          id: number
          updated_at: string
          version: number
        }
        Insert: {
          id?: number
          updated_at?: string
          version?: number
        }
        Update: {
          id?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          analytics_id: string | null
          audience: string
          badge: string | null
          campaign_type: string
          created_at: string
          created_by: string | null
          description: string | null
          desktop_image_url: string | null
          end_date: string | null
          eyebrow: string | null
          headline: string
          id: string
          image_alt: string | null
          image_position: string
          is_active: boolean
          mobile_image_url: string | null
          primary_cta_label: string
          primary_cta_url: string
          priority: number
          secondary_cta_label: string | null
          secondary_cta_url: string | null
          slug: string
          start_date: string | null
          text_alignment: string
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          analytics_id?: string | null
          audience?: string
          badge?: string | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_image_url?: string | null
          end_date?: string | null
          eyebrow?: string | null
          headline: string
          id?: string
          image_alt?: string | null
          image_position?: string
          is_active?: boolean
          mobile_image_url?: string | null
          primary_cta_label: string
          primary_cta_url: string
          priority?: number
          secondary_cta_label?: string | null
          secondary_cta_url?: string | null
          slug: string
          start_date?: string | null
          text_alignment?: string
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          analytics_id?: string | null
          audience?: string
          badge?: string | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          desktop_image_url?: string | null
          end_date?: string | null
          eyebrow?: string | null
          headline?: string
          id?: string
          image_alt?: string | null
          image_position?: string
          is_active?: boolean
          mobile_image_url?: string | null
          primary_cta_label?: string
          primary_cta_url?: string
          priority?: number
          secondary_cta_label?: string | null
          secondary_cta_url?: string | null
          slug?: string
          start_date?: string | null
          text_alignment?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      certifications_catalog: {
        Row: {
          category: string | null
          code: string | null
          cost_usd: number | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          learning_outcomes: string[] | null
          level: string | null
          name: string
          org_id: string | null
          passing_score: number | null
          skills: string[] | null
          slug: string
          status: string
          tagline: string | null
          thumbnail_url: string | null
          updated_at: string
          validity_years: number | null
          vendor: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          learning_outcomes?: string[] | null
          level?: string | null
          name: string
          org_id?: string | null
          passing_score?: number | null
          skills?: string[] | null
          slug: string
          status?: string
          tagline?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          validity_years?: number | null
          vendor?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          learning_outcomes?: string[] | null
          level?: string | null
          name?: string
          org_id?: string | null
          passing_score?: number | null
          skills?: string[] | null
          slug?: string
          status?: string
          tagline?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          validity_years?: number | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_catalog_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base: string
          fetched_at: string
          rates: Json
          source: string | null
        }
        Insert: {
          base?: string
          fetched_at?: string
          rates?: Json
          source?: string | null
        }
        Update: {
          base?: string
          fetched_at?: string
          rates?: Json
          source?: string | null
        }
        Relationships: []
      }
      invoice_action_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          metadata: Json
          org_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          org_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_action_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_action_audit_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_email_audit: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          invoice_number: string | null
          metadata: Json
          provider_message_id: string | null
          recipient_email: string
          status: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          invoice_number?: string | null
          metadata?: Json
          provider_message_id?: string | null
          recipient_email: string
          status: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          invoice_number?: string | null
          metadata?: Json
          provider_message_id?: string | null
          recipient_email?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_email_audit_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_email_job_items: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          job_id: string
          processed_at: string | null
          recipient_email: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          job_id: string
          processed_at?: string | null
          recipient_email?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          job_id?: string
          processed_at?: string | null
          recipient_email?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_email_job_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_email_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "invoice_email_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_email_jobs: {
        Row: {
          body_html_override: string | null
          created_at: string
          created_by: string | null
          failed: number
          finished_at: string | null
          id: string
          last_error: string | null
          processed: number
          started_at: string | null
          status: string
          subject_override: string | null
          succeeded: number
          template_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          body_html_override?: string | null
          created_at?: string
          created_by?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          processed?: number
          started_at?: string | null
          status?: string
          subject_override?: string | null
          succeeded?: number
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          body_html_override?: string | null
          created_at?: string
          created_by?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          processed?: number
          started_at?: string | null
          status?: string
          subject_override?: string | null
          succeeded?: number
          template_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_email_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "invoice_email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_email_templates: {
        Row: {
          body_html_template: string
          created_at: string
          created_by: string | null
          id: string
          invoice_type: string | null
          is_default: boolean
          name: string
          org_id: string | null
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_html_template: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_type?: string | null
          is_default?: boolean
          name: string
          org_id?: string | null
          subject_template: string
          updated_at?: string
        }
        Update: {
          body_html_template?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_type?: string | null
          is_default?: boolean
          name?: string
          org_id?: string | null
          subject_template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reconciliation_decisions: {
        Row: {
          action: string
          checklist: Json
          confidence: number | null
          created_at: string
          decided_by: string | null
          id: string
          invoice_id: string | null
          marked_paid: boolean
          notes: string | null
          payment_id: string | null
          reasons: Json
        }
        Insert: {
          action: string
          checklist?: Json
          confidence?: number | null
          created_at?: string
          decided_by?: string | null
          id?: string
          invoice_id?: string | null
          marked_paid?: boolean
          notes?: string | null
          payment_id?: string | null
          reasons?: Json
        }
        Update: {
          action?: string
          checklist?: Json
          confidence?: number | null
          created_at?: string
          decided_by?: string | null
          id?: string
          invoice_id?: string | null
          marked_paid?: boolean
          notes?: string | null
          payment_id?: string | null
          reasons?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reconciliation_decisions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reconciliation_decisions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_address: string | null
          certification_slug: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount: number
          due_date: string | null
          email_last_error: string | null
          email_last_sent_at: string | null
          email_status: string
          id: string
          invoice_number: string
          issue_date: string
          learner_email: string | null
          learner_id: string
          learner_name: string | null
          paid_at: string | null
          plan_key: string | null
          status: string
          tax: number
          tax_number: string | null
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_address?: string | null
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount?: number
          due_date?: string | null
          email_last_error?: string | null
          email_last_sent_at?: string | null
          email_status?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          learner_email?: string | null
          learner_id: string
          learner_name?: string | null
          paid_at?: string | null
          plan_key?: string | null
          status?: string
          tax?: number
          tax_number?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_address?: string | null
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount?: number
          due_date?: string | null
          email_last_error?: string | null
          email_last_sent_at?: string | null
          email_status?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          learner_email?: string | null
          learner_id?: string
          learner_name?: string | null
          paid_at?: string | null
          plan_key?: string | null
          status?: string
          tax?: number
          tax_number?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          certs: string | null
          created_at: string
          email: string
          hear_about: string | null
          id: string
          ip_hash: string | null
          name: string
          notes: string | null
          page_path: string | null
          phone: string
          sheet_error: string | null
          sheet_synced_at: string | null
          source: string
          status: string
          submission_id: string
          timing: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          certs?: string | null
          created_at?: string
          email: string
          hear_about?: string | null
          id?: string
          ip_hash?: string | null
          name: string
          notes?: string | null
          page_path?: string | null
          phone: string
          sheet_error?: string | null
          sheet_synced_at?: string | null
          source: string
          status?: string
          submission_id: string
          timing?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          certs?: string | null
          created_at?: string
          email?: string
          hear_about?: string | null
          id?: string
          ip_hash?: string | null
          name?: string
          notes?: string | null
          page_path?: string | null
          phone?: string
          sheet_error?: string | null
          sheet_synced_at?: string | null
          source?: string
          status?: string
          submission_id?: string
          timing?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      learner_assignments: {
        Row: {
          asset_id: string
          asset_label: string | null
          asset_type: string
          assigned_by: string | null
          created_at: string
          due_at: string | null
          id: string
          learner_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asset_id: string
          asset_label?: string | null
          asset_type: string
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          learner_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          asset_label?: string | null
          asset_type?: string
          assigned_by?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          learner_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      learner_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          end_date: string | null
          id: string
          learner_id: string
          notes: string | null
          plan_key: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          learner_id: string
          notes?: string | null
          plan_key: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          end_date?: string | null
          id?: string
          learner_id?: string
          notes?: string | null
          plan_key?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_path_versions: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          label: string | null
          org_id: string | null
          path_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          org_id?: string | null
          path_id: string
          snapshot: Json
          version_number: number
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          org_id?: string | null
          path_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_versions_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          assessments: Json
          created_at: string
          created_by: string | null
          description: string | null
          difficulty: string | null
          estimated_hours: number | null
          id: string
          org_id: string | null
          prerequisites: Json
          status: string
          steps: Json
          target_certification_slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assessments?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_hours?: number | null
          id?: string
          org_id?: string | null
          prerequisites?: Json
          status?: string
          steps?: Json
          target_certification_slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assessments?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_hours?: number | null
          id?: string
          org_id?: string | null
          prerequisites?: Json
          status?: string
          steps?: Json
          target_certification_slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_certs: {
        Row: {
          active: boolean
          catalog_id: string | null
          catalog_slug: string | null
          code: string | null
          created_at: string
          id: string
          key: string
          name: string
          oem_id: string
          short_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          catalog_id?: string | null
          catalog_slug?: string | null
          code?: string | null
          created_at?: string
          id?: string
          key: string
          name: string
          oem_id: string
          short_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          catalog_id?: string | null
          catalog_slug?: string | null
          code?: string | null
          created_at?: string
          id?: string
          key?: string
          name?: string
          oem_id?: string
          short_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_certs_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "certifications_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_certs_oem_id_fkey"
            columns: ["oem_id"]
            isOneToOne: false
            referencedRelation: "marketplace_oems"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_oems: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          logo_path: string
          name: string
          short_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          logo_path: string
          name: string
          short_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          logo_path?: string
          name?: string
          short_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_skus: {
        Row: {
          active: boolean
          blurb: string
          cert_id: string
          created_at: string
          currency: string
          features: string[]
          fulfilled_on_href: string | null
          fulfilled_on_label: string | null
          id: string
          includes: string[]
          mock_exam_id: string | null
          price_inr: number
          question_bank_id: string | null
          sku_type: string
          study_resource_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          blurb?: string
          cert_id: string
          created_at?: string
          currency?: string
          features?: string[]
          fulfilled_on_href?: string | null
          fulfilled_on_label?: string | null
          id?: string
          includes?: string[]
          mock_exam_id?: string | null
          price_inr?: number
          question_bank_id?: string | null
          sku_type: string
          study_resource_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          blurb?: string
          cert_id?: string
          created_at?: string
          currency?: string
          features?: string[]
          fulfilled_on_href?: string | null
          fulfilled_on_label?: string | null
          id?: string
          includes?: string[]
          mock_exam_id?: string | null
          price_inr?: number
          question_bank_id?: string | null
          sku_type?: string
          study_resource_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_skus_cert_id_fkey"
            columns: ["cert_id"]
            isOneToOne: false
            referencedRelation: "marketplace_certs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_skus_mock_exam_id_fkey"
            columns: ["mock_exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_skus_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_skus_study_resource_id_fkey"
            columns: ["study_resource_id"]
            isOneToOne: false
            referencedRelation: "study_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_reminders: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          dismissed_at: string | null
          id: string
          milestone_id: string | null
          remind_at: string
          sent_at: string | null
          title: string
          user_certification_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          milestone_id?: string | null
          remind_at: string
          sent_at?: string | null
          title: string
          user_certification_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          milestone_id?: string | null
          remind_at?: string
          sent_at?: string | null
          title?: string
          user_certification_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_reminders_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "study_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_reminders_user_certification_id_fkey"
            columns: ["user_certification_id"]
            isOneToOne: false
            referencedRelation: "user_certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exam_questions: {
        Row: {
          correct_answers: Json
          created_at: string
          exam_id: string
          explanation: string | null
          id: string
          marks: number
          negative_marks: number
          options: Json
          order_index: number
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          correct_answers?: Json
          created_at?: string
          exam_id: string
          explanation?: string | null
          id?: string
          marks?: number
          negative_marks?: number
          options?: Json
          order_index?: number
          question_text: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          correct_answers?: Json
          created_at?: string
          exam_id?: string
          explanation?: string | null
          id?: string
          marks?: number
          negative_marks?: number
          options?: Json
          order_index?: number
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "mock_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exam_results: {
        Row: {
          certification_slug: string
          created_at: string
          domain_scores: Json | null
          duration_minutes: number | null
          id: string
          notes: string | null
          passing_score: number
          provider: string | null
          score: number
          taken_at: string
          user_certification_id: string | null
          user_id: string
        }
        Insert: {
          certification_slug: string
          created_at?: string
          domain_scores?: Json | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          passing_score?: number
          provider?: string | null
          score: number
          taken_at?: string
          user_certification_id?: string | null
          user_id: string
        }
        Update: {
          certification_slug?: string
          created_at?: string
          domain_scores?: Json | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          passing_score?: number
          provider?: string | null
          score?: number
          taken_at?: string
          user_certification_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_exam_results_user_certification_id_fkey"
            columns: ["user_certification_id"]
            isOneToOne: false
            referencedRelation: "user_certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_exams: {
        Row: {
          access_tier: string
          attempts_allowed: number
          certification_slug: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          negative_marking: boolean
          org_id: string | null
          passing_score: number
          randomize_questions: boolean
          required_plan: string | null
          status: string
          title: string
          total_marks: number
          total_questions: number
          updated_at: string
        }
        Insert: {
          access_tier?: string
          attempts_allowed?: number
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          negative_marking?: boolean
          org_id?: string | null
          passing_score?: number
          randomize_questions?: boolean
          required_plan?: string | null
          status?: string
          title: string
          total_marks?: number
          total_questions?: number
          updated_at?: string
        }
        Update: {
          access_tier?: string
          attempts_allowed?: number
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          negative_marking?: boolean
          org_id?: string | null
          passing_score?: number
          randomize_questions?: boolean
          required_plan?: string | null
          status?: string
          title?: string
          total_marks?: number
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_exams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          team: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          team?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          team?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_version: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          industry: string | null
          logo_dark_path: string | null
          logo_light_path: string | null
          logo_updated_at: string | null
          name: string
          program_template: Json
          settings: Json
          size_band: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          brand_version?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_dark_path?: string | null
          logo_light_path?: string | null
          logo_updated_at?: string | null
          name: string
          program_template?: Json
          settings?: Json
          size_band?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          brand_version?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_dark_path?: string | null
          logo_light_path?: string | null
          logo_updated_at?: string | null
          name?: string
          program_template?: Json
          settings?: Json
          size_band?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string | null
          learner_id: string
          mode: string
          paid_at: string
          recorded_by: string | null
          remarks: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          learner_id: string
          mode?: string
          paid_at?: string
          recorded_by?: string | null
          remarks?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string | null
          learner_id?: string
          mode?: string
          paid_at?: string
          recorded_by?: string | null
          remarks?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_allowed: boolean
          permission: string
          previous_allowed: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          source: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_allowed: boolean
          permission: string
          previous_allowed?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          source?: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_allowed?: boolean
          permission?: string
          previous_allowed?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          display_name: string | null
          headline: string | null
          id: string
          target_role: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id: string
          target_role?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          headline?: string | null
          id?: string
          target_role?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          active: boolean
          certification_slug: string | null
          correct_answers: Json
          created_at: string
          created_by: string | null
          difficulty: string | null
          explanation: string | null
          id: string
          options: Json
          org_id: string | null
          question_text: string
          question_type: string
          reference_url: string | null
          tags: string[]
          topic: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          certification_slug?: string | null
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          org_id?: string | null
          question_text: string
          question_type?: string
          reference_url?: string | null
          tags?: string[]
          topic?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          certification_slug?: string | null
          correct_answers?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          options?: Json
          org_id?: string | null
          question_text?: string
          question_type?: string
          reference_url?: string | null
          tags?: string[]
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          role: Database["public"]["Enums"]["app_role"]
          source: string
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          role: Database["public"]["Enums"]["app_role"]
          source?: string
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          role?: Database["public"]["Enums"]["app_role"]
          source?: string
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          description: string | null
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed?: boolean
          description?: string | null
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed?: boolean
          description?: string | null
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      security_finding_events: {
        Row: {
          actor_id: string | null
          created_at: string
          finding_id: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          finding_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          finding_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_finding_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "security_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      security_findings: {
        Row: {
          created_at: string
          description: string | null
          external_id: string
          first_seen_at: string
          id: string
          last_seen_at: string
          level: string
          link: string | null
          metadata: Json
          notes: string | null
          resolved_at: string | null
          scanner_name: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          level?: string
          link?: string | null
          metadata?: Json
          notes?: string | null
          resolved_at?: string | null
          scanner_name: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          level?: string
          link?: string | null
          metadata?: Json
          notes?: string | null
          resolved_at?: string | null
          scanner_name?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_milestones: {
        Row: {
          certification_slug: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          milestone_type: string
          order_index: number
          source: string
          title: string
          updated_at: string
          user_certification_id: string
          user_id: string
        }
        Insert: {
          certification_slug: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: string
          order_index?: number
          source?: string
          title: string
          updated_at?: string
          user_certification_id: string
          user_id: string
        }
        Update: {
          certification_slug?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          milestone_type?: string
          order_index?: number
          source?: string
          title?: string
          updated_at?: string
          user_certification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_milestones_user_certification_id_fkey"
            columns: ["user_certification_id"]
            isOneToOne: false
            referencedRelation: "user_certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      study_resources: {
        Row: {
          access_tier: string
          certification_slug: string | null
          created_at: string
          created_by: string | null
          description: string | null
          download_allowed: boolean
          downloads_count: number
          duration_seconds: number | null
          external_url: string | null
          file_mime: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          module: string | null
          required_plan: string | null
          resource_type: string
          status: string
          storage_path: string | null
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
          views_count: number
        }
        Insert: {
          access_tier?: string
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_allowed?: boolean
          downloads_count?: number
          duration_seconds?: number | null
          external_url?: string | null
          file_mime?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          module?: string | null
          required_plan?: string | null
          resource_type: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          views_count?: number
        }
        Update: {
          access_tier?: string
          certification_slug?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_allowed?: boolean
          downloads_count?: number
          duration_seconds?: number | null
          external_url?: string | null
          file_mime?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          module?: string | null
          required_plan?: string | null
          resource_type?: string
          status?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          environment: string
          id: string
          payload: Json
          received_at: string
          stripe_event_id: string
          subscription_id: string | null
          type: string
        }
        Insert: {
          environment?: string
          id?: string
          payload: Json
          received_at?: string
          stripe_event_id: string
          subscription_id?: string | null
          type: string
        }
        Update: {
          environment?: string
          id?: string
          payload?: Json
          received_at?: string
          stripe_event_id?: string
          subscription_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          label: string
          plan_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          label: string
          plan_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          label?: string
          plan_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          org_id: string | null
          plan_code: string
          price_id: string | null
          product_id: string | null
          scope: string
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_interval: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id?: string | null
          plan_code: string
          price_id?: string | null
          product_id?: string | null
          scope: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id?: string | null
          plan_code?: string
          price_id?: string | null
          product_id?: string | null
          scope?: string
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          source: string
          target_email: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          target_email?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          source?: string
          target_email?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      super_admin_subscription: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_key: string
          status: string
          super_admin_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key: string
          status?: string
          super_admin_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string
          status?: string
          super_admin_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_subscription_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["plan_key"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_bookmarks: {
        Row: {
          certification_slug: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          certification_slug: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          certification_slug?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_certifications: {
        Row: {
          certification_slug: string
          completed_at: string | null
          created_at: string
          id: string
          mock_score: number | null
          notes: string | null
          remind_at: string | null
          status: Database["public"]["Enums"]["cert_status"]
          study_hours: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certification_slug: string
          completed_at?: string | null
          created_at?: string
          id?: string
          mock_score?: number | null
          notes?: string | null
          remind_at?: string | null
          status?: Database["public"]["Enums"]["cert_status"]
          study_hours?: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certification_slug?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          mock_score?: number | null
          notes?: string | null
          remind_at?: string | null
          status?: Database["public"]["Enums"]["cert_status"]
          study_hours?: number
          target_date?: string | null
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
      workforce_certifications: {
        Row: {
          certification_slug: string
          created_at: string
          expires_at: string | null
          id: string
          member_id: string
          obtained_on: string | null
          org_id: string
          status: string
        }
        Insert: {
          certification_slug: string
          created_at?: string
          expires_at?: string | null
          id?: string
          member_id: string
          obtained_on?: string | null
          org_id: string
          status?: string
        }
        Update: {
          certification_slug?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          member_id?: string
          obtained_on?: string | null
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_certifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_certifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: {
          _industry?: string
          _name: string
          _size_band?: string
          _slug: string
        }
        Returns: {
          id: string
          slug: string
        }[]
      }
      has_active_entitlement: {
        Args: { _plan?: string; _user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _uid: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: {
          _org: string
          _roles?: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      join_demo_organization: {
        Args: never
        Returns: {
          slug: string
        }[]
      }
      upsert_security_finding: {
        Args: {
          _description: string
          _external_id: string
          _level: string
          _link: string
          _metadata: Json
          _scanner: string
          _title: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "learner"
        | "manager"
        | "admin"
        | "content_admin"
        | "finance_admin"
        | "support_admin"
        | "certification_admin"
        | "lab_admin"
        | "operations_admin"
      cert_status: "planned" | "studying" | "scheduled" | "passed" | "failed"
      org_role: "exec" | "hr" | "manager" | "lnd" | "learner"
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
  public: {
    Enums: {
      app_role: [
        "learner",
        "manager",
        "admin",
        "content_admin",
        "finance_admin",
        "support_admin",
        "certification_admin",
        "lab_admin",
        "operations_admin",
      ],
      cert_status: ["planned", "studying", "scheduled", "passed", "failed"],
      org_role: ["exec", "hr", "manager", "lnd", "learner"],
    },
  },
} as const
