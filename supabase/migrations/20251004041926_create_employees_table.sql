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
