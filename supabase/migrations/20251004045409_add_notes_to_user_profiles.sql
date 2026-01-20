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
