-- Migration: Additive Multi-Tenant and AI Estimating Platform upgrades
-- Targets: organizations, profiles, projects, project_items, price_book, templates, background_jobs, audit_logs, proposal_versions, system_settings, billing.

-- 1. Organizations table
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

CREATE POLICY "Users read own organization" ON public.organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Superadmins manage organizations" ON public.organizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 1b. Organization Settings table
CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
  company_colors jsonb DEFAULT '{"primary": "#B27150", "secondary": "#1E293B"}'::jsonb,
  invoice_terms text DEFAULT 'Due upon receipt',
  payment_methods text[] DEFAULT '{"credit_card", "bank_transfer"}'::text[],
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own organization settings" ON public.organization_settings
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage organization settings" ON public.organization_settings
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- 2. Modify profiles table to support role and tenant
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'estimator' CHECK (role IN ('super_admin', 'admin', 'sales_manager', 'estimator', 'technician', 'viewer'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beta_access boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 2b. Organization Members table (explicit link table for history/audits)
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

CREATE POLICY "Users read members of own organization" ON public.organization_members
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage organization members" ON public.organization_members
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- 3. Data-safe Tenancy Backfill Migration block
-- Automatically provisions default organizations for existing records and assigns initial superadmin roles
DO $$
DECLARE
  r RECORD;
  org_id UUID;
BEGIN
  FOR r IN SELECT id, email, full_name, company_name, is_admin FROM public.profiles WHERE organization_id IS NULL LOOP
    -- Insert new organization
    INSERT INTO public.organizations (name, billing_tier, created_at, updated_at)
    VALUES (COALESCE(r.company_name, r.full_name, 'Personal Organization'), 'free', now(), now())
    RETURNING id INTO org_id;

    -- Map profile to organization and assign roles based on is_admin status
    UPDATE public.profiles
    SET organization_id = org_id,
        role = CASE WHEN r.is_admin = true THEN 'super_admin' ELSE 'estimator' END
    WHERE id = r.id;

    -- Insert default organization settings
    INSERT INTO public.organization_settings (organization_id)
    VALUES (org_id)
    ON CONFLICT (organization_id) DO NOTHING;

    -- Insert default organization members record
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (org_id, r.id, CASE WHEN r.is_admin = true THEN 'super_admin'::text ELSE 'estimator'::text END)
    ON CONFLICT (organization_id, profile_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Extend active operational tables with tenant organization tracking
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.price_book ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.integration_requests ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization link on related operational rows
UPDATE public.projects p SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = p.user_id) WHERE organization_id IS NULL;
UPDATE public.price_book p SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = p.user_id) WHERE organization_id IS NULL AND user_id IS NOT NULL;
UPDATE public.activity_events a SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = a.user_id) WHERE organization_id IS NULL;
UPDATE public.support_tickets s SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = s.user_id) WHERE organization_id IS NULL;
UPDATE public.notifications n SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = n.user_id) WHERE organization_id IS NULL;
UPDATE public.email_logs e SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = e.user_id) WHERE organization_id IS NULL;
UPDATE public.integration_requests i SET organization_id = (SELECT organization_id FROM public.profiles WHERE id = i.user_id) WHERE organization_id IS NULL;

-- 5. Add multi-option proposal structures
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
  ADD COLUMN IF NOT EXISTS option_tier text DEFAULT 'base' CHECK (option_tier IN ('base', 'good', 'better', 'best', 'upsell')),
  ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false;

-- Create indexes for views, performance, and tenant scanning
CREATE INDEX IF NOT EXISTS idx_projects_organization ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_items_tier ON public.project_items(option_tier);

-- 6. Feature flags table
CREATE TABLE public.feature_flags (
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

CREATE POLICY "Org feature flags read" ON public.feature_flags
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage feature flags" ON public.feature_flags
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Seed basic feature flags for existing organizations
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

-- 7. AI Cost limits and Usage logging
CREATE TABLE public.ai_usage_limits (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE PRIMARY KEY,
  monthly_limit_cents integer DEFAULT 500, -- $5.00 free tier defaults
  monthly_usage_cents integer DEFAULT 0,
  last_reset_date timestamptz DEFAULT now(),
  max_requests_per_minute integer DEFAULT 5,
  request_counter integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org read AI usage limits" ON public.ai_usage_limits
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins manage AI limits" ON public.ai_usage_limits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin'))
  );

-- Seed AI limits
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

CREATE TABLE public.ai_usage_logs (
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

CREATE POLICY "Org view AI usage logs" ON public.ai_usage_logs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 8. Immutable Enterprise Audit Logging
CREATE TABLE public.audit_logs (
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

CREATE POLICY "Org view audit logs" ON public.audit_logs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 9. Proposal Versioning Snapshots
CREATE TABLE public.proposal_versions (
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

CREATE POLICY "Org view proposal snapshots" ON public.proposal_versions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Public read snapshots via share token" ON public.proposal_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
      AND p.share_token IS NOT NULL
    )
  );

-- 10. Trade templates and template items
CREATE TABLE public.templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL if global template library
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  trade text CHECK (trade IN ('electrical','roofing','hvac','painting','plumbing','drain','general','other')) DEFAULT 'general',
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read templates" ON public.templates
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
    is_global = true
  );

CREATE POLICY "Manage templates" ON public.templates
  FOR ALL USING (
    (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'sales_manager', 'estimator'))) OR
    (is_global = true AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  );

CREATE TABLE public.template_items (
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

CREATE POLICY "Read template items" ON public.template_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_id AND
      (t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR t.is_global = true)
    )
  );

CREATE POLICY "Manage template items" ON public.template_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_id AND
      t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Seed default global trade templates
DO $$
DECLARE
  tmpl_id UUID;
BEGIN
  -- 1. Electrical Template
  INSERT INTO public.templates (name, description, trade, is_global)
  VALUES ('Standard 200A Service Upgrade', 'Full residential panel replacement including wire, breakers, grounding, and municipal permit fees.', 'electrical', true)
  RETURNING id INTO tmpl_id;

  INSERT INTO public.template_items (template_id, description, quantity, unit, unit_price, category, markup, sort_order) VALUES
    (tmpl_id, '200A Meter Socket & Enclosure', 1, 'ea', 185.00, 'material', 20, 0),
    (tmpl_id, '200A Main Breaker Panel (40 spaces)', 1, 'ea', 260.00, 'material', 20, 1),
    (tmpl_id, 'Assorted Circuit Breakers (15A, 20A, 50A)', 1, 'job', 140.00, 'material', 15, 2),
    (tmpl_id, 'Copper Grounding Rods & Clamps', 2, 'ea', 28.50, 'material', 15, 3),
    (tmpl_id, 'Electrician Lead Labor', 8, 'hr', 85.00, 'labor', 30, 4),
    (tmpl_id, 'Apprentice Helper Labor', 8, 'hr', 45.00, 'labor', 30, 5),
    (tmpl_id, 'Municipal Permit & Inspection Fee', 1, 'ea', 120.00, 'other', 0, 6);

  -- 2. HVAC Template
  INSERT INTO public.templates (name, description, trade, is_global)
  VALUES ('3-Ton 14 SEER Heat Pump System Changeout', 'Replacement of existing split central heating & cooling system including condenser, coil, lineset, and digital thermostat.', 'hvac', true)
  RETURNING id INTO tmpl_id;

  INSERT INTO public.template_items (template_id, description, quantity, unit, unit_price, category, markup, sort_order) VALUES
    (tmpl_id, '3-Ton 14 SEER Heat Pump Condenser', 1, 'ea', 1650.00, 'material', 22, 0),
    (tmpl_id, 'Matching Multi-Position Evaporator Coil', 1, 'ea', 480.00, 'material', 22, 1),
    (tmpl_id, 'Smart Wi-Fi Programmable Thermostat', 1, 'ea', 145.00, 'material', 20, 2),
    (tmpl_id, 'HVAC Lead Installer Labor', 6, 'hr', 95.00, 'labor', 30, 3),
    (tmpl_id, 'Installer Helper Labor', 6, 'hr', 50.00, 'labor', 30, 4),
    (tmpl_id, 'Disposal fee for old furnace & refrigerant extraction', 1, 'ea', 150.00, 'other', 10, 5);

END $$;

-- 11. Resilient Background Job Queue
CREATE TABLE public.background_jobs (
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

CREATE POLICY "Org view background jobs" ON public.background_jobs
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 12. SaaS Subscription Tracker
CREATE TABLE public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_subscription_id text,
  status text CHECK (status IN ('active', 'past_due', 'canceled')) DEFAULT 'active',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view subscriptions" ON public.subscriptions
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- Seed subscriptions
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    INSERT INTO public.subscriptions (organization_id, status)
    VALUES (org.id, 'active')
    ON CONFLICT (organization_id) DO NOTHING;
  END LOOP;
END $$;

CREATE TABLE public.usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL CHECK (metric_name IN ('proposals_sent', 'ai_prompts', 'storage_bytes')),
  count integer DEFAULT 0,
  billing_period_start timestamptz DEFAULT now(),
  billing_period_end timestamptz
);
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org view usage tracking" ON public.usage_tracking
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- 13. System Settings
CREATE TABLE public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  financing_enabled boolean DEFAULT true,
  financing_interest_rate numeric DEFAULT 9.99,
  financing_max_term_months integer DEFAULT 120,
  financing_min_amount numeric DEFAULT 1000,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read system settings" ON public.system_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins edit system settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Seed default settings row
INSERT INTO public.system_settings (financing_enabled, financing_interest_rate, financing_max_term_months, financing_min_amount)
VALUES (true, 9.99, 120, 1000)
ON CONFLICT DO NOTHING;

-- Force notify schema reload
NOTIFY pgrst, 'reload schema';
