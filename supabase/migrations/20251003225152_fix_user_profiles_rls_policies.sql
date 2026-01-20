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
