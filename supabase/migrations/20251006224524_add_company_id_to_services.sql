/*
  # Add company_id to services table

  1. Changes
    - Add company_id column to services table
    - Add foreign key constraint to companies table
    - Add index on company_id
    - Update existing services to have company_id (if any exist)
    - Add NOT NULL constraint after data migration

  2. Security
    - Update RLS policies to filter by company_id
*/

-- Add company_id column (nullable first to allow data migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE services ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing services to associate with first company (if any services exist)
DO $$
DECLARE
  first_company_id uuid;
BEGIN
  SELECT id INTO first_company_id FROM companies LIMIT 1;
  
  IF first_company_id IS NOT NULL THEN
    UPDATE services SET company_id = first_company_id WHERE company_id IS NULL;
  END IF;
END $$;

-- Now make company_id NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'company_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE services ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Add index
CREATE INDEX IF NOT EXISTS idx_services_company ON services(company_id);

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Anyone can view active services" ON services;
DROP POLICY IF EXISTS "Admins can manage services" ON services;
DROP POLICY IF EXISTS "Users can view services" ON services;

-- Enable RLS if not already enabled
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Create new policies based on company_id
CREATE POLICY "Root can view all services"
  ON services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company services"
  ON services FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can manage services"
  ON services FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
