-- ─────────────────────────────────────────────────────────────────
-- PeakEstimator Database Schema Export
-- Version: Production SaaS Estimating Engine
-- Stack: Supabase + PostgreSQL
-- ─────────────────────────────────────────────────────────────────

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Enable schema cache reloading
NOTIFY pgrst, 'reload schema';

-- ─── 1. Tenant Organizations ───────────────────────────────────────────
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

-- ─── 2. Profiles (Contractors, Admins, Estimators) ───────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  email text UNIQUE NOT NULL,
  full_name text,
  role text DEFAULT 'estimator' CHECK (role IN ('super_admin', 'org_admin', 'estimator')),
  phone text,
  company_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ─── 3. Projects (Proposals) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, 
  client_name text, 
  client_email text, 
  client_phone text,
  status text DEFAULT 'lead' CHECK (status IN ('lead','bidding','sent','approved','won','lost')),
  trade text DEFAULT 'general' CHECK (trade IN ('electrical','roofing','hvac','painting','plumbing','drain','general','other')),
  subtotal numeric DEFAULT 0, 
  margin_amount numeric DEFAULT 0, 
  tax_amount numeric DEFAULT 0, 
  total_value numeric DEFAULT 0,
  labor_markup numeric DEFAULT 30, 
  material_markup numeric DEFAULT 18, 
  equipment_markup numeric DEFAULT 12, 
  tax_rate numeric DEFAULT 8,
  notes text, 
  share_token text DEFAULT encode(gen_random_bytes(16), 'hex'),
  client_approved_at timestamptz, 
  client_message text, 
  follow_up_sent_at timestamptz,
  project_address text, 
  start_date date, 
  valid_until date,
  company_name text, 
  company_email text, 
  company_phone text, 
  company_logo text,
  signature_data text,
  is_multi_option boolean DEFAULT false,
  selected_option_tier text CHECK (selected_option_tier IN ('base', 'good', 'better', 'best')) DEFAULT 'base',
  selected_tier text CHECK (selected_tier IN ('good', 'better', 'best')) DEFAULT null,
  good_total numeric DEFAULT 0,
  better_total numeric DEFAULT 0,
  best_total numeric DEFAULT 0,
  views_count integer DEFAULT 0,
  time_to_close_days numeric DEFAULT null,
  lost_reason text DEFAULT null,
  estimator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(), 
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ─── 4. Project Proposal Line Items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description text, 
  quantity numeric DEFAULT 1, 
  unit text DEFAULT 'ea', 
  unit_price numeric DEFAULT 0,
  category text DEFAULT 'material' CHECK (category IN ('material','labor','equipment','other')),
  markup numeric DEFAULT 15, 
  total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order integer DEFAULT 0, 
  from_price_book boolean DEFAULT false,
  option_tier text DEFAULT 'base' CHECK (option_tier IN ('base', 'good', 'better', 'best', 'upsell')),
  created_at timestamptz DEFAULT now(), 
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.project_items ENABLE ROW LEVEL SECURITY;

-- ─── 5. Trade Price Books ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.price_book (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, 
  description text,
  trade text CHECK (trade IN ('electrical','roofing','hvac','painting','plumbing','drain','general','other')),
  category text CHECK (category IN ('material','labor','equipment','other')),
  default_unit_price numeric DEFAULT 0, 
  unit text DEFAULT 'ea', 
  default_markup numeric DEFAULT 15,
  tags text, 
  is_global boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.price_book ENABLE ROW LEVEL SECURITY;

-- ─── 6. Proposal Templates ────────────────────────────────────────────
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

-- ─── 7. Proposal Template Items ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES public.templates(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'ea',
  unit_price numeric DEFAULT 0,
  category text CHECK (category IN ('material','labor','equipment','other')) DEFAULT 'material',
  markup numeric DEFAULT 15,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.template_items ENABLE ROW LEVEL SECURITY;

-- ─── 8. Immutable Enterprise Audit Logging ────────────────────────────
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

-- ─── 9. Proposal Versioning Snapshots ─────────────────────────────────
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

-- ─── 10. SaaS Subscription Tracker ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stripe_subscription_id text,
  status text CHECK (status IN ('active', 'past_due', 'canceled')) DEFAULT 'active',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ─── 11. SaaS AI Limits & Usage Logs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE NOT NULL,
  monthly_usage_cents integer DEFAULT 0,
  monthly_limit_cents integer DEFAULT 500, -- $5.00 free tier defaults
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  cost numeric DEFAULT 0,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- ─── 12. Email Follow-up & Notification Logs ────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  template_type text NOT NULL,
  subject text NOT NULL,
  delivery_status text DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'opened', 'clicked', 'bounced')),
  provider text DEFAULT 'smtp',
  provider_message_id text,
  error_message text,
  html_preview text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─── 13. System settings, background jobs & early access waitlist ────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  financing_enabled boolean DEFAULT true,
  financing_interest_rate numeric DEFAULT 9.99,
  financing_max_term_months integer DEFAULT 120,
  financing_min_amount numeric DEFAULT 1000,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  job_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  run_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  trade text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL CHECK (metric_name IN ('proposals_sent', 'ai_prompts', 'storage_bytes')),
  count integer DEFAULT 0,
  billing_period_start timestamptz DEFAULT now(),
  billing_period_end timestamptz
);
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;


-- ─── ROW LEVEL SECURITY POLICIES ──────────────────────────────────────

-- Profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations
CREATE POLICY "Users read own organization" ON public.organizations FOR SELECT USING (
  id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Projects
CREATE POLICY "Own projects only" ON public.projects FOR ALL USING (
  auth.uid() = user_id OR 
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Public share token read" ON public.projects FOR SELECT USING (share_token is not null);
CREATE POLICY "Public client approval" ON public.projects FOR UPDATE USING (share_token is not null) WITH CHECK (share_token is not null);

-- Project Items
CREATE POLICY "Own items only" ON public.project_items FOR ALL USING (
  auth.uid() = user_id OR 
  project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid() OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
);
CREATE POLICY "Public items read via project" ON public.project_items FOR SELECT USING (
  exists (SELECT 1 FROM projects p WHERE p.id = project_id AND p.share_token is not null)
);

-- Price Book
CREATE POLICY "Own + global price book" ON public.price_book FOR SELECT USING (
  auth.uid() = user_id OR 
  is_global = true OR 
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Own price book write" ON public.price_book FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own price book update" ON public.price_book FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Own price book delete" ON public.price_book FOR DELETE USING (auth.uid() = user_id);

-- Templates
CREATE POLICY "Read templates" ON public.templates FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR is_global = true
);
CREATE POLICY "Manage templates" ON public.templates FOR ALL USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Audit Logs
CREATE POLICY "Org view audit logs" ON public.audit_logs FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Proposal Versions
CREATE POLICY "Org view proposal snapshots" ON public.proposal_versions FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Public read snapshots via share token" ON public.proposal_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.share_token IS NOT NULL)
);

-- Subscriptions
CREATE POLICY "Org view subscriptions" ON public.subscriptions FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- AI Limits & Usage
CREATE POLICY "Org view AI limits" ON public.ai_usage_limits FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Org view AI logs" ON public.ai_usage_logs FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- System Settings
CREATE POLICY "Read system settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins edit system settings" ON public.system_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Background Jobs
CREATE POLICY "Org view background jobs" ON public.background_jobs FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Usage Tracking
CREATE POLICY "Org view usage tracking" ON public.usage_tracking FOR SELECT USING (
  organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Waitlist
CREATE POLICY "Anyone insert waitlist" ON public.waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admin view waitlist" ON public.waitlist FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);


-- ─── SYSTEM FUNCTIONS AND PROCEDURES ────────────────────────────────────

-- Auto Profile Trigger for Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
BEGIN
  -- Create organization for new signups
  INSERT INTO public.organizations (name, billing_tier)
  VALUES ('My Organization', 'free')
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organization_id, email, full_name, role)
  VALUES (
    new.id,
    new_org_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Professional Estimator'),
    'org_admin'
  );

  -- Initialize AI limits
  INSERT INTO public.ai_usage_limits (organization_id, monthly_limit_cents)
  VALUES (new_org_id, 500);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- AI limits increment RPC
CREATE OR REPLACE FUNCTION public.increment_ai_usage(org_id uuid, cents integer)
RETURNS void AS $$
BEGIN
  UPDATE public.ai_usage_limits
  SET monthly_usage_cents = monthly_usage_cents + cents,
      updated_at = now()
  WHERE organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── SEED DATA ────────────────────────────────────────────────────────

-- Default settings row
INSERT INTO public.system_settings (financing_enabled, financing_interest_rate, financing_max_term_months, financing_min_amount)
VALUES (true, 9.99, 120, 1000)
ON CONFLICT DO NOTHING;

-- Global Price Book Core Items
INSERT INTO public.price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) VALUES
  -- Electrical
  ('Wire 12 AWG','electrical','material',0.45,'ft',18,true,null),
  ('Wire 10 AWG','electrical','material',0.65,'ft',18,true,null),
  ('Romex 14/2','electrical','material',0.38,'ft',18,true,null),
  ('Electrical Outlet (duplex)','electrical','material',4.50,'ea',20,true,null),
  ('GFCI Outlet','electrical','material',18.00,'ea',20,true,null),
  ('Circuit Breaker (20A)','electrical','material',12.00,'ea',22,true,null),
  ('200A Panel Upgrade','electrical','material',450.00,'ea',25,true,null),
  ('Light Switch','electrical','material',3.50,'ea',20,true,null),
  ('Recessed Light (6in)','electrical','material',22.00,'ea',20,true,null),
  ('Electrician Labor','electrical','labor',85.00,'hr',30,true,null),
  ('Apprentice Labor','electrical','labor',45.00,'hr',30,true,null),
  ('Conduit 1/2in EMT','electrical','material',1.20,'ft',18,true,null),
  -- Roofing
  ('Asphalt Shingles','roofing','material',110.00,'sq',15,true,null),
  ('Architectural Shingles','roofing','material',160.00,'sq',15,true,null),
  ('Underlayment','roofing','material',22.00,'sq',15,true,null),
  ('Roof Decking','roofing','material',85.00,'sq',15,true,null),
  ('Ice & Water Shield','roofing','material',55.00,'sq',15,true,null),
  ('Ridge Cap','roofing','material',3.50,'lf',18,true,null),
  ('Drip Edge','roofing','material',1.80,'lf',18,true,null),
  ('Flashing (step)','roofing','material',2.50,'lf',18,true,null),
  ('Roofing Labor','roofing','labor',75.00,'sq',30,true,null),
  ('Tear Off Labor','roofing','labor',35.00,'sq',30,true,null),
  ('Dumpster Rental','roofing','equipment',350.00,'ea',10,true,null),
  -- Plumbing
  ('Copper Pipe 1/2in','plumbing','material',2.80,'ft',18,true,null),
  ('PVC Pipe 3in','plumbing','material',1.90,'ft',18,true,null),
  ('PEX Tubing 1/2in','plumbing','material',0.55,'ft',18,true,null),
  ('Ball Valve 3/4in','plumbing','material',14.00,'ea',22,true,null),
  ('Toilet (standard)','plumbing','material',180.00,'ea',20,true,null),
  ('Kitchen Faucet','plumbing','material',145.00,'ea',20,true,null),
  ('Water Heater (50gal)','plumbing','material',650.00,'ea',22,true,null),
  ('Plumber Labor','plumbing','labor',95.00,'hr',30,true,null),
  ('Drain Cleaning','plumbing','labor',185.00,'ea',30,true,null),
  -- General
  ('Concrete','general','material',145.00,'cy',15,true,null),
  ('Lumber 2x4x8','general','material',5.50,'ea',15,true,null),
  ('Drywall 4x8 sheet','general','material',14.00,'ea',15,true,null),
  ('Drywall Labor','general','labor',2.20,'sqft',30,true,null),
  ('General Labor','general','labor',55.00,'hr',30,true,null),
  ('Foreman','general','labor',85.00,'hr',30,true,null),
  ('Insulation','general','material',1.80,'sqft',15,true,null),
  ('Flooring Tile','general','material',4.50,'sqft',18,true,null),
  ('Hardwood Flooring','general','material',8.00,'sqft',18,true,null),
  ('Excavation','general','equipment',185.00,'hr',15,true,null),
  ('Cleanup & Disposal','general','labor',250.00,'day',20,true,null)
ON CONFLICT DO NOTHING;
