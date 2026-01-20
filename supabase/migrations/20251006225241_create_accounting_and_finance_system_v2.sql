/*
  # Create Accounting and Finance System

  1. New Tables
    - `cash_registers`
      - Daily cash register management
      - Opening/closing balance
      - Status tracking
    
    - `transactions`
      - All financial transactions (income/expenses)
      - Type, category, amount
      - Links to payments, etc.
    
    - `expense_categories`
      - Categories for expense classification
    
    - `income_categories`
      - Categories for income classification
    
    - `reconciliations`
      - Bank/cash reconciliation records
    
    - `tax_records`
      - Tax compliance and records
    
    - `financial_periods`
      - Fiscal periods for reporting

  2. Security
    - Enable RLS on all tables
    - Policies for company-based access
    - Admin and manager can manage
    - Other roles can view only
*/

-- Create expense categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON expense_categories(company_id);

-- Create income categories table
CREATE TABLE IF NOT EXISTS income_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_categories_company ON income_categories(company_id);

-- Create cash registers table
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES user_profiles(id),
  closed_by uuid REFERENCES user_profiles(id),
  opening_balance decimal(10,2) NOT NULL DEFAULT 0,
  closing_balance decimal(10,2),
  expected_balance decimal(10,2),
  difference decimal(10,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_company ON cash_registers(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_branch ON cash_registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  cash_register_id uuid REFERENCES cash_registers(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id uuid,
  reference_type text,
  reference_id uuid,
  amount decimal(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  reference text,
  description text NOT NULL,
  notes text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  is_reconciled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cash_register ON transactions(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);

-- Create reconciliations table
CREATE TABLE IF NOT EXISTS reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cash', 'bank', 'card')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  system_balance decimal(10,2) NOT NULL,
  actual_balance decimal(10,2) NOT NULL,
  difference decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'approved')),
  notes text,
  reconciled_by uuid NOT NULL REFERENCES user_profiles(id),
  approved_by uuid REFERENCES user_profiles(id),
  reconciled_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_company ON reconciliations(company_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_branch ON reconciliations(branch_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_reconciliations_period ON reconciliations(period_start, period_end);

-- Create financial periods table
CREATE TABLE IF NOT EXISTS financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean DEFAULT false,
  closed_by uuid REFERENCES user_profiles(id),
  closed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_periods_company ON financial_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_dates ON financial_periods(start_date, end_date);

-- Create tax records table
CREATE TABLE IF NOT EXISTS tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_type text NOT NULL,
  tax_period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_income decimal(10,2) DEFAULT 0,
  taxable_income decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filed', 'paid')),
  due_date date,
  filed_date date,
  paid_date date,
  reference text,
  notes text,
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_records_company ON tax_records(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_records_period ON tax_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_records_status ON tax_records(status);

-- Insert default expense categories
INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Salarios y Nómina', 'Pagos a empleados y nómina'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Salarios y Nómina'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Suministros', 'Materiales y suministros de lavado'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Suministros'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Servicios Públicos', 'Agua, electricidad, gas'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Servicios Públicos'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Mantenimiento', 'Mantenimiento de equipos e instalaciones'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Mantenimiento'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Renta', 'Alquiler de local'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Renta'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Marketing', 'Publicidad y marketing'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Marketing'
);

INSERT INTO expense_categories (company_id, name, description) 
SELECT c.id, 'Otros', 'Gastos varios'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE company_id = c.id AND name = 'Otros'
);

-- Insert default income categories
INSERT INTO income_categories (company_id, name, description) 
SELECT c.id, 'Servicios de Lavado', 'Ingresos por servicios de lavado'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM income_categories 
  WHERE company_id = c.id AND name = 'Servicios de Lavado'
);

INSERT INTO income_categories (company_id, name, description) 
SELECT c.id, 'Paquetes', 'Ingresos por paquetes de servicios'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM income_categories 
  WHERE company_id = c.id AND name = 'Paquetes'
);

INSERT INTO income_categories (company_id, name, description) 
SELECT c.id, 'Productos', 'Venta de productos adicionales'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM income_categories 
  WHERE company_id = c.id AND name = 'Productos'
);

INSERT INTO income_categories (company_id, name, description) 
SELECT c.id, 'Otros', 'Ingresos varios'
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM income_categories 
  WHERE company_id = c.id AND name = 'Otros'
);

-- Enable RLS on all tables
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Company users can view expense categories"
  ON expense_categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage expense categories"
  ON expense_categories FOR ALL
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

-- RLS Policies for income_categories
CREATE POLICY "Company users can view income categories"
  ON income_categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage income categories"
  ON income_categories FOR ALL
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

-- RLS Policies for cash_registers
CREATE POLICY "Company users can view cash registers"
  ON cash_registers FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins, managers and cashiers can manage cash registers"
  ON cash_registers FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'cashier')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'cashier')
    )
  );

-- RLS Policies for transactions
CREATE POLICY "Company users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'cashier')
    )
  );

CREATE POLICY "Admins and managers can update transactions"
  ON transactions FOR UPDATE
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

CREATE POLICY "Admins can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for reconciliations
CREATE POLICY "Company users can view reconciliations"
  ON reconciliations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can manage reconciliations"
  ON reconciliations FOR ALL
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

-- RLS Policies for financial_periods
CREATE POLICY "Company users can view financial periods"
  ON financial_periods FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage financial periods"
  ON financial_periods FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for tax_records
CREATE POLICY "Company users can view tax records"
  ON tax_records FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage tax records"
  ON tax_records FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
