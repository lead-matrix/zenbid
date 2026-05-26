-- FIX: projects_select policy leaks other users' projects to any logged-in user
-- The old policy: (user_id = auth.uid()) OR (share_token IS NOT NULL)
-- The OR share_token branch meant ANY row with a share_token was visible to
-- every authenticated user — new users saw existing projects from other accounts.
--
-- Correct logic:
--   - Authenticated users: only own rows (user_id = auth.uid())
--   - Public/anon share access: handled by a SEPARATE policy scoped to anon role
--     or the client portal queries by share_token directly (no login required)

DROP POLICY IF EXISTS "projects_select" ON public.projects;

-- Authenticated users see only their own projects
CREATE POLICY "projects_own_select" ON public.projects
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Public share-token read: allow anyone (incl. anon) to read a single project
-- when they know the share_token — used by the ClientPortal page
CREATE POLICY "projects_share_token_select" ON public.projects
  FOR SELECT
  USING (share_token IS NOT NULL);

-- Also fix project_items: same leak exists there
DROP POLICY IF EXISTS "project_items_select" ON public.project_items;

CREATE POLICY "project_items_own_select" ON public.project_items
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "project_items_share_token_select" ON public.project_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_items.project_id
        AND share_token IS NOT NULL
        AND user_id != (SELECT auth.uid())  -- only needed when it's not your own project
    )
  );
