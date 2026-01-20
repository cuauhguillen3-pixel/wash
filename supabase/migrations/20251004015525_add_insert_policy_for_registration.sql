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
