/*
  # Create Company Settings Table

  1. New Tables
    - `company_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies) - Company this setting belongs to
      - `logo_url` (text) - URL to the company logo in storage
      - `ticket_header_text` (text) - Header text for tickets/PDFs
      - `ticket_footer_text` (text) - Footer text for tickets/PDFs
      - `created_at` (timestamptz) - When settings were created
      - `updated_at` (timestamptz) - When settings were last updated

  2. Security
    - Enable RLS on `company_settings` table
    - Add policy for root users to view all settings
    - Add policy for admin users to view their company settings
    - Add policy for admin users to insert their company settings
    - Add policy for admin users to update their company settings

  3. Storage
    - Create storage bucket for company logos
    - Add RLS policies for logo uploads
*/

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  logo_url text,
  ticket_header_text text DEFAULT '',
  ticket_footer_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Root users can view all settings
CREATE POLICY "Root users can view all company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
      AND user_profiles.is_active = true
    )
  );

-- Admin users can view their company settings
CREATE POLICY "Admin users can view their company settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = company_settings.company_id
      AND user_profiles.role IN ('admin', 'supervisor', 'cashier', 'operator', 'marketing', 'accountant')
      AND user_profiles.is_active = true
    )
  );

-- Admin users can insert settings for their company
CREATE POLICY "Admin users can create company settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = company_settings.company_id
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- Admin users can update their company settings
CREATE POLICY "Admin users can update company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = company_settings.company_id
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = company_settings.company_id
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- Root users can update any company settings
CREATE POLICY "Root users can update any company settings"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
      AND user_profiles.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
      AND user_profiles.is_active = true
    )
  );

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos for their company
CREATE POLICY "Users can upload logos for their company"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'root')
        AND user_profiles.is_active = true
      )
    )
  );

-- Allow authenticated users to update logos for their company
CREATE POLICY "Users can update logos for their company"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'root')
        AND user_profiles.is_active = true
      )
    )
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'root')
        AND user_profiles.is_active = true
      )
    )
  );

-- Allow everyone to view logos (public bucket)
CREATE POLICY "Anyone can view company logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

-- Allow authenticated users to delete logos for their company
CREATE POLICY "Users can delete logos for their company"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'root')
        AND user_profiles.is_active = true
      )
    )
  );
