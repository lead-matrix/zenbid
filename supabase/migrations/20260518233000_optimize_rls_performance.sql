-- 1. Profiles Table
DROP POLICY IF EXISTS "Own profile only" ON profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;

CREATE POLICY "Profiles access" ON profiles FOR SELECT USING (
  (id = (select auth.uid())) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND is_admin = true))
);
CREATE POLICY "Profiles update" ON profiles FOR UPDATE USING (id = (select auth.uid()));
CREATE POLICY "Profiles delete" ON profiles FOR DELETE USING (id = (select auth.uid()));

-- 2. Projects Table
DROP POLICY IF EXISTS "Own projects only" ON projects;
DROP POLICY IF EXISTS "Public share token read" ON projects;
DROP POLICY IF EXISTS "Public client approval" ON projects;

CREATE POLICY "Projects select" ON projects FOR SELECT USING (
  (user_id = (select auth.uid())) OR (share_token IS NOT NULL)
);
CREATE POLICY "Projects update" ON projects FOR UPDATE USING (
  (user_id = (select auth.uid())) OR (share_token IS NOT NULL)
);
CREATE POLICY "Projects insert_delete" ON projects FOR ALL USING (
  (user_id = (select auth.uid()))
);

-- 3. Project Items Table
DROP POLICY IF EXISTS "Own items only" ON project_items;
DROP POLICY IF EXISTS "Public items read via project" ON project_items;

CREATE POLICY "Project items select" ON project_items FOR SELECT USING (
  (user_id = (select auth.uid())) OR (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND share_token IS NOT NULL))
);
CREATE POLICY "Project items write" ON project_items FOR ALL USING (
  (user_id = (select auth.uid()))
);

-- 4. Price Book Table
DROP POLICY IF EXISTS "Own + global price book" ON price_book;
DROP POLICY IF EXISTS "Own price book write" ON price_book;
DROP POLICY IF EXISTS "Own price book update" ON price_book;
DROP POLICY IF EXISTS "Own price book delete" ON price_book;

CREATE POLICY "Price book select" ON price_book FOR SELECT USING (
  (user_id = (select auth.uid())) OR (is_global = true)
);
CREATE POLICY "Price book insert" ON price_book FOR INSERT WITH CHECK (
  (user_id = (select auth.uid()))
);
CREATE POLICY "Price book update" ON price_book FOR UPDATE USING (
  (user_id = (select auth.uid()))
);
CREATE POLICY "Price book delete" ON price_book FOR DELETE USING (
  (user_id = (select auth.uid()))
);

-- 5. Waitlist Table
DROP POLICY IF EXISTS "Auth read waitlist" ON waitlist;
CREATE POLICY "Auth read waitlist" ON waitlist FOR SELECT USING (
  (select auth.uid()) IS NOT NULL
);
