export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'root' | 'admin' | 'supervisor' | 'cashier' | 'operator' | 'marketing' | 'accountant';

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          legal_name: string | null
          tax_id: string | null
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          subscription_type: string
          subscription_start_date: string
          subscription_end_date: string | null
          auto_deactivate: boolean
          deactivation_reason: string | null
          deactivated_at: string | null
          deactivated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          legal_name?: string | null
          tax_id?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          subscription_type?: string
          subscription_start_date?: string
          subscription_end_date?: string | null
          auto_deactivate?: boolean
          deactivation_reason?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          legal_name?: string | null
          tax_id?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          is_active?: boolean
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          subscription_start_date?: string
          subscription_end_date?: string | null
          auto_deactivate?: boolean
          deactivation_reason?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          company_id: string | null
          name: string
          address: string
          phone: string | null
          email: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          address: string
          phone?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          address?: string
          phone?: string | null
          email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          company_id: string | null
          branch_id: string | null
          phone: string | null
          email: string | null
          permissions: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: UserRole
          company_id?: string | null
          branch_id?: string | null
          phone?: string | null
          email?: string | null
          permissions?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          company_id?: string | null
          branch_id?: string | null
          phone?: string | null
          email?: string | null
          permissions?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          base_price: number
          duration_minutes: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price?: number
          duration_minutes?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          base_price?: number
          duration_minutes?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      branch_services: {
        Row: {
          id: string
          branch_id: string
          service_id: string
          price: number
          is_available: boolean
          created_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          service_id: string
          price: number
          is_available?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          service_id?: string
          price?: number
          is_available?: boolean
          created_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string
          vehicle_info: Json
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone: string
          vehicle_info?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string
          vehicle_info?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      appointments: {
        Row: {
          id: string
          branch_id: string
          customer_id: string
          vehicle_plate: string
          scheduled_date: string
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          total_amount: number
          payment_status: 'pending' | 'paid' | 'refunded'
          payment_method: 'cash' | 'card' | 'transfer' | null
          notes: string | null
          created_by: string
          completed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          customer_id: string
          vehicle_plate: string
          scheduled_date: string
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          total_amount?: number
          payment_status?: 'pending' | 'paid' | 'refunded'
          payment_method?: 'cash' | 'card' | 'transfer' | null
          notes?: string | null
          created_by: string
          completed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          customer_id?: string
          vehicle_plate?: string
          scheduled_date?: string
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          total_amount?: number
          payment_status?: 'pending' | 'paid' | 'refunded'
          payment_method?: 'cash' | 'card' | 'transfer' | null
          notes?: string | null
          created_by?: string
          completed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      appointment_services: {
        Row: {
          id: string
          appointment_id: string
          service_id: string
          price: number
          status: 'pending' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          appointment_id: string
          service_id: string
          price: number
          status?: 'pending' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string
          service_id?: string
          price?: number
          status?: 'pending' | 'completed'
          created_at?: string
        }
      },
      invoice_requests: {
        Row: {
          id: string
          company_id: string
          order_id: string
          status: 'pendiente' | 'procesado' | 'cancelado'
          requested_at: string
          processed_by: string | null
          processed_at: string | null
          processed_notes: string | null
          rfc: string
          razon_social: string
          regimen_fiscal: string
          uso_cfdi: string
          calle: string | null
          numero_exterior: string | null
          numero_interior: string | null
          colonia: string | null
          codigo_postal: string
          municipio: string | null
          estado: string | null
          email: string
          telefono: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          company_id: string
          order_id: string
          status?: 'pendiente' | 'procesado' | 'cancelado'
          requested_at?: string
          processed_by?: string | null
          processed_at?: string | null
          processed_notes?: string | null
          rfc: string
          razon_social: string
          regimen_fiscal: string
          uso_cfdi: string
          calle?: string | null
          numero_exterior?: string | null
          numero_interior?: string | null
          colonia?: string | null
          codigo_postal: string
          municipio?: string | null
          estado?: string | null
          email: string
          telefono?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          order_id?: string
          status?: 'pendiente' | 'procesado' | 'cancelado'
          requested_at?: string
          processed_by?: string | null
          processed_at?: string | null
          processed_notes?: string | null
          rfc?: string
          razon_social?: string
          regimen_fiscal?: string
          uso_cfdi?: string
          calle?: string | null
          numero_exterior?: string | null
          numero_interior?: string | null
          colonia?: string | null
          codigo_postal?: string
          municipio?: string | null
          estado?: string | null
          email?: string
          telefono?: string | null
          notes?: string | null
        }
      },
      service_orders: {
        Row: {
          id: string
          company_id: string
          customer_id: string
          invoiced_at: string | null
          total: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id: string
          invoiced_at?: string | null
          total?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string
          invoiced_at?: string | null
          total?: number
          status?: string
          created_at?: string
        }
      },
      company_settings: {
        Row: {
          company_id: string
          ticket_header_text: string | null
          ticket_footer_text: string | null
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          ticket_header_text?: string | null
          ticket_footer_text?: string | null
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          ticket_header_text?: string | null
          ticket_footer_text?: string | null
          logo_url?: string | null
          updated_at?: string
        }
      }
    }
  }
}
