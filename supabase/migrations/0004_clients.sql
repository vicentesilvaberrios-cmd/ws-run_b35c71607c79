-- =============================================
-- 0004_clients.sql — Client fichas + appointment linking
-- (a) clients table with RLS by org_id
-- (b) client_id FK on appointments (nullable, on delete set null)
-- (c) find_or_create_client SECURITY DEFINER RPC
-- (d) Redefine create_appointment & owner_create_appointment to link client_id
-- =============================================

-- -------------------------------------------
-- (a) clients table
-- -------------------------------------------
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Helpful: one client per org per email (when email is present)
create unique index if not exists clients_org_email_uniq
  on clients (org_id, email)
  where email is not null and email <> '';

create unique index if not exists clients_org_phone_uniq
  on clients (org_id, phone)
  where phone is not null and phone <> '';

-- RLS: SELECT/INSERT/UPDATE/DELETE by is_member/is_admin
alter table clients enable row level security;

create policy "clients_select_member"
  on clients for select
  using (is_member(org_id));

create policy "clients_insert_admin"
  on clients for insert
  with check (is_admin(org_id));

create policy "clients_update_admin"
  on clients for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "clients_delete_admin"
  on clients for delete
  using (is_admin(org_id));

-- -------------------------------------------
-- (b) client_id on appointments
-- -------------------------------------------
alter table appointments
  add column if not exists client_id uuid references clients(id) on delete set null;

-- -------------------------------------------
-- (c) find_or_create_client
--     SECURITY DEFINER: searches by email then phone within org, creates if not found
-- -------------------------------------------
create or replace function find_or_create_client(
  p_org_id uuid,
  p_name   text,
  p_phone  text,
  p_email  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_name  text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  -- Try by email first (if provided)
  if v_email <> '' then
    select id into v_client_id
    from clients
    where org_id = p_org_id and lower(email) = v_email
    limit 1;
  end if;

  -- Try by phone if not found and phone is provided
  if v_client_id is null and v_phone <> '' then
    select id into v_client_id
    from clients
    where org_id = p_org_id and phone = v_phone
    limit 1;
  end if;

  -- Create if not found
  if v_client_id is null then
    insert into clients (org_id, name, phone, email)
    values (p_org_id, v_name, nullif(v_phone, ''), nullif(v_email, ''))
    returning id into v_client_id;
  else
    -- Optionally update missing fields on the existing client
    update clients
      set name  = case when v_name <> '' then v_name else name end,
          phone = case when (phone is null or phone = '') and v_phone <> '' then v_phone else phone end,
          email = case when (email is null or email = '') and v_email <> '' then v_email else email end
    where id = v_client_id;
  end if;

  return v_client_id;
end;
$$;

-- -------------------------------------------
-- (d) Redefine create_appointment to link client_id
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
  v_client_id  uuid;
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

  -- Find or create the client for this org
  v_client_id := find_or_create_client(v_org_id, p_name, p_phone, p_email);

  -- Insert the appointment (EXCLUDE constraint catches race conditions)
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status, client_id)
    values
      (v_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked', v_client_id)
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;

-- -------------------------------------------
-- (e) Redefine owner_create_appointment to link client_id
-- -------------------------------------------
create or replace function owner_create_appointment(
  p_org_id     uuid,
  p_service_id uuid,
  p_starts_at  timestamptz,
  p_name       text,
  p_phone      text,
  p_email      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duration  int;
  v_ends_at   timestamptz;
  v_apt_id    uuid;
  v_client_id uuid;
begin
  -- Authorization: must be a member of the org (deny-by-default)
  if not is_member(p_org_id) then
    raise exception 'No autorizado';
  end if;

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
  if p_starts_at is null then
    raise exception 'La fecha de inicio es obligatoria';
  end if;

  -- Get duration from the service (must belong to this org and be active)
  select duration_min into v_duration
  from services
  where id = p_service_id and org_id = p_org_id and is_active = true;
  if v_duration is null then
    raise exception 'Servicio no encontrado o inactivo';
  end if;

  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;

  -- Reject past slots
  if p_starts_at < now() then
    raise exception 'No se puede reservar en el pasado';
  end if;

  -- Find or create the client for this org
  v_client_id := find_or_create_client(p_org_id, p_name, p_phone, p_email);

  -- Insert with status='booked'; EXCLUDE constraint is the final guard
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status, client_id)
    values
      (p_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked', v_client_id)
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;
