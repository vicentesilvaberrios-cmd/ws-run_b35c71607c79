-- =============================================
-- 0001_init.sql — Momo: esquema completo
-- =============================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- -------------------------------------------
-- 1. organizations
-- -------------------------------------------
create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------
-- 2. memberships
-- -------------------------------------------
create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin','member')),
  created_at  timestamptz not null default now(),
  unique(org_id, user_id)
);

-- -------------------------------------------
-- 3. services
-- -------------------------------------------
create table if not exists services (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  duration_min  int not null check (duration_min > 0),
  price         numeric(10,2) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------
-- 4. business_hours
-- -------------------------------------------
create table if not exists business_hours (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  weekday     int not null check (weekday >= 0 and weekday <= 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  created_at  timestamptz not null default now()
);

-- -------------------------------------------
-- 5. breaks
-- -------------------------------------------
create table if not exists breaks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  weekday     int not null check (weekday >= 0 and weekday <= 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  created_at  timestamptz not null default now()
);

-- -------------------------------------------
-- 6. appointments (with EXCLUDE anti-overlap)
-- -------------------------------------------
create table if not exists appointments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  service_id     uuid not null references services(id) on delete restrict,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null check (ends_at > starts_at),
  customer_name  text not null,
  customer_phone text not null,
  customer_email text not null,
  status         text not null default 'booked' check (status in ('booked','cancelled')),
  created_at     timestamptz not null default now(),
  constraint no_overlap_booked
    exclude using gist (org_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status = 'booked')
);

-- -------------------------------------------
-- 7. SECURITY DEFINER helper functions
--    (set search_path = public to avoid RLS recursion 42P17)
-- -------------------------------------------
create or replace function is_member(p_org uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function is_admin(p_org uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where org_id = p_org and user_id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------
-- 8. Trigger: handle_new_user
--    Creates organization + admin membership atomically.
--    Slug derived from business name, guaranteed unique.
-- -------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug   text;
  v_name   text;
begin
  -- Try to get a business name from raw_user_meta_data; fallback to email
  v_name := coalesce(new.raw_user_meta_data->>'business_name', split_part(new.email, '@', 1));

  -- Generate a unique slug from the name
  v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then
    v_slug := 'negocio';
  end if;
  v_slug := v_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  -- Create the organization
  insert into organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  -- Create admin membership
  insert into memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- -------------------------------------------
-- 9. RPC: public_services(slug)
--    Returns active services for a business (public, no auth)
-- -------------------------------------------
create or replace function public_services(p_slug text)
returns table (
  id           uuid,
  name         text,
  duration_min int,
  price        numeric,
  org_name     text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name, s.duration_min, s.price, o.name as org_name
  from services s
  join organizations o on o.id = s.org_id
  where o.slug = p_slug and s.is_active = true
  order by s.name;
$$;

-- -------------------------------------------
-- 10. RPC: public_availability(slug, service_id, p_date)
--     Returns available slots {starts_at, ends_at}
-- -------------------------------------------
create or replace function public_availability(p_slug text, p_service_id uuid, p_date date)
returns table (
  starts_at timestamptz,
  ends_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id     uuid;
  v_duration   int;
  v_weekday    int;
  v_bh         business_hours%rowtype;
  v_start_ts   timestamptz;
  v_end_ts     timestamptz;
  v_slot_start timestamptz;
  v_slot_end   timestamptz;
  v_overlap    boolean;
begin
  -- Find the org by slug
  select id into v_org_id from organizations where slug = p_slug;
  if v_org_id is null then
    return;
  end if;

  -- Find the service
  select duration_min into v_duration
  from services
  where id = p_service_id and org_id = v_org_id and is_active = true;
  if v_duration is null then
    return;
  end if;

  v_weekday := extract(dow from p_date)::int;

  -- Iterate over each business_hours block for this weekday
  for v_bh in
    select * from business_hours
    where org_id = v_org_id and weekday = v_weekday
    order by start_time
  loop
    v_start_ts := (p_date || ' ' || v_bh.start_time::text)::timestamptz;
    v_end_ts   := (p_date || ' ' || v_bh.end_time::text)::timestamptz;

    -- Skip blocks entirely in the past
    if v_end_ts <= now() then
      continue;
    end if;

    -- Adjust start if it's in the past
    if v_start_ts < now() then
      v_start_ts := date_trunc('minute', now());
    end if;

    v_slot_start := v_start_ts;
    loop
      v_slot_end := v_slot_start + (v_duration || ' minutes')::interval;

      exit when v_slot_end > v_end_ts;

      -- Check overlap with breaks
      select exists(
        select 1 from breaks b
        where b.org_id = v_org_id
          and b.weekday = v_weekday
          and tstzrange(
            (p_date || ' ' || b.start_time::text)::timestamptz,
            (p_date || ' ' || b.end_time::text)::timestamptz
          ) && tstzrange(v_slot_start, v_slot_end)
      ) into v_overlap;

      if not v_overlap then
        -- Check overlap with existing booked appointments
        select exists(
          select 1 from appointments a
          where a.org_id = v_org_id
            and a.status = 'booked'
            and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_slot_start, v_slot_end)
        ) into v_overlap;

        if not v_overlap then
          starts_at := v_slot_start;
          ends_at := v_slot_end;
          return next;
        end if;
      end if;

      v_slot_start := v_slot_end;
    end loop;
  end loop;
end;
$$;

-- -------------------------------------------
-- 11. RPC: create_appointment(slug, service_id, starts_at, name, phone, email)
--     Validates availability, inserts appointment (anti-overlap constraint is final guard)
-- -------------------------------------------
create or replace function create_appointment(
  p_slug        text,
  p_service_id  uuid,
  p_starts_at   timestamptz,
  p_name        text,
  p_phone       text,
  p_email       text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id     uuid;
  v_duration   int;
  v_ends_at    timestamptz;
  v_found_slot boolean := false;
  v_slot       record;
  v_date       date;
  v_apt_id     uuid;
begin
  -- Validate inputs
  if p_name is null or trim(p_name) = '' then
    raise exception 'El nombre es obligatorio';
  end if;
  if p_phone is null or trim(p_phone) = '' then
    raise exception 'El teléfono es obligatorio';
  end if;
  if p_email is null or trim(p_email) = '' or p_email !~ '^.+@.+\..+$' then
    raise exception 'Email inválido';
  end if;

  -- Find org
  select id into v_org_id from organizations where slug = p_slug;
  if v_org_id is null then
    raise exception 'Negocio no encontrado';
  end if;

  -- Find service
  select duration_min into v_duration
  from services
  where id = p_service_id and org_id = v_org_id and is_active = true;
  if v_duration is null then
    raise exception 'Servicio no encontrado o inactivo';
  end if;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;

  -- Reject past slots
  if p_starts_at < now() then
    raise exception 'No se puede reservar en el pasado';
  end if;

  v_date := p_starts_at::date;

  -- Verify the requested slot is in the available slots
  for v_slot in
    select * from public_availability(p_slug, p_service_id, v_date)
  loop
    if v_slot.starts_at = p_starts_at then
      v_found_slot := true;
      exit;
    end if;
  end loop;

  if not v_found_slot then
    raise exception 'Slot no disponible';
  end if;

  -- Insert the appointment (EXCLUDE constraint catches race conditions)
  begin
    insert into appointments (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status)
    values (v_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked')
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;

-- -------------------------------------------
-- 12. Enable RLS on all tables + policies
-- -------------------------------------------

-- memberships: SELECT/ALL where user_id = auth.uid() (no recursion)
alter table memberships enable row level security;

create policy "memberships_select_own"
  on memberships for select
  using (user_id = auth.uid());

create policy "memberships_insert_own"
  on memberships for insert
  with check (user_id = auth.uid());

create policy "memberships_update_own"
  on memberships for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "memberships_delete_own"
  on memberships for delete
  using (user_id = auth.uid());

-- organizations: SELECT where is_member(id)
alter table organizations enable row level security;

create policy "orgs_select_member"
  on organizations for select
  using (is_member(id));

create policy "orgs_update_admin"
  on organizations for update
  using (is_admin(id))
  with check (is_admin(id));

create policy "orgs_delete_admin"
  on organizations for delete
  using (is_admin(id));

-- services: SELECT is_member; INSERT/UPDATE/DELETE is_admin
alter table services enable row level security;

create policy "services_select_member"
  on services for select
  using (is_member(org_id));

create policy "services_insert_admin"
  on services for insert
  with check (is_admin(org_id));

create policy "services_update_admin"
  on services for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "services_delete_admin"
  on services for delete
  using (is_admin(org_id));

-- business_hours: SELECT is_member; INSERT/UPDATE/DELETE is_admin
alter table business_hours enable row level security;

create policy "bh_select_member"
  on business_hours for select
  using (is_member(org_id));

create policy "bh_insert_admin"
  on business_hours for insert
  with check (is_admin(org_id));

create policy "bh_update_admin"
  on business_hours for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "bh_delete_admin"
  on business_hours for delete
  using (is_admin(org_id));

-- breaks: SELECT is_member; INSERT/UPDATE/DELETE is_admin
alter table breaks enable row level security;

create policy "breaks_select_member"
  on breaks for select
  using (is_member(org_id));

create policy "breaks_insert_admin"
  on breaks for insert
  with check (is_admin(org_id));

create policy "breaks_update_admin"
  on breaks for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "breaks_delete_admin"
  on breaks for delete
  using (is_admin(org_id));

-- appointments: SELECT/UPDATE/DELETE is_member; NO direct INSERT for anon
alter table appointments enable row level security;

create policy "apt_select_member"
  on appointments for select
  using (is_member(org_id));

create policy "apt_update_member"
  on appointments for update
  using (is_member(org_id))
  with check (is_member(org_id));

create policy "apt_delete_member"
  on appointments for delete
  using (is_member(org_id));
