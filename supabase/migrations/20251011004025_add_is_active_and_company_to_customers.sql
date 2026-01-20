/*
  # Add is_active and company_id to customers table

  1. Changes
    - Add `is_active` column to customers table with default TRUE
    - Add `company_id` column to customers table
    - Update existing customers to set is_active = TRUE
    - Create index on is_active for better query performance
  
  2. Security
    - No RLS changes needed (already configured)
*/

-- Add is_active column with default TRUE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add company_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing customers to be active
UPDATE customers SET is_active = true WHERE is_active IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
