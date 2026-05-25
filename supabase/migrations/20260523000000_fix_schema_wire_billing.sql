-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — Fix Migration
-- 20260523000000_fix_schema_wire_billing.sql
-- Fixes: organization_id column ordering errors, replaces Stripe
--        with wire-to-bank manual billing, guards missing tables.
-- ═══════════════════════════════════════════════════════════════════

-- ── STEP 1: Ensure extensions ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── STEP 2: Organizations table (idempotent) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  subdomain text UNIQUE,
  logo_url text,
  billing_tier text DEFAULT 'free' CHECK (billing_tier IN ('free', 'pro', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop old conflicting policies before recreating
DROP POLICY IF EXISTS "Users read own organization" ON public.organizations;
DROP POLICY IF EXISTS "Superadmins manage organizations" ON public.organizations;

-- ── STEP 3: Add organization_id to profiles FIRST (before any policy uses it) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'estimator'
    CHECK (role IN ('super_admin', 'admin', 'sales_manager', 'estimator', 'technician', 'viewer'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_access boolean DEFAULT false;

-- ── STEP 4: Now safe to create org policies that reference profiles.organization_id ──
CREATE POLICY "Users read own organization" ON public.organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STEP 5: Organization settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
  company_colors jsonb DEFAULT '{"primary": "#B27150", "secondary": "#1E293B"}'::jsonb,
  invoice_terms text DEFAULT 'Due upon receipt',
  payment_methods text[] DEFAULT '{"bank_transfer"}'::text[],
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own organization settings" ON public.organization_settings;
CREATE POLICY "Users read own organization settings" ON public.organization_settings
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage organization settings" ON public.organization_settings;
CREATE POLICY "Admins manage organization settings" ON public.organization_settings
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- ── STEP 6: Organization members ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'estimator' CHECK (role IN ('super_admin', 'admin', 'sales_manager', 'estimator', 'technician', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_org_member UNIQUE (organization_id, profile_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read members of own organization" ON public.organization_members;
CREATE POLICY "Users read members of own organization" ON public.organization_members
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage organization members" ON public.organization_members;
CREATE POLICY "Admins manage organization members" ON public.organization_members
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- ── STEP 7: Backfill — provision default orgs for existing profiles ───
DO $$
DECLARE
  r RECORD;
  org_id UUID;
BEGIN
  FOR r IN
    SELECT p.id, p.email, p.full_name,
           COALESCE(p.company_name, '') AS company_name,
           COALESCE(p.is_admin, false) AS is_admin
    FROM public.profiles p
    WHERE p.organization_id IS NULL
  LOOP
    INSERT INTO public.organizations (name, billing_tier, created_at, updated_at)
    VALUES (
      CASE WHEN r.company_name <> '' THEN r.company_name
           WHEN r.full_name IS NOT NULL AND r.full_name <> '' THEN r.full_name
           ELSE 'My Organization' END,
      'free', now(), now()
    )
    RETURNING id INTO org_id;

    UPDATE public.profiles
    SET organization_id = org_id,
        role = CASE WHEN r.is_admin THEN 'super_admin' ELSE 'estimator' END
    WHERE id = r.id;

    INSERT INTO public.organization_settings (organization_id)
    VALUES (org_id)
    ON CONFLICT (organization_id) DO NOTHING;

    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (org_id, r.id, CASE WHEN r.is_admin THEN 'super_admin' ELSE 'estimator' END)
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END LOOP;
END $$;

-- ── STEP 8: Update the handle_new_user trigger to provision orgs ──────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, billing_tier)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'full_name', 'My Organization'),
    'free'
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organization_id, email, full_name, role)
  VALUES (
    new.id,
    new_org_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Professional Estimator'),
    'org_admin'
  )
  ON CONFLICT (id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        email = EXCLUDED.email;

  INSERT INTO public.organization_settings (organization_id)
  VALUES (new_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── STEP 9: Add organization_id to operational tables (guarded) ───────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.price_book
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Guard: only add column if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_events') THEN
    EXECUTE 'ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
    EXECUTE 'ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_logs') THEN
    EXECUTE 'ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integration_requests') THEN
    EXECUTE 'ALTER TABLE public.integration_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE';
  END IF;
END $$;

-- Backfill organization on operational rows
UPDATE public.projects p
  SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = p.user_id)
  WHERE p.organization_id IS NULL;

UPDATE public.price_book p
  SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = p.user_id)
  WHERE p.organization_id IS NULL AND p.user_id IS NOT NULL;

-- ── STEP 10: Project multi-option columns ─────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_multi_option boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS selected_tier text CHECK (selected_tier IN ('good', 'better', 'best')) DEFAULT null,
  ADD COLUMN IF NOT EXISTS good_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS better_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_to_close_days numeric DEFAULT null,
  ADD COLUMN IF NOT EXISTS lost_reason text DEFAULT null,
  ADD COLUMN IF NOT EXISTS estimator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.project_items
  ADD COLUMN IF NOT EXISTS option_tier text DEFAULT 'base'
    CHECK (option_tier IN ('base', 'good', 'better', 'best', 'upsell')),
  ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;

-- ── STEP 11: Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_organization ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_items_tier ON public.project_items(option_tier);

-- ── STEP 12: Feature flags ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  enabled_globally boolean DEFAULT true,
  enabled_for_users uuid[] DEFAULT '{}',
  beta_users uuid[] DEFAULT '{}',
  rollout_percentage integer DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_org_flag UNIQUE (organization_id, name)
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org feature flags read" ON public.feature_flags;
CREATE POLICY "Org feature flags read" ON public.feature_flags
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage feature flags" ON public.feature_flags;
CREATE POLICY "Admins manage feature flags" ON public.feature_flags
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Seed feature flags per org
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.feature_flags (organization_id, name, description, enabled_globally) VALUES
      (org.id, 'good-better-best', 'Multi-option proposal packages', true),
      (org.id, 'ai-scope', 'AI scope assistant and photo-transcriber', true),
      (org.id, 'mobile-field', 'Offline-friendly mobile Field Mode PWA', true),
      (org.id, 'automation', 'Automated campaign follow-up rules', true),
      (org.id, 'financing', 'Monthly payment financing calculator', true),
      (org.id, 'templates', 'Trade-specific estimate templates', true)
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ── STEP 13: AI Usage ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
  monthly_limit_cents integer DEFAULT 500,
  monthly_usage_cents integer DEFAULT 0,
  last_reset_date timestamptz DEFAULT now(),
  max_requests_per_minute integer DEFAULT 5,
  request_counter integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org read AI usage limits" ON public.ai_usage_limits;
CREATE POLICY "Org read AI usage limits" ON public.ai_usage_limits
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage AI limits" ON public.ai_usage_limits;
CREATE POLICY "Admins manage AI limits" ON public.ai_usage_limits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.ai_usage_limits (organization_id, monthly_limit_cents, monthly_usage_cents)
    VALUES (org.id, 500, 0)
    ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  cost numeric DEFAULT 0,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "Org view AI usage logs" ON public.ai_usage_logs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STEP 14: Audit logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  original_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view audit logs" ON public.audit_logs;
CREATE POLICY "Org view audit logs" ON public.audit_logs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STEP 15: Proposal versioning ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  items_snapshot jsonb DEFAULT '[]'::jsonb,
  notes_snapshot text,
  totals_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view proposal snapshots" ON public.proposal_versions;
CREATE POLICY "Org view proposal snapshots" ON public.proposal_versions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Public read snapshots via share token" ON public.proposal_versions;
CREATE POLICY "Public read snapshots via share token" ON public.proposal_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.share_token IS NOT NULL)
  );

-- ── STEP 16: Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  trade text CHECK (trade IN ('electrical','roofing','hvac','painting','plumbing','drain','general','other')) DEFAULT 'general',
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read templates" ON public.templates;
CREATE POLICY "Read templates" ON public.templates
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR is_global = true
  );

DROP POLICY IF EXISTS "Manage templates" ON public.templates;
CREATE POLICY "Manage templates" ON public.templates
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin','sales_manager','estimator'))
  );

CREATE TABLE IF NOT EXISTS public.template_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'ea',
  unit_price numeric DEFAULT 0,
  category text CHECK (category IN ('material','labor','equipment','other')) DEFAULT 'material',
  markup numeric DEFAULT 15,
  sort_order integer DEFAULT 0
);
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read template items" ON public.template_items;
CREATE POLICY "Read template items" ON public.template_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_id AND
      (t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR t.is_global = true)
    )
  );

DROP POLICY IF EXISTS "Manage template items" ON public.template_items;
CREATE POLICY "Manage template items" ON public.template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_id AND
      t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ── STEP 17: Background jobs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  job_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  retry_count integer DEFAULT 0,
  last_error text,
  scheduled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view background jobs" ON public.background_jobs;
CREATE POLICY "Org view background jobs" ON public.background_jobs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STEP 18: WIRE-TO-BANK Subscriptions (replaces Stripe) ─────────────
-- Drop old subscriptions table if it has stripe columns and recreate clean
DROP TABLE IF EXISTS public.subscriptions CASCADE;

CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  -- Billing tier & status
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status text DEFAULT 'free' CHECK (status IN ('free', 'active', 'pending_wire', 'past_due', 'canceled')),
  -- Wire payment details
  wire_reference text,                  -- Bank reference / confirmation code submitted by user
  wire_submitted_at timestamptz,        -- When the user submitted the wire reference
  wire_verified_at timestamptz,         -- When admin manually confirmed receipt
  wire_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Plan metadata
  plan_activated_at timestamptz,
  plan_expires_at timestamptz,          -- NULL = indefinite (manual renewal)
  monthly_amount numeric DEFAULT 0,     -- USD amount for their plan
  notes text,                           -- Admin notes / wire memo
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view own subscription" ON public.subscriptions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Seed free subscription for every existing organization
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.subscriptions (organization_id, plan, status)
    VALUES (org.id, 'free', 'free')
    ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END $$;

-- ── STEP 19: Usage tracking ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL CHECK (metric_name IN ('proposals_sent', 'ai_prompts', 'storage_bytes')),
  count integer DEFAULT 0,
  billing_period_start timestamptz DEFAULT now(),
  billing_period_end timestamptz
);
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org view usage tracking" ON public.usage_tracking;
CREATE POLICY "Org view usage tracking" ON public.usage_tracking
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- ── STEP 20: System settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  financing_enabled boolean DEFAULT true,
  financing_interest_rate numeric DEFAULT 9.99,
  financing_max_term_months integer DEFAULT 120,
  financing_min_amount numeric DEFAULT 1000,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read system settings" ON public.system_settings;
CREATE POLICY "Read system settings" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins edit system settings" ON public.system_settings;
CREATE POLICY "Admins edit system settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

INSERT INTO public.system_settings (financing_enabled, financing_interest_rate, financing_max_term_months, financing_min_amount)
VALUES (true, 9.99, 120, 1000)
ON CONFLICT DO NOTHING;

-- ── STEP 21: Waitlist ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  trade text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone insert waitlist" ON public.waitlist;
CREATE POLICY "Anyone insert waitlist" ON public.waitlist FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Super admin view waitlist" ON public.waitlist;
CREATE POLICY "Super admin view waitlist" ON public.waitlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── STEP 22: AI limits increment helper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_ai_usage(org_id uuid, cents integer)
RETURNS void AS $$
BEGIN
  UPDATE public.ai_usage_limits
  SET monthly_usage_cents = monthly_usage_cents + cents,
      updated_at = now()
  WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── STEP 23: Wire approval helper (admin call) ────────────────────────
CREATE OR REPLACE FUNCTION public.approve_wire_payment(
  org_id uuid,
  new_plan text DEFAULT 'pro',
  expires_at timestamptz DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'active',
      plan = new_plan,
      wire_verified_at = now(),
      wire_verified_by = auth.uid(),
      plan_activated_at = now(),
      plan_expires_at = expires_at,
      updated_at = now()
  WHERE organization_id = org_id;

  -- Also bump billing tier on organizations
  UPDATE public.organizations
  SET billing_tier = new_plan,
      updated_at = now()
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── STEP 24: Force schema reload ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
