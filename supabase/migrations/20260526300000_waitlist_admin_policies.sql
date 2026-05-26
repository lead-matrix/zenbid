-- Fix: Add DELETE and UPDATE policies for waitlist so admins can remove/manage entries
-- The previous migrations only added INSERT and SELECT — delete was silently blocked by RLS.

-- Admin DELETE policy (super_admin or admin role)
DROP POLICY IF EXISTS "Admin delete waitlist" ON public.waitlist;
CREATE POLICY "Admin delete waitlist" ON public.waitlist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Admin UPDATE policy (for future status fields)
DROP POLICY IF EXISTS "Admin update waitlist" ON public.waitlist;
CREATE POLICY "Admin update waitlist" ON public.waitlist
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Also widen the SELECT policy to include admin (not just super_admin)
DROP POLICY IF EXISTS "Super admin view waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Auth read waitlist" ON public.waitlist;
CREATE POLICY "Admin view waitlist" ON public.waitlist
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );
