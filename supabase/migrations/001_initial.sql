-- PeakEstimator — Initial Schema Migration
create extension if not exists "pgcrypto";

-- profiles
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text, full_name text, company_name text, company_email text,
  company_phone text, company_logo text,
  default_labor_markup numeric default 30, default_material_markup numeric default 18,
  default_equipment_markup numeric default 12, default_tax_rate numeric default 8,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Own profile only" on profiles for all using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- projects
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null, client_name text, client_email text, client_phone text,
  status text default 'lead' check (status in ('lead','bidding','sent','approved','won','lost')),
  trade text default 'general' check (trade in ('electrical','roofing','hvac','painting','plumbing','drain','general','other')),
  subtotal numeric default 0, margin_amount numeric default 0, tax_amount numeric default 0, total_value numeric default 0,
  labor_markup numeric default 30, material_markup numeric default 18, equipment_markup numeric default 12, tax_rate numeric default 8,
  notes text, share_token text default encode(gen_random_bytes(16), 'hex'),
  client_approved_at timestamptz, client_message text, follow_up_sent_at timestamptz,
  project_address text, start_date date, valid_until date,
  company_name text, company_email text, company_phone text, company_logo text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table projects enable row level security;
create policy "Own projects only" on projects for all using (auth.uid() = user_id);
create policy "Public share token read" on projects for select using (share_token is not null);
create policy "Public client approval" on projects for update
  using (share_token is not null)
  with check (share_token is not null);

-- project_items
create table if not exists project_items (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text, quantity numeric default 1, unit text default 'ea', unit_price numeric default 0,
  category text default 'material' check (category in ('material','labor','equipment','other')),
  markup numeric default 15, total numeric generated always as (quantity * unit_price) stored,
  sort_order integer default 0, from_price_book boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table project_items enable row level security;
create policy "Own items only" on project_items for all using (auth.uid() = user_id);
create policy "Public items read via project" on project_items for select
  using (exists (
    select 1 from projects p
    where p.id = project_id
    and p.share_token is not null
  ));

-- price_book
create table if not exists price_book (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null, description text,
  trade text check (trade in ('electrical','roofing','hvac','painting','plumbing','drain','general','other')),
  category text check (category in ('material','labor','equipment','other')),
  default_unit_price numeric default 0, unit text default 'ea', default_markup numeric default 15,
  tags text, is_global boolean default false, created_at timestamptz default now()
);
alter table price_book enable row level security;
create policy "Own + global price book" on price_book for select using (auth.uid() = user_id or is_global = true);
create policy "Own price book write" on price_book for insert with check (auth.uid() = user_id);
create policy "Own price book update" on price_book for update using (auth.uid() = user_id);
create policy "Own price book delete" on price_book for delete using (auth.uid() = user_id);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('company-logos', 'company-logos', true) on conflict (id) do nothing;
create policy "Logo upload" on storage.objects for insert with check (bucket_id = 'company-logos' and auth.uid() is not null);
create policy "Logo read" on storage.objects for select using (bucket_id = 'company-logos');
create policy "Logo update" on storage.objects for update using (bucket_id = 'company-logos' and auth.uid() is not null);

-- SEED: Electrical (12)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
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
  ('Conduit 1/2in EMT','electrical','material',1.20,'ft',18,true,null);

-- SEED: Roofing (11)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
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
  ('Dumpster Rental','roofing','equipment',350.00,'ea',10,true,null);

-- SEED: Plumbing (9)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
  ('Copper Pipe 1/2in','plumbing','material',2.80,'ft',18,true,null),
  ('PVC Pipe 3in','plumbing','material',1.90,'ft',18,true,null),
  ('PEX Tubing 1/2in','plumbing','material',0.55,'ft',18,true,null),
  ('Ball Valve 3/4in','plumbing','material',14.00,'ea',22,true,null),
  ('Toilet (standard)','plumbing','material',180.00,'ea',20,true,null),
  ('Kitchen Faucet','plumbing','material',145.00,'ea',20,true,null),
  ('Water Heater (50gal)','plumbing','material',650.00,'ea',22,true,null),
  ('Plumber Labor','plumbing','labor',95.00,'hr',30,true,null),
  ('Drain Cleaning','plumbing','labor',185.00,'ea',30,true,null);

-- SEED: Drain & Sewer (34)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
  ('Drain Snake / Auger','drain','labor',175.00,'visit',35,true,null),
  ('Hydro Jetting (main line)','drain','labor',495.00,'visit',35,true,null),
  ('Hydro Jetting (secondary line)','drain','labor',295.00,'visit',35,true,null),
  ('Sewer Camera Inspection','drain','labor',225.00,'visit',30,true,null),
  ('Sewer Line Locate / Marking','drain','labor',150.00,'visit',25,true,null),
  ('Drain Cleaning (kitchen sink)','drain','labor',145.00,'visit',35,true,null),
  ('Drain Cleaning (bathroom sink/tub)','drain','labor',125.00,'visit',35,true,null),
  ('Drain Cleaning (floor drain)','drain','labor',165.00,'visit',35,true,null),
  ('Main Sewer Line Cleaning','drain','labor',325.00,'visit',35,true,null),
  ('Root Cutting (mechanical)','drain','labor',385.00,'visit',35,true,null),
  ('Sewer Line Repair (spot)','drain','labor',1200.00,'ea',30,true,null),
  ('Sewer Line Replacement','drain','labor',95.00,'ft',30,true,null),
  ('Pipe Bursting / Trenchless Repair','drain','labor',3500.00,'ea',25,true,null),
  ('CIPP Lining','drain','labor',85.00,'ft',25,true,null),
  ('Grease Trap Cleaning','drain','labor',285.00,'visit',30,true,null),
  ('Grease Trap Pumping (per gallon)','drain','labor',0.45,'gal',25,true,null),
  ('Catch Basin Cleaning','drain','labor',350.00,'ea',28,true,null),
  ('Storm Drain Cleaning','drain','labor',425.00,'visit',28,true,null),
  ('Lift Station Service','drain','labor',650.00,'visit',25,true,null),
  ('P-Trap Replacement','drain','labor',125.00,'ea',35,true,null),
  ('Clean-Out Installation','drain','labor',450.00,'ea',30,true,null),
  ('Clean-Out Cap Replacement','drain','material',18.00,'ea',20,true,null),
  ('PVC Drain Pipe 4in','drain','material',3.80,'ft',18,true,null),
  ('PVC Drain Pipe 6in','drain','material',6.50,'ft',18,true,null),
  ('ABS Pipe 3in','drain','material',2.90,'ft',18,true,null),
  ('Drain Cover / Grate','drain','material',22.00,'ea',20,true,null),
  ('Bio-Enzyme Drain Treatment','drain','material',45.00,'ea',25,true,null),
  ('Drain Machine Rental','drain','equipment',185.00,'day',15,true,null),
  ('Hydro Jetter Equipment','drain','equipment',95.00,'hr',15,true,null),
  ('Camera Equipment','drain','equipment',75.00,'hr',15,true,null),
  ('Vactor Truck Service','drain','equipment',350.00,'hr',15,true,null),
  ('Excavation for Sewer','drain','equipment',195.00,'hr',15,true,null),
  ('Emergency / After-Hours Fee','drain','other',175.00,'visit',0,true,null),
  ('Trip / Diagnostic Fee','drain','other',95.00,'visit',0,true,null);

-- SEED: Painting (8)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
  ('Paint (interior)','painting','material',42.00,'gal',15,true,null),
  ('Paint (exterior)','painting','material',52.00,'gal',15,true,null),
  ('Primer','painting','material',28.00,'gal',15,true,null),
  ('Interior Wall Paint Labor','painting','labor',1.50,'sqft',35,true,null),
  ('Exterior Paint Labor','painting','labor',2.20,'sqft',35,true,null),
  ('Cabinet Painting Labor','painting','labor',45.00,'ea',35,true,null),
  ('Ceiling Paint Labor','painting','labor',1.25,'sqft',35,true,null),
  ('Drop Cloths & Tape','painting','material',25.00,'job',10,true,null);

-- SEED: HVAC (8)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
  ('HVAC Unit (2-ton)','hvac','equipment',1800.00,'ea',20,true,null),
  ('HVAC Unit (3-ton)','hvac','equipment',2400.00,'ea',20,true,null),
  ('Ductwork','hvac','material',12.00,'lf',18,true,null),
  ('Thermostat (smart)','hvac','material',175.00,'ea',22,true,null),
  ('Air Filter MERV 11','hvac','material',18.00,'ea',15,true,null),
  ('HVAC Labor (install)','hvac','labor',95.00,'hr',30,true,null),
  ('HVAC Maintenance','hvac','labor',150.00,'visit',30,true,null),
  ('Refrigerant R-410A','hvac','material',35.00,'lb',25,true,null);

-- SEED: General (11)
insert into price_book (name, trade, category, default_unit_price, unit, default_markup, is_global, user_id) values
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
  ('Cleanup & Disposal','general','labor',250.00,'day',20,true,null);
