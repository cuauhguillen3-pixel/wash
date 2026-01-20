/*
  # Add Stripe and Trial Fields to Companies

  ## Changes

  1. Add Stripe fields:
    - `stripe_customer_id` (text)
    - `stripe_subscription_id` (text)
    - `subscription_status` (text) - e.g. 'trialing', 'active', 'past_due', 'canceled'

  2. Update constraints:
    - Update `subscription_type` check to include 'trial' if needed, or just rely on status.
    - We will keep `subscription_type` for the billing cycle ('mensual', 'anual').

  3. Notes:
    - `subscription_end_date` will continue to be the source of truth for access control.
    - `subscription_status` provides context (trial vs paid).
*/

DO $$
BEGIN
  -- Add stripe_customer_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN stripe_customer_id text;
  END IF;

  -- Add stripe_subscription_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN stripe_subscription_id text;
  END IF;

  -- Add subscription_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE companies
    ADD COLUMN subscription_status text DEFAULT 'trialing';
  END IF;

END $$;
