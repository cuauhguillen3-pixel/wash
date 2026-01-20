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
