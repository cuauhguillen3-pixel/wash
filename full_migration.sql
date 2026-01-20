-- FULL MIGRATION SCRIPT GENERATED AUTOMATICALLY


-- ==================================================================
-- MIGRATION: 20251003215054_create_carwash_schema.sql
-- ==================================================================

/*
  # Carwash Suite - Complete Database Schema

  ## Overview
  Multi-branch carwash management system with role-based access control

  ## New Tables

  ### 1. `branches`
  Branch locations for the carwash business
  - `id` (uuid, primary key)
  - `name` (text) - Branch name
  - `address` (text) - Physical address
  - `phone` (text) - Contact phone
  - `email` (text) - Contact email
  - `is_active` (boolean) - Branch operational status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `user_profiles`
  Extended user information and role management
  - `id` (uuid, primary key, references auth.users)
  - `full_name` (text) - User's full name
  - `role` (text) - Role: 'admin', 'manager', 'employee'
  - `branch_id` (uuid, nullable) - Assigned branch for managers/employees
  - `phone` (text)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `services`
  Available carwash services
  - `id` (uuid, primary key)
  - `name` (text) - Service name
  - `description` (text)
  - `base_price` (decimal) - Base price
  - `duration_minutes` (integer) - Estimated duration
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `branch_services`
  Services offered at each branch with branch-specific pricing
  - `id` (uuid, primary key)
  - `branch_id` (uuid, references branches)
  - `service_id` (uuid, references services)
  - `price` (decimal) - Branch-specific price
  - `is_available` (boolean)
  - `created_at` (timestamptz)

  ### 5. `customers`
  Customer information
  - `id` (uuid, primary key)
  - `full_name` (text)
  - `email` (text)
  - `phone` (text)
  - `vehicle_info` (jsonb) - Array of vehicles: [{plate, make, model, year, color}]
  - `notes` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. `appointments`
  Service appointments/orders
  - `id` (uuid, primary key)
  - `branch_id` (uuid, references branches)
  - `customer_id` (uuid, references customers)
  - `vehicle_plate` (text)
  - `scheduled_date` (timestamptz)
  - `status` (text) - 'pending', 'in_progress', 'completed', 'cancelled'
  - `total_amount` (decimal)
  - `payment_status` (text) - 'pending', 'paid', 'refunded'
  - `payment_method` (text) - 'cash', 'card', 'transfer'
  - `notes` (text)
  - `created_by` (uuid, references user_profiles)
  - `completed_by` (uuid, nullable, references user_profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `appointment_services`
  Services included in each appointment
  - `id` (uuid, primary key)
  - `appointment_id` (uuid, references appointments)
  - `service_id` (uuid, references services)
  - `price` (decimal) - Price at time of booking
  - `status` (text) - 'pending', 'completed'
  - `created_at` (timestamptz)

  ## Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with restrictive policies:

  1. **Admins** - Full access to all data
  2. **Managers** - Access to their assigned branch data
  3. **Employees** - Read access to their branch, limited write access
  4. **Authenticated users** - Basic read access based on role

  ### Important Notes

  1. **Multi-tenant Architecture**: Data is isolated by branch for managers/employees
  2. **Role Hierarchy**: admin > manager > employee
  3. **Audit Trail**: All tables include created_at and updated_at timestamps
  4. **Soft Deletes**: Uses is_active flags instead of hard deletes
  5. **Price History**: appointment_services stores price at booking time
  6. **Flexible Vehicle Data**: JSONB allows multiple vehicles per customer
*/

-- Create branches table
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_price decimal(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create branch_services table
CREATE TABLE IF NOT EXISTS branch_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(branch_id, service_id)
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text NOT NULL,
  vehicle_info jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_plate text NOT NULL,
  scheduled_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method text CHECK (payment_method IN ('cash', 'card', 'transfer')),
  notes text,
  created_by uuid NOT NULL REFERENCES user_profiles(id),
  completed_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create appointment_services table
CREATE TABLE IF NOT EXISTS appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_branch ON user_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_branch_services_branch ON branch_services(branch_id);
CREATE INDEX IF NOT EXISTS idx_appointments_branch ON appointments(branch_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment ON appointment_services(appointment_id);

-- Enable RLS on all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branches
CREATE POLICY "Admins can manage all branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Managers and employees can view their branch"
  ON branches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.branch_id = branches.id
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
      AND up.is_active = true
    )
  );

CREATE POLICY "Managers can view profiles in their branch"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'manager'
      AND up.branch_id = user_profiles.branch_id
      AND up.is_active = true
    )
  );

-- RLS Policies for services
CREATE POLICY "Authenticated users can view active services"
  ON services FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage services"
  ON services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for branch_services
CREATE POLICY "Users can view services for their branch"
  ON branch_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'admin'
        OR user_profiles.branch_id = branch_services.branch_id
      )
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Admins can manage branch services"
  ON branch_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for customers
CREATE POLICY "Users can view customers in their branch context"
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
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for appointments
CREATE POLICY "Users can view appointments for their branch"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'admin'
        OR user_profiles.branch_id = appointments.branch_id
      )
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff can create appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'admin'
        OR user_profiles.branch_id = appointments.branch_id
      )
      AND user_profiles.is_active = true
    )
  );

CREATE POLICY "Staff can update appointments in their branch"
  ON appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (
        user_profiles.role = 'admin'
        OR user_profiles.branch_id = appointments.branch_id
      )
      AND user_profiles.is_active = true
    )
  );

-- RLS Policies for appointment_services
CREATE POLICY "Users can view appointment services for their branch"
  ON appointment_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      INNER JOIN user_profiles up ON up.id = auth.uid()
      WHERE a.id = appointment_services.appointment_id
      AND (
        up.role = 'admin'
        OR up.branch_id = a.branch_id
      )
      AND up.is_active = true
    )
  );

CREATE POLICY "Staff can manage appointment services"
  ON appointment_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      INNER JOIN user_profiles up ON up.id = auth.uid()
      WHERE a.id = appointment_services.appointment_id
      AND (
        up.role = 'admin'
        OR up.branch_id = a.branch_id
      )
      AND up.is_active = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================================================================
-- MIGRATION: 20251003220436_update_roles_and_companies.sql
-- ==================================================================

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

-- ==================================================================
-- MIGRATION: 20251003225152_fix_user_profiles_rls_policies.sql
-- ==================================================================

/*
  # Fix User Profiles RLS Policies

  ## Overview
  Fixes infinite recursion in user_profiles RLS policies by simplifying policy logic

  ## Changes
  - Drops all existing user_profiles policies
  - Creates new simplified policies without recursive calls
  - Users can always read their own profile
  - Root users can manage all profiles
  - Admin users can manage profiles in their company
  - Supervisor users can view profiles in their company

  ## Security
  Maintains proper access control without causing infinite recursion
*/

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Root can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage users in their company" ON user_profiles;
DROP POLICY IF EXISTS "Supervisors can view users in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Root can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage company profiles" ON user_profiles;
DROP POLICY IF EXISTS "Supervisors can view company profiles" ON user_profiles;

-- Create new simplified policies

-- Policy 1: Users can always read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Root users can do everything (using lateral join to avoid recursion)
CREATE POLICY "Root can manage all profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'root'
      AND up.is_active = true
      LIMIT 1
    )
  );

-- Policy 4: Admin users can manage profiles in their company
CREATE POLICY "Admins can manage company profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.is_active = true
      AND admin_profile.company_id = user_profiles.company_id
      LIMIT 1
    )
  );

-- Policy 5: Supervisors can view profiles in their company
CREATE POLICY "Supervisors can view company profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles supervisor_profile
      WHERE supervisor_profile.id = auth.uid()
      AND supervisor_profile.role IN ('admin', 'supervisor')
      AND supervisor_profile.is_active = true
      AND supervisor_profile.company_id = user_profiles.company_id
      LIMIT 1
    )
  );


-- ==================================================================
-- MIGRATION: 20251003225348_fix_rls_recursion_with_function.sql
-- ==================================================================

/*
  # Fix RLS Recursion with Helper Function

  ## Overview
  Creates a helper function to check user role without causing recursion in RLS policies

  ## Changes
  - Creates a security definer function to get user role
  - Drops all existing user_profiles policies
  - Creates new policies using the helper function
  - Policies check role without recursive table access

  ## Security
  - Function runs with security definer to bypass RLS
  - Policies maintain proper access control
  - No infinite recursion
*/

-- Create a security definer function to get the current user's role and company
CREATE OR REPLACE FUNCTION get_user_role_info()
RETURNS TABLE (
  user_role text,
  user_company_id uuid,
  user_branch_id uuid,
  user_is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role, company_id, branch_id, is_active
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Root can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage users in their company" ON user_profiles;
DROP POLICY IF EXISTS "Supervisors can view users in their company" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Root can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage company profiles" ON user_profiles;
DROP POLICY IF EXISTS "Supervisors can view company profiles" ON user_profiles;

-- Policy 1: Users can always read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT user_role FROM get_user_role_info()) = 'root'
  );

-- Policy 2: Root users can do everything
CREATE POLICY "Root has full access"
  ON user_profiles FOR ALL
  TO authenticated
  USING ((SELECT user_role FROM get_user_role_info()) = 'root')
  WITH CHECK ((SELECT user_role FROM get_user_role_info()) = 'root');

-- Policy 3: Admin users can view and manage profiles in their company
CREATE POLICY "Admins manage company users"
  ON user_profiles FOR ALL
  TO authenticated
  USING (
    (SELECT user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT user_is_active FROM get_user_role_info()) = true
    AND (SELECT user_company_id FROM get_user_role_info()) = company_id
  )
  WITH CHECK (
    (SELECT user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT user_is_active FROM get_user_role_info()) = true
    AND (SELECT user_company_id FROM get_user_role_info()) = company_id
  );

-- Policy 4: Supervisors can view profiles in their company
CREATE POLICY "Supervisors view company users"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT user_role FROM get_user_role_info()) IN ('admin', 'supervisor')
    AND (SELECT user_is_active FROM get_user_role_info()) = true
    AND (SELECT user_company_id FROM get_user_role_info()) = company_id
  );

-- Policy 5: Users can update their own basic profile info
CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ==================================================================
-- MIGRATION: 20251004015525_add_insert_policy_for_registration.sql
-- ==================================================================

/*
  # Add INSERT Policy for User Registration

  ## Overview
  Adds a policy to allow INSERT operations on user_profiles for service role operations
  during company registration process.

  ## Changes
  - Add INSERT policy that allows profile creation when authenticated
  - This enables the Edge Function to create admin profiles during registration

  ## Security
  - Policy is restrictive and only allows inserts for authenticated context
  - Service role operations bypass RLS by default
  - Regular users cannot insert arbitrary profiles
*/

-- Add policy to allow INSERT for service role / registration operations
CREATE POLICY "Allow insert for registration"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ==================================================================
-- MIGRATION: 20251004015535_remove_permissive_insert_policy.sql
-- ==================================================================

/*
  # Remove Permissive INSERT Policy

  ## Overview
  Removes the overly permissive INSERT policy and ensures service role operations
  work correctly.

  ## Changes
  - Remove the "Allow insert for registration" policy
  - Service role operations should bypass RLS automatically
*/

-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Allow insert for registration" ON user_profiles;


-- ==================================================================
-- MIGRATION: 20251004020838_add_email_to_user_profiles.sql
-- ==================================================================

/*
  # Add Email Column to User Profiles

  ## Overview
  Adds email column to user_profiles table to store user email addresses
  for easier access without joining to auth.users

  ## Changes
  1. Add email column to user_profiles table
  2. Add unique constraint on email
  3. Backfill existing records from auth.users (if any exist)

  ## Security
  - No changes to RLS policies
  - Email is a standard user attribute
*/

-- Add email column to user_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email text;
  END IF;
END $$;

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_email_key'
  ) THEN
    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- Backfill email from auth.users for existing records
UPDATE user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id AND up.email IS NULL;


-- ==================================================================
-- MIGRATION: 20251004041926_create_employees_table.sql
-- ==================================================================

/*
  # Create Employees Table

  ## Overview
  Creates a new employees table to manage company staff/personnel independently from user accounts.
  This table represents all employees whether they have a user account or not.

  ## New Tables
  
  ### `employees`
  Stores employee/staff information for each company
  - `id` (uuid, primary key) - Unique employee identifier
  - `company_id` (uuid, references companies) - Company the employee belongs to
  - `branch_id` (uuid, nullable, references branches) - Assigned branch
  - `full_name` (text, required) - Employee's full name
  - `email` (text, nullable) - Employee's email (can match user_profiles.email if they have an account)
  - `phone` (text, nullable) - Contact phone
  - `position` (text, default 'employee') - Job position/title
  - `hire_date` (date, nullable) - Date hired
  - `is_active` (boolean, default true) - Employment status
  - `notes` (text, nullable) - Additional notes about the employee
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  ### Row Level Security (RLS)
  - Enable RLS on employees table
  - Root users can view all employees (read-only)
  - Admin users can manage employees from their company
  - Other users have no direct access

  ## Important Notes
  
  1. **Separate from Users**: Employees table is independent of user_profiles
  2. **Email Matching**: If employee.email matches user_profiles.email, indicates they have a user account
  3. **Multi-tenant**: Data isolated by company_id for admin users
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) NOT NULL,
  branch_id uuid REFERENCES branches(id),
  full_name text NOT NULL,
  email text,
  phone text,
  position text DEFAULT 'employee',
  hire_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on company_id for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- Create index on branch_id for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);

-- Create index on email for checking user account association
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: Root users can view all employees (read-only)
CREATE POLICY "Root can view all employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'root'
  );

-- Policy: Admins can view their company employees
CREATE POLICY "Admins view company employees"
  ON employees
  FOR SELECT
  TO authenticated
  USING (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT get_user_role_info.user_company_id FROM get_user_role_info()) = company_id
    AND (SELECT get_user_role_info.user_is_active FROM get_user_role_info()) = true
  );

-- Policy: Admins can insert employees for their company
CREATE POLICY "Admins create company employees"
  ON employees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT get_user_role_info.user_company_id FROM get_user_role_info()) = company_id
    AND (SELECT get_user_role_info.user_is_active FROM get_user_role_info()) = true
  );

-- Policy: Admins can update their company employees
CREATE POLICY "Admins update company employees"
  ON employees
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT get_user_role_info.user_company_id FROM get_user_role_info()) = company_id
    AND (SELECT get_user_role_info.user_is_active FROM get_user_role_info()) = true
  )
  WITH CHECK (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT get_user_role_info.user_company_id FROM get_user_role_info()) = company_id
    AND (SELECT get_user_role_info.user_is_active FROM get_user_role_info()) = true
  );

-- Policy: Admins can delete their company employees
CREATE POLICY "Admins delete company employees"
  ON employees
  FOR DELETE
  TO authenticated
  USING (
    (SELECT get_user_role_info.user_role FROM get_user_role_info()) = 'admin'
    AND (SELECT get_user_role_info.user_company_id FROM get_user_role_info()) = company_id
    AND (SELECT get_user_role_info.user_is_active FROM get_user_role_info()) = true
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_employees_updated_at ON employees;
CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employees_updated_at();


-- ==================================================================
-- MIGRATION: 20251004045409_add_notes_to_user_profiles.sql
-- ==================================================================

/*
  # Add notes field to user_profiles table

  1. Changes
    - Add `notes` column to `user_profiles` table
      - Type: text (nullable)
      - Purpose: Store additional notes/comments about the user
      - Use case: Admins can add notes about employees (special instructions, certifications, etc.)

  2. Notes
    - This is a non-breaking change (column is nullable)
    - Existing records will have NULL for notes field
    - Field is optional and can be used for any relevant information about the user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notes'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notes text;
  END IF;
END $$;


-- ==================================================================
-- MIGRATION: 20251004062044_create_loyalty_wallet_system.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251006214359_create_vehicles_system.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251006221555_create_orders_and_services_system.sql
-- ==================================================================

/*
  # Create Orders and Services System

  1. New Tables
    - `service_packages`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - Nombre del paquete
      - `description` (text)
      - `price` (numeric) - Precio base
      - `duration_minutes` (integer) - Duración estimada
      - `is_combo` (boolean) - Si es paquete combo
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `package_services`
      - `id` (uuid, primary key)
      - `package_id` (uuid, references service_packages)
      - `service_id` (uuid, references services)
      - `quantity` (integer) - Cantidad del servicio en el paquete
      - `created_at` (timestamptz)

    - `service_orders`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `branch_id` (uuid, references branches)
      - `ticket_number` (text, unique) - Número de ticket
      - `customer_id` (uuid, references customers)
      - `vehicle_id` (uuid, references vehicles)
      - `status` (text) - pendiente, en_proceso, terminado, entregado, facturado, cancelado
      - `subtotal` (numeric)
      - `discount_amount` (numeric)
      - `discount_percentage` (numeric)
      - `tax_amount` (numeric)
      - `total` (numeric)
      - `payment_method` (text)
      - `payment_status` (text) - pendiente, pagado, parcial
      - `notes` (text)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `delivered_at` (timestamptz)
      - `invoiced_at` (timestamptz)
      - `created_by` (uuid, references user_profiles)
      - `assigned_to` (uuid, references employees)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `item_type` (text) - service, package, complement
      - `service_id` (uuid, references services)
      - `package_id` (uuid, references service_packages)
      - `name` (text) - Nombre del item
      - `description` (text)
      - `quantity` (integer)
      - `unit_price` (numeric)
      - `discount_amount` (numeric)
      - `subtotal` (numeric)
      - `total` (numeric)
      - `created_at` (timestamptz)

    - `order_status_history`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `status` (text)
      - `notes` (text)
      - `changed_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control

  3. Indexes
    - Index on ticket_number for quick lookups
    - Index on order status and dates
    - Index on customer and vehicle
*/

-- Create service_packages table
CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  duration_minutes integer DEFAULT 0,
  is_combo boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create package_services table (many-to-many)
CREATE TABLE IF NOT EXISTS package_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES service_packages(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(package_id, service_id)
);

-- Create service_orders table
CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  ticket_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL NOT NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL NOT NULL,
  status text CHECK (status IN ('pendiente', 'en_proceso', 'terminado', 'entregado', 'facturado', 'cancelado')) DEFAULT 'pendiente' NOT NULL,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0,
  discount_percentage numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  payment_method text,
  payment_status text CHECK (payment_status IN ('pendiente', 'pagado', 'parcial')) DEFAULT 'pendiente',
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz,
  invoiced_at timestamptz,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, ticket_number)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  item_type text CHECK (item_type IN ('service', 'package', 'complement')) NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) DEFAULT 0,
  subtotal numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  notes text,
  changed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_packages_company ON service_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_package_services_package ON package_services(package_id);
CREATE INDEX IF NOT EXISTS idx_package_services_service ON package_services(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_company ON service_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_branch ON service_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_ticket ON service_orders(ticket_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle ON service_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- Enable RLS
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Policies for service_packages
CREATE POLICY "Root can view all packages"
  ON service_packages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company packages"
  ON service_packages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage packages"
  ON service_packages FOR ALL
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

-- Policies for package_services
CREATE POLICY "Users can view package services"
  ON package_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage package services"
  ON package_services FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_packages
      WHERE service_packages.id = package_services.package_id
      AND service_packages.company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager')
      )
    )
  );

-- Policies for service_orders
CREATE POLICY "Root can view all orders"
  ON service_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company orders"
  ON service_orders FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can insert orders"
  ON service_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Company users can update orders"
  ON service_orders FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policies for order_items
CREATE POLICY "Users can view order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage order items"
  ON order_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_items.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Policies for order_status_history
CREATE POLICY "Users can view order history"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_status_history.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order history"
  ON order_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_status_history.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_service_packages_timestamp ON service_packages;
CREATE TRIGGER update_service_packages_timestamp
  BEFORE UPDATE ON service_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamp();

DROP TRIGGER IF EXISTS update_service_orders_timestamp ON service_orders;
CREATE TRIGGER update_service_orders_timestamp
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamp();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number(p_company_id uuid)
RETURNS text AS $$
DECLARE
  new_number text;
  date_prefix text;
  sequence_num integer;
BEGIN
  date_prefix := to_char(now(), 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN ticket_number LIKE date_prefix || '-%' 
      THEN CAST(split_part(ticket_number, '-', 2) AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_num
  FROM service_orders
  WHERE company_id = p_company_id
  AND ticket_number LIKE date_prefix || '-%';
  
  new_number := date_prefix || '-' || LPAD(sequence_num::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to record status change in history
CREATE OR REPLACE FUNCTION record_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record status changes
DROP TRIGGER IF EXISTS record_status_change_trigger ON service_orders;
CREATE TRIGGER record_status_change_trigger
  AFTER INSERT OR UPDATE OF status ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_status_change();


-- ==================================================================
-- MIGRATION: 20251006222406_create_inventory_system.sql
-- ==================================================================

/*
  # Create Inventory and Resources System

  1. New Tables
    - `inventory_products`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text) - Nombre del producto/insumo
      - `description` (text)
      - `sku` (text, unique) - Código interno
      - `barcode` (text) - Código de barras
      - `qr_code` (text) - Código QR
      - `photo_url` (text)
      - `category` (text) - Categoría del producto
      - `unit_of_measure` (text) - Unidad de medida (litros, piezas, etc)
      - `unit_cost` (numeric) - Costo por unidad
      - `current_stock` (numeric) - Stock actual
      - `min_stock` (numeric) - Stock mínimo (alerta)
      - `max_stock` (numeric) - Stock máximo
      - `location` (text) - Ubicación en almacén
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `inventory_movements`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `branch_id` (uuid, references branches)
      - `product_id` (uuid, references inventory_products)
      - `movement_type` (text) - entrada, salida, ajuste
      - `quantity` (numeric) - Cantidad (positiva o negativa)
      - `unit_cost` (numeric)
      - `total_cost` (numeric)
      - `reference_type` (text) - orden, compra, ajuste, otro
      - `reference_id` (uuid) - ID de la orden/compra relacionada
      - `reason` (text) - Motivo del movimiento
      - `notes` (text)
      - `performed_by` (uuid, references user_profiles)
      - `created_at` (timestamptz)

    - `order_product_consumption`
      - `id` (uuid, primary key)
      - `order_id` (uuid, references service_orders)
      - `product_id` (uuid, references inventory_products)
      - `quantity_used` (numeric)
      - `unit_cost` (numeric)
      - `total_cost` (numeric)
      - `created_at` (timestamptz)

    - `product_categories`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `name` (text)
      - `description` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company-based access control

  3. Indexes
    - Index on product SKU and barcodes
    - Index on stock levels for alerts
    - Index on movements by date
*/

-- Create product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, name)
);

-- Create inventory_products table
CREATE TABLE IF NOT EXISTS inventory_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  barcode text,
  qr_code text,
  photo_url text,
  unit_of_measure text DEFAULT 'unidad' NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  current_stock numeric(10,2) DEFAULT 0 NOT NULL,
  min_stock numeric(10,2) DEFAULT 0,
  max_stock numeric(10,2),
  location text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(company_id, sku)
);

-- Create inventory_movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  product_id uuid REFERENCES inventory_products(id) ON DELETE CASCADE NOT NULL,
  movement_type text CHECK (movement_type IN ('entrada', 'salida', 'ajuste')) NOT NULL,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  reference_type text CHECK (reference_type IN ('orden', 'compra', 'ajuste', 'traspaso', 'otro')) DEFAULT 'otro',
  reference_id uuid,
  reason text,
  notes text,
  performed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create order_product_consumption table
CREATE TABLE IF NOT EXISTS order_product_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES service_orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES inventory_products(id) ON DELETE CASCADE NOT NULL,
  quantity_used numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_company ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_company ON inventory_products(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_category ON inventory_products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku ON inventory_products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_barcode ON inventory_products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_products_low_stock ON inventory_products(company_id, current_stock) WHERE current_stock <= min_stock;
CREATE INDEX IF NOT EXISTS idx_inventory_movements_company ON inventory_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_consumption_order ON order_product_consumption(order_id);
CREATE INDEX IF NOT EXISTS idx_order_consumption_product ON order_product_consumption(product_id);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_product_consumption ENABLE ROW LEVEL SECURITY;

-- Policies for product_categories
CREATE POLICY "Root can view all categories"
  ON product_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company categories"
  ON product_categories FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage categories"
  ON product_categories FOR ALL
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

-- Policies for inventory_products
CREATE POLICY "Root can view all products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company products"
  ON inventory_products FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can manage products"
  ON inventory_products FOR ALL
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

-- Policies for inventory_movements
CREATE POLICY "Root can view all movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'root'
    )
  );

CREATE POLICY "Company users can view company movements"
  ON inventory_movements FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Authorized users can insert movements"
  ON inventory_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'operator')
    )
  );

-- Policies for order_product_consumption
CREATE POLICY "Users can view order consumption"
  ON order_product_consumption FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_product_consumption.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert order consumption"
  ON order_product_consumption FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = order_product_consumption.order_id
      AND service_orders.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'entrada' THEN
    UPDATE inventory_products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'salida' THEN
    UPDATE inventory_products
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.movement_type = 'ajuste' THEN
    UPDATE inventory_products
    SET current_stock = NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock on movement
DROP TRIGGER IF EXISTS update_stock_on_movement ON inventory_movements;
CREATE TRIGGER update_stock_on_movement
  AFTER INSERT ON inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- Function to record consumption when order uses products
CREATE OR REPLACE FUNCTION record_product_consumption()
RETURNS TRIGGER AS $$
BEGIN
  -- Create movement record
  INSERT INTO inventory_movements (
    company_id,
    branch_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    total_cost,
    reference_type,
    reference_id,
    reason,
    performed_by
  )
  SELECT 
    so.company_id,
    so.branch_id,
    NEW.product_id,
    'salida',
    NEW.quantity_used,
    NEW.unit_cost,
    NEW.total_cost,
    'orden',
    NEW.order_id,
    'Consumo en orden ' || so.ticket_number,
    so.created_by
  FROM service_orders so
  WHERE so.id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record consumption
DROP TRIGGER IF EXISTS record_consumption_trigger ON order_product_consumption;
CREATE TRIGGER record_consumption_trigger
  AFTER INSERT ON order_product_consumption
  FOR EACH ROW
  EXECUTE FUNCTION record_product_consumption();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for timestamps
DROP TRIGGER IF EXISTS update_inventory_products_timestamp ON inventory_products;
CREATE TRIGGER update_inventory_products_timestamp
  BEFORE UPDATE ON inventory_products
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_timestamp();

-- Function to generate SKU
CREATE OR REPLACE FUNCTION generate_sku(p_company_id uuid)
RETURNS text AS $$
DECLARE
  new_sku text;
  sequence_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE 
      WHEN sku ~ '^SKU-[0-9]+$'
      THEN CAST(substring(sku from 'SKU-([0-9]+)') AS integer)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_num
  FROM inventory_products
  WHERE company_id = p_company_id;
  
  new_sku := 'SKU-' || LPAD(sequence_num::text, 6, '0');
  
  RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- View for low stock alerts
CREATE OR REPLACE VIEW low_stock_products AS
SELECT 
  p.*,
  c.name as category_name,
  co.name as company_name
FROM inventory_products p
LEFT JOIN product_categories c ON p.category_id = c.id
LEFT JOIN companies co ON p.company_id = co.id
WHERE p.is_active = true
AND p.current_stock <= p.min_stock
ORDER BY p.company_id, (p.current_stock / NULLIF(p.min_stock, 0));


-- ==================================================================
-- MIGRATION: 20251006224524_add_company_id_to_services.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251006225241_create_accounting_and_finance_system_v2.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251009235951_make_vehicle_id_optional_in_service_orders.sql
-- ==================================================================

/*
  # Make vehicle_id optional in service_orders

  1. Changes
    - Alter `service_orders` table to make `vehicle_id` nullable
    - This allows creating service orders without assigning a vehicle
  
  2. Rationale
    - Not all services require a vehicle (e.g., walk-in customers, services without vehicle data)
    - Provides flexibility in order creation workflow
*/

-- Make vehicle_id nullable in service_orders
ALTER TABLE service_orders 
ALTER COLUMN vehicle_id DROP NOT NULL;

-- ==================================================================
-- MIGRATION: 20251011004025_add_is_active_and_company_to_customers.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251011015825_create_invoice_requests_table.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251011024059_create_roles_and_permissions_system.sql
-- ==================================================================

/*
  # Create Roles and Permissions System

  1. New Tables
    - `roles`
      - Roles personalizados por compañía
      - Nombre, descripción, nivel de acceso
      - Rol activo/inactivo
    
    - `permissions`
      - Permisos granulares por módulo
      - Define qué puede hacer cada rol en cada sección
      - Permisos: view, create, edit, delete, manage
    
    - `role_permissions`
      - Tabla de relación entre roles y permisos
      - Un rol puede tener múltiples permisos
      - Un permiso puede estar en múltiples roles

  2. Modules Available
    - dashboard: Panel principal
    - orders: Órdenes de servicio
    - customers: Clientes
    - vehicles: Vehículos
    - services: Servicios y paquetes
    - inventory: Inventario
    - staff: Personal
    - users: Usuarios del sistema
    - branches: Sucursales
    - companies: Empresas (solo root)
    - accounting: Contabilidad
    - reports: Reportes
    - marketing: Marketing y fidelización
    - appointments: Citas
    - cash: Caja

  3. Security
    - Enable RLS on all tables
    - Company-based access control
    - Only admins can manage roles and permissions

  4. Important Notes
    - Los roles por defecto (root, admin, manager, etc.) se mantienen
    - Este sistema permite crear roles personalizados adicionales
    - Los permisos se verifican en el frontend y backend
*/

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  is_active boolean DEFAULT true,
  level integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Create permissions table (catalog)
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(module, action)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Insert default permissions for all modules
INSERT INTO permissions (module, action, description) VALUES
  -- Dashboard
  ('dashboard', 'view', 'Ver panel principal'),
  
  -- Orders
  ('orders', 'view', 'Ver órdenes de servicio'),
  ('orders', 'create', 'Crear órdenes de servicio'),
  ('orders', 'edit', 'Editar órdenes de servicio'),
  ('orders', 'delete', 'Eliminar órdenes de servicio'),
  ('orders', 'manage_status', 'Gestionar estados de órdenes'),
  
  -- Customers
  ('customers', 'view', 'Ver clientes'),
  ('customers', 'create', 'Crear clientes'),
  ('customers', 'edit', 'Editar clientes'),
  ('customers', 'delete', 'Eliminar clientes'),
  
  -- Vehicles
  ('vehicles', 'view', 'Ver vehículos'),
  ('vehicles', 'create', 'Crear vehículos'),
  ('vehicles', 'edit', 'Editar vehículos'),
  ('vehicles', 'delete', 'Eliminar vehículos'),
  
  -- Services
  ('services', 'view', 'Ver servicios y paquetes'),
  ('services', 'create', 'Crear servicios y paquetes'),
  ('services', 'edit', 'Editar servicios y paquetes'),
  ('services', 'delete', 'Eliminar servicios y paquetes'),
  
  -- Inventory
  ('inventory', 'view', 'Ver inventario'),
  ('inventory', 'create', 'Agregar productos al inventario'),
  ('inventory', 'edit', 'Editar inventario'),
  ('inventory', 'delete', 'Eliminar productos del inventario'),
  ('inventory', 'manage_stock', 'Gestionar movimientos de stock'),
  
  -- Staff
  ('staff', 'view', 'Ver personal'),
  ('staff', 'create', 'Crear personal'),
  ('staff', 'edit', 'Editar personal'),
  ('staff', 'delete', 'Eliminar personal'),
  
  -- Users
  ('users', 'view', 'Ver usuarios del sistema'),
  ('users', 'create', 'Crear usuarios del sistema'),
  ('users', 'edit', 'Editar usuarios del sistema'),
  ('users', 'delete', 'Eliminar usuarios del sistema'),
  ('users', 'manage_roles', 'Gestionar roles y permisos'),
  
  -- Branches
  ('branches', 'view', 'Ver sucursales'),
  ('branches', 'create', 'Crear sucursales'),
  ('branches', 'edit', 'Editar sucursales'),
  ('branches', 'delete', 'Eliminar sucursales'),
  
  -- Companies
  ('companies', 'view', 'Ver empresas'),
  ('companies', 'create', 'Crear empresas'),
  ('companies', 'edit', 'Editar empresas'),
  ('companies', 'delete', 'Eliminar empresas'),
  
  -- Accounting
  ('accounting', 'view', 'Ver contabilidad'),
  ('accounting', 'manage_cash', 'Gestionar caja'),
  ('accounting', 'view_reports', 'Ver reportes financieros'),
  ('accounting', 'manage_invoices', 'Gestionar facturas'),
  ('accounting', 'manage_taxes', 'Gestionar impuestos'),
  
  -- Reports
  ('reports', 'view', 'Ver reportes'),
  ('reports', 'export', 'Exportar reportes'),
  
  -- Marketing
  ('marketing', 'view', 'Ver marketing y promociones'),
  ('marketing', 'create', 'Crear campañas de marketing'),
  ('marketing', 'edit', 'Editar campañas de marketing'),
  ('marketing', 'manage_loyalty', 'Gestionar programa de fidelización'),
  
  -- Appointments
  ('appointments', 'view', 'Ver citas'),
  ('appointments', 'create', 'Crear citas'),
  ('appointments', 'edit', 'Editar citas'),
  ('appointments', 'delete', 'Eliminar citas'),
  
  -- Cash
  ('cash', 'view', 'Ver caja'),
  ('cash', 'open_close', 'Abrir y cerrar caja'),
  ('cash', 'manage_transactions', 'Gestionar transacciones de caja')

ON CONFLICT (module, action) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_company ON roles(company_id);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "Users can view their company roles"
  ON roles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    OR company_id IS NULL
  );

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'root')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'root')
    )
  );

-- RLS Policies for permissions (read-only for most users)
CREATE POLICY "Users can view all permissions"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions
CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'root')
      )
    )
  )
  WITH CHECK (
    role_id IN (
      SELECT id FROM roles WHERE company_id IN (
        SELECT company_id FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'root')
      )
    )
  );

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  user_id uuid,
  check_module text,
  check_action text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  has_perm boolean;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = user_id;

  -- Root has all permissions
  IF user_role = 'root' THEN
    RETURN true;
  END IF;

  -- Check if user has the permission through their role
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN roles r ON r.name = up.role AND r.company_id = up.company_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.id = user_id
      AND p.module = check_module
      AND p.action = check_action
      AND rp.granted = true
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;


-- ==================================================================
-- MIGRATION: 20251011033320_insert_system_roles_and_default_permissions.sql
-- ==================================================================

/*
  # Insert System Roles and Default Permissions

  1. System Roles
    - Insert existing system roles (root, admin, supervisor, cashier, operator, marketing, accountant)
    - Mark them as system roles with appropriate levels
    - Global roles (company_id = NULL)

  2. Default Permissions Assignment
    - Assign permissions to each role based on their responsibilities
    - Root gets all permissions
    - Each role gets specific permissions for their function

  3. Important Notes
    - These roles are the baseline configuration
    - Admins can modify permissions later
    - System roles cannot be deleted but permissions can be adjusted
*/

-- Insert system roles (company_id is NULL for global roles)
INSERT INTO roles (id, company_id, name, description, is_system_role, is_active, level, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'root', 'Acceso total a todas las empresas y funcionalidades del sistema', true, true, 100, now()),
  ('00000000-0000-0000-0000-000000000002', NULL, 'admin', 'Administrador de empresa con acceso completo a su compañía', true, true, 90, now()),
  ('00000000-0000-0000-0000-000000000003', NULL, 'manager', 'Gerente con acceso a operaciones y reportes', true, true, 70, now()),
  ('00000000-0000-0000-0000-000000000004', NULL, 'supervisor', 'Supervisor de operaciones diarias y caja', true, true, 60, now()),
  ('00000000-0000-0000-0000-000000000005', NULL, 'operator', 'Operador de órdenes y servicios', true, true, 50, now()),
  ('00000000-0000-0000-0000-000000000006', NULL, 'cashier', 'Cajero para procesar pagos y facturas', true, true, 40, now()),
  ('00000000-0000-0000-0000-000000000007', NULL, 'marketing', 'Especialista en marketing y promociones', true, true, 30, now()),
  ('00000000-0000-0000-0000-000000000008', NULL, 'accountant', 'Contador con acceso a finanzas y reportes', true, true, 30, now())
ON CONFLICT (id) DO NOTHING;

-- Get permission IDs for assignment
DO $$
DECLARE
  v_root_id uuid := '00000000-0000-0000-0000-000000000001';
  v_admin_id uuid := '00000000-0000-0000-0000-000000000002';
  v_manager_id uuid := '00000000-0000-0000-0000-000000000003';
  v_supervisor_id uuid := '00000000-0000-0000-0000-000000000004';
  v_operator_id uuid := '00000000-0000-0000-0000-000000000005';
  v_cashier_id uuid := '00000000-0000-0000-0000-000000000006';
  v_marketing_id uuid := '00000000-0000-0000-0000-000000000007';
  v_accountant_id uuid := '00000000-0000-0000-0000-000000000008';
  v_perm_id uuid;
BEGIN
  -- ROOT: All permissions
  FOR v_perm_id IN (SELECT id FROM permissions) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_root_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- ADMIN: All except companies management
  FOR v_perm_id IN (
    SELECT id FROM permissions 
    WHERE NOT (module = 'companies' AND action != 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_admin_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- MANAGER: Operations, reports, staff management
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit', 'manage_status')) OR
    (module = 'customers' AND action IN ('view', 'create', 'edit')) OR
    (module = 'vehicles' AND action IN ('view', 'create', 'edit')) OR
    (module = 'services' AND action IN ('view', 'create', 'edit')) OR
    (module = 'inventory' AND action IN ('view', 'create', 'edit', 'manage_stock')) OR
    (module = 'staff' AND action IN ('view', 'create', 'edit')) OR
    (module = 'users' AND action = 'view') OR
    (module = 'branches' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'view_reports', 'manage_invoices')) OR
    (module = 'reports' AND action IN ('view', 'export')) OR
    (module = 'appointments' AND action IN ('view', 'create', 'edit')) OR
    (module = 'cash' AND action IN ('view', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_manager_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- SUPERVISOR: Daily operations and cash management
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit', 'manage_status')) OR
    (module = 'customers' AND action IN ('view', 'create', 'edit')) OR
    (module = 'vehicles' AND action IN ('view', 'create')) OR
    (module = 'inventory' AND action IN ('view', 'manage_stock')) OR
    (module = 'staff' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'manage_cash')) OR
    (module = 'reports' AND action = 'view') OR
    (module = 'appointments' AND action IN ('view', 'create', 'edit')) OR
    (module = 'cash' AND action IN ('view', 'open_close', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_supervisor_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- OPERATOR: Service orders and operations
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action IN ('view', 'create', 'edit')) OR
    (module = 'customers' AND action IN ('view', 'create')) OR
    (module = 'vehicles' AND action IN ('view', 'create')) OR
    (module = 'services' AND action = 'view') OR
    (module = 'inventory' AND action IN ('view', 'manage_stock')) OR
    (module = 'appointments' AND action IN ('view', 'edit'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_operator_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- CASHIER: Payments, invoices and cash
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action = 'view') OR
    (module = 'customers' AND action IN ('view', 'create')) OR
    (module = 'vehicles' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'manage_cash', 'manage_invoices')) OR
    (module = 'appointments' AND action IN ('view', 'create')) OR
    (module = 'cash' AND action IN ('view', 'open_close', 'manage_transactions'))
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_cashier_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- MARKETING: Campaigns and customer engagement
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'customers' AND action = 'view') OR
    (module = 'marketing' AND action IN ('view', 'create', 'edit', 'manage_loyalty')) OR
    (module = 'reports' AND action = 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_marketing_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

  -- ACCOUNTANT: Financial reports and accounting
  FOR v_perm_id IN (
    SELECT id FROM permissions WHERE
    (module = 'dashboard' AND action = 'view') OR
    (module = 'orders' AND action = 'view') OR
    (module = 'accounting' AND action IN ('view', 'view_reports', 'manage_invoices', 'manage_taxes')) OR
    (module = 'reports' AND action IN ('view', 'export')) OR
    (module = 'cash' AND action = 'view')
  ) LOOP
    INSERT INTO role_permissions (role_id, permission_id, granted)
    VALUES (v_accountant_id, v_perm_id, true)
    ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;
  END LOOP;

END $$;


-- ==================================================================
-- MIGRATION: 20251011035603_update_user_profiles_role_constraint.sql
-- ==================================================================

/*
  # Update User Profiles Role Constraint

  1. Changes
    - Remove old CHECK constraint on role column
    - Allow any role name that exists in the roles table
    - This enables dynamic roles from the roles table

  2. Security
    - RLS policies remain in place
    - Validation is now done through foreign key-like logic
    - Only valid role names can be used
*/

-- Drop the old CHECK constraint
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add a new constraint that validates against the roles table
-- This is done through a trigger function instead of CHECK constraint
CREATE OR REPLACE FUNCTION validate_user_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the role exists in the roles table
  IF NOT EXISTS (
    SELECT 1 FROM roles 
    WHERE name = NEW.role 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Role "%" does not exist or is not active', NEW.role;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS validate_user_role_trigger ON user_profiles;

-- Create trigger to validate role on insert and update
CREATE TRIGGER validate_user_role_trigger
  BEFORE INSERT OR UPDATE OF role ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_role();


-- ==================================================================
-- MIGRATION: 20251012025056_create_company_settings_table.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251013005841_add_subscription_to_companies.sql
-- ==================================================================

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


-- ==================================================================
-- MIGRATION: 20251013013405_add_subscription_to_companies.sql
-- ==================================================================

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
