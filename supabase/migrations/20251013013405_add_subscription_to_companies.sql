/*
  # Add Subscription Management to Companies

  ## Changes

  1. Add subscription fields to companies table:
    - `subscription_type` - tipo de suscripción (anual, mensual, indeterminado)
    - `subscription_start_date` - fecha de inicio de suscripción
    - `subscription_end_date` - fecha de vencimiento de suscripción
    - `auto_deactivate` - si se debe desactivar automáticamente al vencer
    - `deactivation_reason` - razón de desactivación (manual, expirado, etc)
    - `deactivated_at` - fecha de desactivación
    - `deactivated_by` - usuario que desactivó (para desactivación manual)

  2. Set default values:
    - New companies get 1 year subscription by default
    - Auto-deactivate enabled by default

  3. Update existing companies:
    - Set subscription_start_date to created_at
    - Set subscription_end_date to 1 year from created_at
    - Set subscription_type to 'anual'

  ## Notes
  - Root users can modify subscription settings
  - System will automatically deactivate expired companies
  - Users from deactivated companies cannot log in
*/

-- Add subscription columns to companies table
DO $$
BEGIN
  -- Add subscription_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_type'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN subscription_type text DEFAULT 'anual' CHECK (subscription_type IN ('anual', 'mensual', 'indeterminado'));
  END IF;

  -- Add subscription_start_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_start_date'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN subscription_start_date timestamptz DEFAULT now();
  END IF;

  -- Add subscription_end_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN subscription_end_date timestamptz;
  END IF;

  -- Add auto_deactivate column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'auto_deactivate'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN auto_deactivate boolean DEFAULT true;
  END IF;

  -- Add deactivation_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'deactivation_reason'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN deactivation_reason text;
  END IF;

  -- Add deactivated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN deactivated_at timestamptz;
  END IF;

  -- Add deactivated_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'deactivated_by'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN deactivated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update existing companies with default subscription (1 year from creation)
UPDATE companies
SET
  subscription_start_date = created_at,
  subscription_end_date = created_at + interval '1 year',
  subscription_type = 'anual',
  auto_deactivate = true
WHERE subscription_end_date IS NULL;

-- Create index for efficient expiration checks
CREATE INDEX IF NOT EXISTS idx_companies_subscription_end ON companies(subscription_end_date)
WHERE is_active = true AND auto_deactivate = true;

-- Create function to check if company is expired
CREATE OR REPLACE FUNCTION is_company_expired(company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_record record;
BEGIN
  SELECT
    is_active,
    subscription_type,
    subscription_end_date,
    auto_deactivate
  INTO company_record
  FROM companies
  WHERE id = company_id;

  -- If company doesn't exist or is already inactive, return true
  IF NOT FOUND OR NOT company_record.is_active THEN
    RETURN true;
  END IF;

  -- If subscription is indeterminado, never expires
  IF company_record.subscription_type = 'indeterminado' THEN
    RETURN false;
  END IF;

  -- If auto_deactivate is disabled, don't expire
  IF NOT company_record.auto_deactivate THEN
    RETURN false;
  END IF;

  -- Check if subscription has expired
  IF company_record.subscription_end_date IS NOT NULL
     AND company_record.subscription_end_date < now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Create function to deactivate expired company
CREATE OR REPLACE FUNCTION deactivate_expired_company(company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE companies
  SET
    is_active = false,
    deactivation_reason = 'Suscripción expirada',
    deactivated_at = now()
  WHERE id = company_id
    AND is_active = true
    AND auto_deactivate = true
    AND subscription_end_date < now()
    AND subscription_type != 'indeterminado';
END;
$$;

-- Add comment to table
COMMENT ON COLUMN companies.subscription_type IS 'Tipo de suscripción: anual, mensual, indeterminado';
COMMENT ON COLUMN companies.subscription_start_date IS 'Fecha de inicio de la suscripción';
COMMENT ON COLUMN companies.subscription_end_date IS 'Fecha de vencimiento de la suscripción';
COMMENT ON COLUMN companies.auto_deactivate IS 'Si debe desactivarse automáticamente al vencer';
COMMENT ON COLUMN companies.deactivation_reason IS 'Razón de la desactivación';
COMMENT ON COLUMN companies.deactivated_at IS 'Fecha y hora de desactivación';
COMMENT ON COLUMN companies.deactivated_by IS 'Usuario que desactivó la empresa (para desactivación manual)';