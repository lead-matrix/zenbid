-- ============================================================
-- PeakEstimator Phase 2 + 3 Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── PHASE 2: organization_usage table ──────────────────────
CREATE TABLE IF NOT EXISTS public.organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  ai_requests_used INTEGER NOT NULL DEFAULT 0,
  ai_cost_cents INTEGER NOT NULL DEFAULT 0,
  projects_created INTEGER NOT NULL DEFAULT 0,
  proposals_sent INTEGER NOT NULL DEFAULT 0,
  members_count INTEGER NOT NULL DEFAULT 0,
  storage_bytes_used BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, period_start)
);

ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_usage'
    AND policyname = 'org_isolation_usage'
  ) THEN
    CREATE POLICY "org_isolation_usage" ON public.organization_usage
      USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── PHASE 2: upsert_org_usage RPC ───────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_org_usage(
  p_org_id         UUID,
  p_ai_tokens      INTEGER DEFAULT 0,
  p_ai_requests    INTEGER DEFAULT 0,
  p_ai_cost_cents  INTEGER DEFAULT 0,
  p_projects       INTEGER DEFAULT 0,
  p_proposals      INTEGER DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_end   DATE := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
  INSERT INTO public.organization_usage(
    organization_id, period_start, period_end,
    ai_tokens_used, ai_requests_used, ai_cost_cents,
    projects_created, proposals_sent, updated_at
  ) VALUES (
    p_org_id, v_start, v_end,
    p_ai_tokens, p_ai_requests, p_ai_cost_cents,
    p_projects, p_proposals, NOW()
  )
  ON CONFLICT (organization_id, period_start) DO UPDATE SET
    ai_tokens_used   = organization_usage.ai_tokens_used   + EXCLUDED.ai_tokens_used,
    ai_requests_used = organization_usage.ai_requests_used + EXCLUDED.ai_requests_used,
    ai_cost_cents    = organization_usage.ai_cost_cents    + EXCLUDED.ai_cost_cents,
    projects_created = organization_usage.projects_created + EXCLUDED.projects_created,
    proposals_sent   = organization_usage.proposals_sent   + EXCLUDED.proposals_sent,
    updated_at       = NOW();
END $$;

-- ── PHASE 3: organizations.onboarding_completed ─────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ── PHASE 3: sync profile → org trigger ─────────────────────
CREATE OR REPLACE FUNCTION public.sync_profile_to_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    UPDATE public.organizations SET
      name       = COALESCE(NULLIF(NEW.company_name, ''), name),
      logo_url   = COALESCE(NULLIF(NEW.logo_url, ''),   logo_url),
      updated_at = NOW()
    WHERE id = NEW.organization_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_org ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_org
  AFTER INSERT OR UPDATE OF company_name, logo_url
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_org();

-- ── PHASE 3: performance indexes ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_organization_usage_org_period
  ON public.organization_usage(organization_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_projects_org_id
  ON public.projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user
  ON public.organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org
  ON public.organization_members(organization_id);

-- ── VERIFY ──────────────────────────────────────────────────
SELECT
  'organization_usage'  AS table_name,
  COUNT(*) AS row_count
FROM public.organization_usage
UNION ALL
SELECT 'organizations' , COUNT(*) FROM public.organizations
UNION ALL
SELECT 'organization_members', COUNT(*) FROM public.organization_members;
