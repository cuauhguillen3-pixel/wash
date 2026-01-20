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
