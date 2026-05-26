-- ═══════════════════════════════════════════════════════════════════
-- PeakEstimator — New Features Migration
-- Features: Job Costing, Scheduling, Homeowner Deposit Collection,
--   Recurring Contracts, Subcontractor Portal, Proposal Analytics,
--   Client Q&A, Revision Requests, Admin Wire Details Control,
--   Admin Revenue Dashboard, Org Billing Control, Impersonation Log,
--   White-label per org, Bulk Broadcast
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Admin Wire Transfer Details (stored in system_settings) ───
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS wire_bank_name text DEFAULT 'First National Commerce Bank',
  ADD COLUMN IF NOT EXISTS wire_account_name text DEFAULT 'PeakEstimator Technologies Inc.',
  ADD COLUMN IF NOT EXISTS wire_account_number text DEFAULT '8821 0047 3390 1124',
  ADD COLUMN IF NOT EXISTS wire_routing_number text DEFAULT '021 000 089',
  ADD COLUMN IF NOT EXISTS wire_swift text DEFAULT 'FNCBUS33XXX',
  ADD COLUMN IF NOT EXISTS wire_instructions text DEFAULT 'International transfers: include SWIFT code. Processing typically takes 1–3 business days.',
  ADD COLUMN IF NOT EXISTS wire_contact_email text DEFAULT 'billing@peakestimator.com';

-- ─── 2. Job Costing — actual costs on project items ───────────────
ALTER TABLE public.project_items
  ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_quantity numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_notes text DEFAULT NULL;

-- Job costing summary on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS job_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_total numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_labor numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_materials numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS actual_equipment numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS job_notes text DEFAULT NULL;

-- ─── 3. Project Scheduling ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_schedule (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  duration_hours numeric DEFAULT 1,
  assignee_ids text[] DEFAULT '{}',
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  milestone boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.project_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own schedules" ON public.project_schedule;
CREATE POLICY "Users manage own schedules" ON public.project_schedule
  FOR ALL USING (auth.uid() = user_id);

-- ─── 4. Homeowner Deposit Collection ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  percentage numeric,
  description text DEFAULT '50% deposit to secure your project',
  payment_link text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  paid_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own deposits" ON public.deposit_requests;
CREATE POLICY "Users manage own deposits" ON public.deposit_requests
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read deposit by project" ON public.deposit_requests;
CREATE POLICY "Public read deposit by project" ON public.deposit_requests
  FOR SELECT USING (true);

-- ─── 5. Proposal Analytics ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  share_token text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('viewed','section_viewed','tier_hovered','time_spent','link_opened')),
  metadata jsonb DEFAULT '{}',
  session_id text,
  ip_hash text,
  device_type text CHECK (device_type IN ('mobile','desktop','tablet')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.proposal_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert analytics" ON public.proposal_analytics;
CREATE POLICY "Public insert analytics" ON public.proposal_analytics FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own proposal analytics" ON public.proposal_analytics;
CREATE POLICY "Users read own proposal analytics" ON public.proposal_analytics
  FOR SELECT USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );

-- ─── 6. Client Q&A on Proposals ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  share_token text NOT NULL,
  client_name text,
  client_email text,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  answered_by uuid REFERENCES auth.users(id),
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.proposal_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert questions" ON public.proposal_questions;
CREATE POLICY "Public insert questions" ON public.proposal_questions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own proposal questions" ON public.proposal_questions;
CREATE POLICY "Users read own proposal questions" ON public.proposal_questions
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Public read answered questions" ON public.proposal_questions;
CREATE POLICY "Public read answered questions" ON public.proposal_questions
  FOR SELECT USING (is_public = true OR share_token IS NOT NULL);

-- ─── 7. Revision Requests ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.revision_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  share_token text NOT NULL,
  client_name text,
  client_email text,
  requested_changes text NOT NULL,
  specific_items jsonb DEFAULT '[]',
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_review','revised','closed')),
  contractor_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.revision_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert revisions" ON public.revision_requests;
CREATE POLICY "Public insert revisions" ON public.revision_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own revision requests" ON public.revision_requests;
CREATE POLICY "Users read own revision requests" ON public.revision_requests
  FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Public read own revision" ON public.revision_requests;
CREATE POLICY "Public read own revision" ON public.revision_requests
  FOR SELECT USING (true);

-- ─── 8. Recurring Maintenance Contracts ──────────────────────────
CREATE TABLE IF NOT EXISTS public.maintenance_contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  trade text DEFAULT 'general',
  title text NOT NULL,
  description text,
  monthly_amount numeric NOT NULL DEFAULT 0,
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','annually')),
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  auto_renew boolean DEFAULT true,
  scope_of_work text,
  visit_frequency text,
  inclusions text[],
  exclusions text[],
  signed_at timestamptz,
  signature_data text,
  share_token text DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own contracts" ON public.maintenance_contracts;
CREATE POLICY "Users manage own contracts" ON public.maintenance_contracts
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read maintenance contract by token" ON public.maintenance_contracts;
CREATE POLICY "Public read maintenance contract by token" ON public.maintenance_contracts
  FOR SELECT USING (true);

-- ─── 9. Subcontractor Portal ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcontractor_bids (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sub_name text NOT NULL,
  sub_email text NOT NULL,
  sub_phone text,
  trade_scope text NOT NULL,
  scope_items jsonb DEFAULT '[]',
  bid_amount numeric,
  notes text,
  status text DEFAULT 'invited' CHECK (status IN ('invited','viewed','bid_submitted','accepted','rejected')),
  bid_token text DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  invite_sent_at timestamptz DEFAULT now(),
  bid_submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.subcontractor_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own sub bids" ON public.subcontractor_bids;
CREATE POLICY "Users manage own sub bids" ON public.subcontractor_bids
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public read sub bid by token" ON public.subcontractor_bids;
CREATE POLICY "Public read sub bid by token" ON public.subcontractor_bids
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public update sub bid by token" ON public.subcontractor_bids;
CREATE POLICY "Public update sub bid by token" ON public.subcontractor_bids
  FOR UPDATE USING (true);

-- ─── 10. Admin Revenue Dashboard support ─────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS mrr numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS credits_applied numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- ─── 11. White-label per org ──────────────────────────────────────
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text DEFAULT '#B27150',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text DEFAULT '#1E293B',
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS email_from_name text,
  ADD COLUMN IF NOT EXISTS email_reply_to text;

-- ─── 12. Admin broadcast emails log ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.broadcast_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_by uuid REFERENCES auth.users(id),
  subject text NOT NULL,
  body text NOT NULL,
  target_tier text CHECK (target_tier IN ('all','free','pro','enterprise')),
  recipient_count integer DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.broadcast_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage broadcasts" ON public.broadcast_emails;
CREATE POLICY "Admins manage broadcasts" ON public.broadcast_emails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- ─── 13. Indexes for performance ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proposal_analytics_project ON public.proposal_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_analytics_token ON public.proposal_analytics(share_token);
CREATE INDEX IF NOT EXISTS idx_proposal_questions_project ON public.proposal_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_project ON public.revision_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_user ON public.maintenance_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_bids_project ON public.subcontractor_bids(project_id);
CREATE INDEX IF NOT EXISTS idx_project_schedule_project ON public.project_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_project ON public.deposit_requests(project_id);

