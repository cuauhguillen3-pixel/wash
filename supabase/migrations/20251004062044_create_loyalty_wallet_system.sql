/*
  # Create Loyalty Wallet System

  1. New Tables
    - `loyalty_programs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - Nombre del programa
      - `description` (text) - Descripción
      - `points_per_currency` (numeric) - Puntos por cada unidad de moneda gastada
      - `currency_per_point` (numeric) - Valor de cada punto en moneda
      - `min_points_redeem` (integer) - Mínimo de puntos para canjear
      - `expiration_days` (integer) - Días para expiración de puntos (null = no expira)
      - `is_active` (boolean) - Estado del programa
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `customer_wallets`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `company_id` (uuid, references companies)
      - `loyalty_program_id` (uuid, references loyalty_programs)
      - `total_points` (integer) - Total de puntos acumulados
      - `available_points` (integer) - Puntos disponibles para usar
      - `lifetime_points` (integer) - Total histórico de puntos ganados
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `wallet_id` (uuid, references customer_wallets)
      - `customer_id` (uuid, references customers)
      - `company_id` (uuid, references companies)
      - `transaction_type` (text) - 'earn', 'redeem', 'expire', 'adjust'
      - `points` (integer) - Cantidad de puntos (positivo o negativo)
      - `balance_after` (integer) - Balance después de la transacción
      - `description` (text) - Descripción de la transacción
      - `reference_type` (text) - Tipo de referencia (appointment, purchase, etc)
      - `reference_id` (uuid) - ID de referencia
      - `expires_at` (timestamptz) - Fecha de expiración (para puntos ganados)
      - `created_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control
*/

-- Create loyalty_programs table
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  points_per_currency numeric(10,2) DEFAULT 1.00 NOT NULL,
  currency_per_point numeric(10,2) DEFAULT 1.00 NOT NULL,
  min_points_redeem integer DEFAULT 100 NOT NULL,
  expiration_days integer,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create customer_wallets table
CREATE TABLE IF NOT EXISTS customer_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  loyalty_program_id uuid REFERENCES loyalty_programs(id) ON DELETE SET NULL,
  total_points integer DEFAULT 0 NOT NULL,
  available_points integer DEFAULT 0 NOT NULL,
  lifetime_points integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(customer_id, company_id)
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES customer_wallets(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'adjust')),
  points integer NOT NULL,
  balance_after integer NOT NULL,
  description text,
  reference_type text,
  reference_id uuid,
  expires_at timestamptz,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_company ON loyalty_programs(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer ON customer_wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_company ON customer_wallets(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer ON wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_company ON wallet_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for loyalty_programs
CREATE POLICY "Root can view all loyalty programs"
  ON loyalty_programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Admin can view company loyalty programs"
  ON loyalty_programs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin can insert loyalty programs"
  ON loyalty_programs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update loyalty programs"
  ON loyalty_programs FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policies for customer_wallets
CREATE POLICY "Root can view all wallets"
  ON customer_wallets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company wallets"
  ON customer_wallets FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert wallets"
  ON customer_wallets FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Company users can update wallets"
  ON customer_wallets FOR UPDATE
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

-- Policies for wallet_transactions
CREATE POLICY "Root can view all transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Function to update wallet updated_at
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for customer_wallets
DROP TRIGGER IF EXISTS update_customer_wallets_timestamp ON customer_wallets;
CREATE TRIGGER update_customer_wallets_timestamp
  BEFORE UPDATE ON customer_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_timestamp();

-- Trigger for loyalty_programs
DROP TRIGGER IF EXISTS update_loyalty_programs_timestamp ON loyalty_programs;
CREATE TRIGGER update_loyalty_programs_timestamp
  BEFORE UPDATE ON loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_timestamp();
