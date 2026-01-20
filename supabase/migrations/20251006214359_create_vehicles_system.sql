/*
  # Create Vehicles Management System

  1. New Tables
    - `vehicles`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `customer_id` (uuid, references customers)
      - `license_plate` (text, unique per company) - Placa/Matrícula
      - `brand` (text) - Marca (Toyota, Honda, etc)
      - `model` (text) - Modelo (Corolla, Civic, etc)
      - `year` (integer) - Año del vehículo
      - `color` (text) - Color
      - `vehicle_type` (text) - Tipo (sedan, suv, truck, motorcycle, van)
      - `vin` (text) - Número de serie del vehículo (opcional)
      - `sticker_code` (text, unique) - Código del sticker para identificación
      - `photo_url` (text) - URL de la foto del vehículo
      - `notes` (text) - Notas adicionales
      - `is_active` (boolean) - Estado del vehículo
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `vehicle_scans`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `vehicle_id` (uuid, references vehicles)
      - `branch_id` (uuid, references branches)
      - `scan_type` (text) - 'lpr' (plate recognition) o 'sticker'
      - `scan_value` (text) - Placa o código escaneado
      - `scan_result` (text) - 'success', 'not_found', 'error'
      - `scanned_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control

  3. Indexes
    - Index on license_plate for quick searches
    - Index on sticker_code for scanner lookups
    - Index on customer_id for customer vehicles
*/

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  license_plate text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  color text,
  vehicle_type text CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'motorcycle', 'van', 'other')) DEFAULT 'sedan',
  vin text,
  sticker_code text UNIQUE,
  photo_url text,
  notes text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, license_plate)
);

-- Create vehicle_scans table
CREATE TABLE IF NOT EXISTS vehicle_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  scan_type text CHECK (scan_type IN ('lpr', 'sticker')) NOT NULL,
  scan_value text NOT NULL,
  scan_result text CHECK (scan_result IN ('success', 'not_found', 'error')) DEFAULT 'success',
  scanned_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_company ON vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_vehicles_sticker_code ON vehicles(sticker_code) WHERE sticker_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_company ON vehicle_scans(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_vehicle ON vehicle_scans(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_scans_created_at ON vehicle_scans(created_at DESC);

-- Enable RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_scans ENABLE ROW LEVEL SECURITY;

-- Policies for vehicles
CREATE POLICY "Root can view all vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company vehicles"
  ON vehicles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert vehicles"
  ON vehicles FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "Company users can update vehicles"
  ON vehicles FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

CREATE POLICY "Admins can delete vehicles"
  ON vehicles FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policies for vehicle_scans
CREATE POLICY "Root can view all scans"
  ON vehicle_scans FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company scans"
  ON vehicle_scans FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert scans"
  ON vehicle_scans FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Function to update vehicles updated_at
CREATE OR REPLACE FUNCTION update_vehicle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for vehicles
DROP TRIGGER IF EXISTS update_vehicles_timestamp ON vehicles;
CREATE TRIGGER update_vehicles_timestamp
  BEFORE UPDATE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_vehicle_timestamp();

-- Function to generate unique sticker code
CREATE OR REPLACE FUNCTION generate_sticker_code()
RETURNS text AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := 'STK-' || upper(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(
      SELECT 1 FROM vehicles WHERE sticker_code = new_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;
