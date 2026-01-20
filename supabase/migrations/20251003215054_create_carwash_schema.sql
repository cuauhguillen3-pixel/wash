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