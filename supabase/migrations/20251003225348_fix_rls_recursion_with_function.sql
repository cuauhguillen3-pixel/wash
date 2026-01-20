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
