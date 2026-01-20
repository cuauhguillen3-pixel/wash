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
