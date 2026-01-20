/*
  # Update Role System and Add Companies

  ## Overview
  Multi-company, multi-branch role-based access control system

  ## New Tables

  ### 1. `companies`
  Company/Enterprise management
  - `id` (uuid, primary key)
  - `name` (text) - Company name
  - `legal_name` (text) - Legal business name
  - `tax_id` (text) - RFC/Tax ID
  - `address` (text)
  - `phone` (text)
  - `email` (text)
  - `logo_url` (text)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Modified Tables

  ### 1. `branches`
  Added company relationship
  - `company_id` (uuid, references companies)

  ### 2. `user_profiles`
  Updated role system with 7 new roles
  - `role` - Updated to support: root, admin, supervisor, cashier, operator, marketing, accountant
  - `company_id` (uuid, references companies) - For root/admin roles
  - `permissions` (jsonb) - Custom permission overrides

  ## New Role Structure

  1. **Root** - Super admin, all companies and branches
  2. **Admin** - Company admin, manages their company/branches, configuration, prices, users
  3. **Supervisor** - Daily operations, cash register, cuts, discount authorizations
  4. **Cashier** - Sales, payments, invoices, cash register open/close
  5. **Operator** - Takes/advances orders, vehicle check-in/out, supplies consumption
  6. **Marketing** - Campaigns, coupons, customer segments
  7. **Accountant** - Reports, journal entries, taxes

  ## Security Updates

  RLS policies updated to support multi-company hierarchy and new roles
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  address text,
  phone text,
  email text,
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add company_id to branches
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'branches' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE branches ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update user_profiles role constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('root', 'admin', 'supervisor', 'cashier', 'operator', 'marketing', 'accountant'));

-- Add company_id and permissions to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active);
CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON user_profiles(company_id);

-- Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies to recreate with new structure
DROP POLICY IF EXISTS "Admins can manage all branches" ON branches;
DROP POLICY IF EXISTS "Managers and employees can view their branch" ON branches;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view profiles in their branch" ON user_profiles;

-- RLS Policies for companies
CREATE POLICY "Root can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'root'
        OR (user_profiles.role = 'admin' AND user_profiles.company_id = companies.id)
      )
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'root'
        OR (user_profiles.role = 'admin' AND user_profiles.company_id = companies.id)
      )
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for branches (updated)
CREATE POLICY "Root and admins can manage branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'root'
        OR (up.role = 'admin' AND up.company_id = branches.company_id)
      )
      AND up.is_active = true
    )
  );

CREATE POLICY "Staff can view their branch"
  ON branches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'root'
        OR (up.role = 'admin' AND up.company_id = branches.company_id)
        OR up.branch_id = branches.id
      )
      AND up.is_active = true
    )
  );

-- RLS Policies for user_profiles (updated)
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Root can manage all users"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'root'
      AND up.is_active = true
    )
  );

CREATE POLICY "Admins can manage users in their company"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.company_id = user_profiles.company_id
      AND up.is_active = true
    )
  );

CREATE POLICY "Supervisors can view users in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('admin', 'supervisor')
      AND up.company_id = user_profiles.company_id
      AND up.is_active = true
    )
  );

-- Update services policies
DROP POLICY IF EXISTS "Authenticated users can view active services" ON services;
DROP POLICY IF EXISTS "Admins can manage services" ON services;

CREATE POLICY "Users can view active services"
  ON services FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Root and admins can manage services"
  ON services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('root', 'admin')
      AND user_profiles.is_active = true
    )
  );

-- Update customers policies
DROP POLICY IF EXISTS "Users can view customers in their branch context" ON customers;
DROP POLICY IF EXISTS "Staff can create customers" ON customers;
DROP POLICY IF EXISTS "Staff can update customers" ON customers;

CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff can create customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('root', 'admin', 'supervisor', 'cashier', 'operator')
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('root', 'admin', 'supervisor', 'cashier', 'operator')
      AND user_profiles.is_active = true
    )
  );

-- Update appointments policies
DROP POLICY IF EXISTS "Users can view appointments for their branch" ON appointments;
DROP POLICY IF EXISTS "Staff can create appointments" ON appointments;
DROP POLICY IF EXISTS "Staff can update appointments in their branch" ON appointments;

CREATE POLICY "Users can view appointments for their scope"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN branches b ON b.id = appointments.branch_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'root'
        OR (up.role = 'admin' AND up.company_id = b.company_id)
        OR up.branch_id = appointments.branch_id
      )
      AND up.is_active = true
    )
  );

CREATE POLICY "Staff can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN branches b ON b.id = appointments.branch_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'root'
        OR (up.role = 'admin' AND up.company_id = b.company_id)
        OR (up.branch_id = appointments.branch_id AND up.role IN ('supervisor', 'cashier', 'operator'))
      )
      AND up.is_active = true
    )
  );

CREATE POLICY "Staff can update appointments"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      LEFT JOIN branches b ON b.id = appointments.branch_id
      WHERE up.id = auth.uid()
      AND (
        up.role = 'root'
        OR (up.role = 'admin' AND up.company_id = b.company_id)
        OR (up.branch_id = appointments.branch_id AND up.role IN ('supervisor', 'cashier', 'operator'))
      )
      AND up.is_active = true
    )
  );

-- Update trigger for companies
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to check permissions
CREATE OR REPLACE FUNCTION has_permission(user_id uuid, permission_name text)
RETURNS boolean AS $$
DECLARE
  user_role text;
  user_permissions jsonb;
BEGIN
  SELECT role, permissions INTO user_role, user_permissions
  FROM user_profiles
  WHERE id = user_id AND is_active = true;

  -- Check if permission is explicitly granted in custom permissions
  IF user_permissions ? permission_name AND (user_permissions->permission_name)::boolean = true THEN
    RETURN true;
  END IF;

  -- Check if permission is explicitly denied
  IF user_permissions ? permission_name AND (user_permissions->permission_name)::boolean = false THEN
    RETURN false;
  END IF;

  -- Default role-based permissions
  CASE user_role
    WHEN 'root' THEN RETURN true;
    WHEN 'admin' THEN RETURN permission_name NOT LIKE 'root_%';
    WHEN 'supervisor' THEN RETURN permission_name IN (
      'view_appointments', 'create_appointments', 'update_appointments',
      'view_customers', 'create_customers', 'update_customers',
      'view_cash_register', 'manage_cash_register', 'authorize_discounts',
      'view_reports', 'daily_operations'
    );
    WHEN 'cashier' THEN RETURN permission_name IN (
      'view_appointments', 'create_appointments', 'update_appointments',
      'view_customers', 'create_customers',
      'process_payments', 'create_invoices',
      'open_cash_register', 'close_cash_register'
    );
    WHEN 'operator' THEN RETURN permission_name IN (
      'view_appointments', 'update_appointments',
      'view_customers',
      'checkin_vehicle', 'checkout_vehicle',
      'consume_supplies', 'advance_orders'
    );
    WHEN 'marketing' THEN RETURN permission_name IN (
      'view_customers', 'create_campaigns', 'manage_coupons',
      'view_segments', 'send_communications'
    );
    WHEN 'accountant' THEN RETURN permission_name IN (
      'view_reports', 'export_reports', 'view_journal_entries',
      'manage_taxes', 'view_financial_data'
    );
    ELSE RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;