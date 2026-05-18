-- 1. Fix multiple_permissive_policies on projects
DROP POLICY IF EXISTS "Projects select" ON projects;
DROP POLICY IF EXISTS "Projects update" ON projects;
DROP POLICY IF EXISTS "Projects insert_delete" ON projects;

CREATE POLICY "projects_select" ON projects FOR SELECT USING (
  (user_id = (select auth.uid())) OR (share_token IS NOT NULL)
);
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (
  user_id = (select auth.uid())
);
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  (user_id = (select auth.uid())) OR (share_token IS NOT NULL)
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  user_id = (select auth.uid())
);

-- 2. Fix multiple_permissive_policies on project_items
DROP POLICY IF EXISTS "Project items select" ON project_items;
DROP POLICY IF EXISTS "Project items write" ON project_items;

CREATE POLICY "project_items_select" ON project_items FOR SELECT USING (
  (user_id = (select auth.uid())) OR 
  (EXISTS (SELECT 1 FROM projects WHERE id = project_items.project_id AND share_token IS NOT NULL))
);
CREATE POLICY "project_items_insert" ON project_items FOR INSERT WITH CHECK (
  user_id = (select auth.uid())
);
CREATE POLICY "project_items_update" ON project_items FOR UPDATE USING (
  user_id = (select auth.uid())
);
CREATE POLICY "project_items_delete" ON project_items FOR DELETE USING (
  user_id = (select auth.uid())
);

-- 3. Fix unindexed_foreign_keys
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_items_user_id ON project_items(user_id);
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_price_book_user_id ON price_book(user_id);
