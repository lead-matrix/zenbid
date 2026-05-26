-- ============================================================
-- Add wire transfer details columns to system_settings
-- Admin-manageable. Shown dynamically to contractors in Settings.
-- ============================================================

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS wire_bank_name        TEXT DEFAULT 'Chase Business Banking',
  ADD COLUMN IF NOT EXISTS wire_account_name     TEXT DEFAULT 'PeakEstimator LLC',
  ADD COLUMN IF NOT EXISTS wire_account_number   TEXT DEFAULT 'XXXX-XXXX-4892',
  ADD COLUMN IF NOT EXISTS wire_routing_number   TEXT DEFAULT '021000021',
  ADD COLUMN IF NOT EXISTS wire_swift            TEXT DEFAULT 'CHASUS33',
  ADD COLUMN IF NOT EXISTS wire_contact_email    TEXT DEFAULT 'billing@peakestimator.com',
  ADD COLUMN IF NOT EXISTS wire_instructions     TEXT DEFAULT 'International transfers: include SWIFT code. Processing takes 1–3 business days. Your account will be activated within 24 hours of confirmed receipt.';

-- Add wire_reference and wire_submitted_at to subscriptions (for pending wire tracking)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan                TEXT DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS wire_reference      TEXT,
  ADD COLUMN IF NOT EXISTS wire_submitted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_email        TEXT;

-- Update status check constraint to include pending_wire
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Index for fast pending_wire lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_wire
  ON public.subscriptions(status)
  WHERE status = 'pending_wire';
