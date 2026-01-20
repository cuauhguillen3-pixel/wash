/*
  # Create Invoice Requests System

  1. New Tables
    - `invoice_requests`
      - Solicitudes de facturación de órdenes de servicio
      - Datos fiscales del cliente (RFC, razón social, dirección, etc.)
      - Estado de la solicitud (pendiente/procesado/cancelado)
      - Referencia a la orden de servicio
      - Datos para timbrado (futuro)
    
  2. Security
    - Enable RLS on invoice_requests table
    - Policies for company-based access
    - Admin and managers can view and manage
    - Operators can create requests

  3. Important Notes
    - Esta tabla guarda las solicitudes de facturación
    - Los datos fiscales se capturan al solicitar factura
    - El campo 'status' controla el flujo: pendiente → procesado/cancelado
    - El campo 'cfdi_uuid' se usará en el futuro para el timbrado
*/

-- Create invoice_requests table
CREATE TABLE IF NOT EXISTS invoice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  
  -- Datos fiscales
  rfc text NOT NULL,
  razon_social text NOT NULL,
  regimen_fiscal text,
  uso_cfdi text NOT NULL DEFAULT 'G03',
  
  -- Dirección fiscal
  calle text,
  numero_exterior text,
  numero_interior text,
  colonia text,
  codigo_postal text NOT NULL,
  municipio text,
  estado text,
  pais text DEFAULT 'México',
  
  -- Contacto
  email text NOT NULL,
  telefono text,
  
  -- Control
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'procesado', 'cancelado')),
  folio_fiscal text,
  cfdi_uuid text,
  cfdi_xml text,
  cfdi_pdf text,
  
  -- Notas y observaciones
  notes text,
  processed_notes text,
  
  -- Auditoría
  requested_by uuid NOT NULL REFERENCES user_profiles(id),
  processed_by uuid REFERENCES user_profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_requests_company ON invoice_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_order ON invoice_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_rfc ON invoice_requests(rfc);

-- Enable RLS
ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company users can view invoice requests"
  ON invoice_requests FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can create invoice requests"
  ON invoice_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'cashier')
    )
  );

CREATE POLICY "Admins and managers can update invoice requests"
  ON invoice_requests FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete invoice requests"
  ON invoice_requests FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
