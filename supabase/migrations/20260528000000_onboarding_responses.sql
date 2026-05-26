-- ── Onboarding Responses Table ────────────────────────────────────────────────
-- Stores per-user, per-item responses from the Enterprise Onboarding page
-- Gives admins structured visibility into each user's setup requirements

CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  section_id      text NOT NULL,           -- e.g. 'identity', 'email', 'portal'
  item_id         text NOT NULL,           -- e.g. 'logo', 'company_name'
  item_label      text NOT NULL,
  response_text   text,                    -- free text / URL / value entered
  file_url        text,                    -- for file uploads
  is_completed    boolean DEFAULT false,   -- user marked as done
  admin_status    text DEFAULT 'pending'   -- 'pending' | 'approved' | 'needs_info' | 'skipped'
                  CHECK (admin_status IN ('pending','approved','needs_info','skipped')),
  admin_note      text,                    -- admin can leave notes per item
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, item_id)               -- one response per user per item
);

CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user   ON public.onboarding_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_responses_status ON public.onboarding_responses(admin_status);

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own responses
CREATE POLICY "onboarding_own_select" ON public.onboarding_responses
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "onboarding_own_insert" ON public.onboarding_responses
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "onboarding_own_update" ON public.onboarding_responses
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- Admins can read and update ALL responses (for tracking & approvals)
CREATE POLICY "onboarding_admin_select" ON public.onboarding_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

CREATE POLICY "onboarding_admin_update" ON public.onboarding_responses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );

-- ── Onboarding Summary View (convenience for admin queries) ──────────────────
CREATE OR REPLACE VIEW public.onboarding_summary AS
SELECT
  p.id            AS user_id,
  p.full_name,
  p.email,
  p.company_name,
  p.trade,
  p.plan_tier,
  p.onboarding_completed,
  p.created_at    AS signed_up_at,
  COUNT(r.id)                                           AS total_items_submitted,
  COUNT(r.id) FILTER (WHERE r.is_completed)            AS items_completed,
  COUNT(r.id) FILTER (WHERE r.admin_status = 'pending' AND r.is_completed) AS pending_review,
  COUNT(r.id) FILTER (WHERE r.admin_status = 'needs_info')                 AS needs_info,
  COUNT(r.id) FILTER (WHERE r.admin_status = 'approved')                   AS approved_items,
  MAX(r.updated_at)                                     AS last_activity
FROM public.profiles p
LEFT JOIN public.onboarding_responses r ON r.user_id = p.id
GROUP BY p.id, p.full_name, p.email, p.company_name, p.trade, p.plan_tier,
         p.onboarding_completed, p.created_at;
