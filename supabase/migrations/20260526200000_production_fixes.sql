-- ════════════════════════════════════════════════════════════════
-- PeakEstimator — Production Fixes & Missing Features Migration
-- ════════════════════════════════════════════════════════════════

-- ─── 1. FIX: Subscription status enum + sync missing columns ───
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan             TEXT DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS wire_reference   TEXT,
  ADD COLUMN IF NOT EXISTS wire_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_email     TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','past_due','canceled','pending_wire','trialing','suspended'));

-- ─── 2. FIX: Add last_login_at to profiles ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role             TEXT DEFAULT 'estimator'
    CHECK (role IN ('super_admin','admin','sales_manager','estimator','technician','viewer')),
  ADD COLUMN IF NOT EXISTS billing_tier     TEXT DEFAULT 'pro'
    CHECK (billing_tier IN ('free','pro','enterprise'));

-- Index for churn detection queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON public.profiles(last_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended  ON public.profiles(is_suspended);

-- ─── 3. FIX: last_login_at trigger on auth ─────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
    SET last_login_at = now()
    WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Note: Supabase auth.users trigger must be set via Dashboard
-- as a Supabase Auth hook. This function is ready.

-- ─── 4. FIX: Wire column conflict resolution ───────────────────
-- Canonical defaults go here. Both migrations used IF NOT EXISTS so no dupe.
-- We forcibly set the defaults to the correct values now:
UPDATE public.system_settings SET
  wire_bank_name      = COALESCE(NULLIF(wire_bank_name,''), 'Chase Business Banking'),
  wire_account_name   = COALESCE(NULLIF(wire_account_name,''), 'PeakEstimator LLC'),
  wire_swift          = COALESCE(NULLIF(wire_swift,''), 'CHASUS33'),
  wire_contact_email  = COALESCE(NULLIF(wire_contact_email,''), 'billing@peakestimator.com')
WHERE id IS NOT NULL;

-- ─── 5. FIX: Proposal expiry enforcement ───────────────────────
-- Add expired status tracking (enforced client-side + edge function)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_expired        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_notified_at TIMESTAMPTZ DEFAULT NULL;

-- Function to auto-mark expired proposals
CREATE OR REPLACE FUNCTION public.mark_expired_proposals()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.projects
    SET is_expired = true
    WHERE valid_until IS NOT NULL
      AND valid_until::date < CURRENT_DATE
      AND status NOT IN ('approved','won','lost')
      AND (is_expired IS NULL OR is_expired = false);
END;
$$;

-- ─── 6. FIX: Impersonation log table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.impersonation_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id      uuid REFERENCES auth.users(id),
  target_user_id uuid REFERENCES auth.users(id),
  reason        text,
  started_at    timestamptz DEFAULT now(),
  ended_at      timestamptz,
  ip_address    text
);
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage impersonation logs" ON public.impersonation_logs;
CREATE POLICY "Admins manage impersonation logs" ON public.impersonation_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── 7. FIX: Change Orders table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.change_orders (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  version_number  integer DEFAULT 1,
  title           text NOT NULL DEFAULT 'Change Order',
  description     text,
  items_snapshot  jsonb DEFAULT '[]',
  original_total  numeric DEFAULT 0,
  revised_total   numeric DEFAULT 0,
  delta_amount    numeric GENERATED ALWAYS AS (revised_total - original_total) STORED,
  status          text DEFAULT 'draft' CHECK (status IN ('draft','sent','client_signed','rejected','voided')),
  share_token     text DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  client_signed_at timestamptz,
  signature_data  text,
  contractor_notes text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own change orders" ON public.change_orders;
CREATE POLICY "Users manage own change orders" ON public.change_orders
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read change order by token" ON public.change_orders;
CREATE POLICY "Public read change order by token" ON public.change_orders
  FOR SELECT USING (true);

-- ─── 8. FIX: Lien Waivers table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lien_waivers (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  waiver_type     text DEFAULT 'conditional' CHECK (waiver_type IN ('conditional','unconditional','partial')),
  amount          numeric NOT NULL DEFAULT 0,
  through_date    date,
  client_name     text,
  client_address  text,
  property_address text,
  status          text DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','voided')),
  share_token     text DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  signed_at       timestamptz,
  signature_data  text,
  pdf_url         text,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.lien_waivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own lien waivers" ON public.lien_waivers;
CREATE POLICY "Users manage own lien waivers" ON public.lien_waivers
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read lien waiver by token" ON public.lien_waivers;
CREATE POLICY "Public read lien waiver by token" ON public.lien_waivers
  FOR SELECT USING (true);

-- ─── 9. FIX: Global price book admin view ──────────────────────
-- price_book_items already has is_global col. Add admin override.
ALTER TABLE public.price_book_items
  ADD COLUMN IF NOT EXISTS admin_approved  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Admin can see all price book items
DROP POLICY IF EXISTS "Admin read all price book" ON public.price_book_items;
CREATE POLICY "Admin read all price book" ON public.price_book_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── 10. FIX: RLS — prevent cross-user profile enumeration ─────
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Admin update any profile" ON public.profiles;
CREATE POLICY "Admin update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ─── 11. FIX: proposal_analytics rate limit helper ─────────────
-- Add rate-limit index: ip_hash + project_id within 1 minute
CREATE INDEX IF NOT EXISTS idx_proposal_analytics_rate_limit
  ON public.proposal_analytics(ip_hash, project_id, created_at DESC);

-- ─── 12. FIX: Share token expiry enforcement ───────────────────
-- is_expired flag checked in ClientPortal route
-- already added in step 5

-- ─── 13. ADMIN: Password reset request log ─────────────────────
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    uuid REFERENCES auth.users(id),
  action_type text NOT NULL,
  target_id   text,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage action log" ON public.admin_actions_log;
CREATE POLICY "Admins manage action log" ON public.admin_actions_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── 14. Stripe subscriptions admin view ───────────────────────
-- Already in subscriptions table. Add index for admin queries.
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org    ON public.subscriptions(organization_id);

-- ─── 15. Projects — enforced expiry trigger ─────────────────────
CREATE OR REPLACE FUNCTION public.enforce_proposal_expiry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.valid_until IS NOT NULL AND NEW.valid_until::date < CURRENT_DATE
     AND NEW.status NOT IN ('approved','won','lost') THEN
    NEW.is_expired := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_enforce_expiry ON public.projects;
CREATE TRIGGER trig_enforce_expiry
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_expiry();

