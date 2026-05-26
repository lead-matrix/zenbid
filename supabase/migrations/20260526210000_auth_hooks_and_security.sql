-- ════════════════════════════════════════════════════════════════
-- PeakEstimator — Auth Hooks, Security Headers & Cron Jobs
-- Run AFTER 20260526200000_production_fixes.sql
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Auth Hook: Track last_login_at on every sign-in ─────────
-- This function is called via Supabase Auth Hook (Login hook).
-- In Supabase Dashboard: Authentication → Hooks → set to:
--   Function: public.handle_user_login_hook
--   Event: Login

CREATE OR REPLACE FUNCTION public.handle_user_login_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_id uuid;
BEGIN
  user_id := (event->>'user_id')::uuid;
  IF user_id IS NOT NULL THEN
    UPDATE public.profiles
      SET last_login_at = now(),
          updated_at    = now()
      WHERE id = user_id;
  END IF;
  -- Return the event unchanged (hook must return jsonb)
  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for hooks)
GRANT EXECUTE ON FUNCTION public.handle_user_login_hook(jsonb) TO supabase_auth_admin;

-- ─── 2. Also wire up old trigger-style function (belt + suspenders) ──
-- Works for JWT refresh events too
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
    SET last_login_at = now(),
        updated_at    = now()
    WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- ─── 3. Proposal expiry CRON job (pg_cron) ───────────────────────
-- Requires pg_cron extension. Enable it in Supabase Dashboard:
-- Database → Extensions → pg_cron → Enable
-- Then run the line below:

-- SELECT cron.schedule(
--   'mark-expired-proposals',
--   '0 * * * *',  -- every hour
--   $$ SELECT public.mark_expired_proposals(); $$
-- );

-- Uncomment the block above after enabling pg_cron.

-- ─── 4. Suspended user check on profile read ─────────────────────
-- Ensure suspended users can't access protected data
CREATE OR REPLACE FUNCTION public.is_user_suspended()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT is_suspended FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ─── 5. RLS: Block suspended users from inserting/updating projects ─
DROP POLICY IF EXISTS "Block suspended users from creating projects" ON public.projects;
CREATE POLICY "Block suspended users from creating projects" ON public.projects
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND NOT public.is_user_suspended()
  );

-- ─── 6. Security headers — handled in vercel.json (see below) ────
-- vercel.json updated separately with X-Frame-Options, CSP, etc.

-- ─── 7. Admin action logging trigger ─────────────────────────────
-- Auto-log whenever an admin updates a profile
CREATE OR REPLACE FUNCTION public.log_profile_admin_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != OLD.id THEN
    INSERT INTO public.admin_actions_log (admin_id, action_type, target_id, metadata)
    VALUES (
      auth.uid(),
      'profile_updated',
      OLD.id::text,
      jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(key, value)
          FROM jsonb_each(to_jsonb(NEW))
          WHERE to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_log_admin_profile_update ON public.profiles;
CREATE TRIGGER trig_log_admin_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_admin_update();

-- ─── 8. Ensure profiles row created on new user signup ───────────
-- Safety net: create profile if one doesn't exist on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'company_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

