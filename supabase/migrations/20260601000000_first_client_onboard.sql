-- Setup first client (og@lmtrx.us) as super_admin
UPDATE public.profiles
SET 
  role = 'super_admin',
  is_admin = true
WHERE email = 'og@lmtrx.us';
