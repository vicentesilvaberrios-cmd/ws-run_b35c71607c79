-- =============================================
-- 0006_professionals.sql — Multiple professionals
-- (a) professionals table + RLS
-- (b) professional_id on business_hours, breaks, appointments
-- (c) Backfill: one default professional per org, assign existing rows
-- (d) professional_id NOT NULL on the three tables
-- (e) Replace no_overlap_booked to exclude by professional_id
-- (f) Redefine public_availability with p_professional_id
-- (g) Redefine create_appointment & owner_create_appointment with p_professional_id
-- (h) RPC public_professionals(slug)
-- (i) Redefine handle_new_user to also create a default professional
-- =============================================

-- -------------------------------------------
-- (a) professionals table
-- -------------------------------------------
create table if not exists professionals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table professionals enable row level security;

create policy "professionals_select_member"
  on professionals for select
  using (is_member(org_id));

create policy "professionals_insert_admin"
  on professionals for insert
  with check (is_admin(org_id));

create policy "professionals_update_admin"
  on professionals for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "professionals_delete_admin"
  on professionals for delete
  using (is_admin(org_id));

-- -------------------------------------------
-- (b) Add professional_id (nullable first) to business_hours, breaks, appointments
-- -------------------------------------------
alter table business_hours
  add column if not exists professional_id uuid references professionals(id) on delete cascade;

alter table breaks
  add column if not exists professional_id uuid references professionals(id) on delete cascade;

alter table appointments
  add column if not exists professional_id uuid references professionals(id) on delete restrict;

-- -------------------------------------------
-- (c) Backfill: create a default professional per org, assign existing rows
-- -------------------------------------------
do $$
declare
  v_org     record;
  v_prof_id uuid;
begin
  for v_org in select id from organizations loop
    insert into professionals (org_id, name, active)
    values (v_org.id, 'Profesional', true)
    returning id into v_prof_id;

    update business_hours set professional_id = v_prof_id
      where org_id = v_org.id and professional_id is null;

    update breaks set professional_id = v_prof_id
      where org_id = v_org.id and professional_id is null;

    update appointments set professional_id = v_prof_id
      where org_id = v_org.id and professional_id is null;
  end loop;
end $$;

-- -------------------------------------------
-- (d) Set professional_id NOT NULL
-- -------------------------------------------
alter table business_hours alter column professional_id set not null;
alter table breaks alter column professional_id set not null;
alter table appointments alter column professional_id set not null;

-- -------------------------------------------
-- (e) Replace no_overlap_booked: exclude by (professional_id, org_id)
--     Two appointments of the SAME professional cannot overlap;
--     different professionals can share the same time slot.
-- -------------------------------------------
alter table appointments drop constraint if exists no_overlap_booked;

alter table appointments
  add constraint no_overlap_booked
  exclude using gist (
    professional_id with =,
    org_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status = 'booked');

-- -------------------------------------------
-- (f) Redefine public_availability with p_professional_id
--     When p_professional_id is null, returns the union of available slots
--     across all active professionals (deduplicated by starts_at).
--     Maintains AT TIME ZONE 'America/Santiago' for timezone correctness.
-- -------------------------------------------
create or replace function public_availability(
  p_slug            text,
  p_service_id      uuid,
  p_date            date,
  p_professional_id uuid default null
)
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
  v_prof       record;
  v_bh         business_hours%rowtype;
  v_start_ts   timestamptz;
  v_end_ts     timestamptz;
  v_slot_start timestamptz;
  v_slot_end   timestamptz;
  v_overlap    boolean;
  v_done       text[] := '{}';
begin
  select id into v_org_id from organizations where slug = p_slug;
  if v_org_id is null then
    return;
  end if;

  select duration_min into v_duration
  from services
  where id = p_service_id and org_id = v_org_id and is_active = true;
  if v_duration is null then
    return;
  end if;

  v_weekday := extract(dow from p_date)::int;

  -- Iterate over active professionals (one or all)
  for v_prof in
    select id from professionals
    where org_id = v_org_id and active = true
      and (p_professional_id is null or id = p_professional_id)
    order by name
  loop
    for v_bh in
      select * from business_hours
      where org_id = v_org_id
        and professional_id = v_prof.id
        and weekday = v_weekday
      order by start_time
    loop
      v_start_ts := (p_date || ' ' || v_bh.start_time::text)::timestamp at time zone 'America/Santiago';
      v_end_ts   := (p_date || ' ' || v_bh.end_time::text)::timestamp at time zone 'America/Santiago';

      if v_end_ts <= now() then
        continue;
      end if;

      if v_start_ts < now() then
        v_start_ts := date_trunc('minute', now());
      end if;

      v_slot_start := v_start_ts;
      loop
        v_slot_end := v_slot_start + (v_duration || ' minutes')::interval;
        exit when v_slot_end > v_end_ts;

        -- Deduplicate: skip if this slot was already returned (for "any professional")
        if not (v_slot_start::text = any(v_done)) then
          -- Check overlap with breaks for this professional
          select exists(
            select 1 from breaks b
            where b.org_id = v_org_id
              and b.professional_id = v_prof.id
              and b.weekday = v_weekday
              and tstzrange(
                (p_date || ' ' || b.start_time::text)::timestamp at time zone 'America/Santiago',
                (p_date || ' ' || b.end_time::text)::timestamp at time zone 'America/Santiago'
              ) && tstzrange(v_slot_start, v_slot_end)
          ) into v_overlap;

          if not v_overlap then
            -- Check overlap with existing booked appointments for this professional
            select exists(
              select 1 from appointments a
              where a.org_id = v_org_id
                and a.professional_id = v_prof.id
                and a.status = 'booked'
                and tstzrange(a.starts_at, a.ends_at) && tstzrange(v_slot_start, v_slot_end)
            ) into v_overlap;

            if not v_overlap then
              starts_at := v_slot_start;
              ends_at := v_slot_end;
              return next;
              v_done := v_done || v_slot_start::text;
            end if;
          end if;
        end if;

        v_slot_start := v_slot_end;
      end loop;
    end loop;
  end loop;
end;
$$;

-- -------------------------------------------
-- (g) Redefine create_appointment with p_professional_id
--     If p_professional_id is null, auto-assigns the first available professional.
-- -------------------------------------------
create or replace function create_appointment(
  p_slug            text,
  p_service_id      uuid,
  p_starts_at       timestamptz,
  p_name            text,
  p_phone           text,
  p_email           text,
  p_professional_id uuid default null
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
  v_weekday    int;
  v_apt_id     uuid;
  v_client_id  uuid;
  v_prof_id    uuid := p_professional_id;
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

  if p_starts_at < now() then
    raise exception 'No se puede reservar en el pasado';
  end if;

  v_date := p_starts_at::date;
  v_weekday := extract(dow from v_date)::int;

  -- Verify the requested slot is in the available slots
  for v_slot in
    select * from public_availability(p_slug, p_service_id, v_date, v_prof_id)
  loop
    if v_slot.starts_at = p_starts_at then
      v_found_slot := true;
      exit;
    end if;
  end loop;

  if not v_found_slot then
    raise exception 'Slot no disponible';
  end if;

  -- If no professional specified, find one who is available for this slot
  if v_prof_id is null then
    select p.id into v_prof_id
    from professionals p
    where p.org_id = v_org_id and p.active = true
      and exists (
        select 1 from business_hours bh
        where bh.professional_id = p.id
          and bh.org_id = v_org_id
          and bh.weekday = v_weekday
          and (v_date || ' ' || bh.start_time::text)::timestamp at time zone 'America/Santiago' <= p_starts_at
          and (v_date || ' ' || bh.end_time::text)::timestamp at time zone 'America/Santiago' >= v_ends_at
      )
      and not exists (
        select 1 from breaks b
        where b.professional_id = p.id
          and b.org_id = v_org_id
          and b.weekday = v_weekday
          and tstzrange(
            (v_date || ' ' || b.start_time::text)::timestamp at time zone 'America/Santiago',
            (v_date || ' ' || b.end_time::text)::timestamp at time zone 'America/Santiago'
          ) && tstzrange(p_starts_at, v_ends_at)
      )
      and not exists (
        select 1 from appointments a
        where a.professional_id = p.id
          and a.org_id = v_org_id
          and a.status = 'booked'
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_starts_at, v_ends_at)
      )
    limit 1;

    if v_prof_id is null then
      raise exception 'Slot no disponible';
    end if;
  end if;

  -- Find or create the client for this org
  v_client_id := find_or_create_client(v_org_id, p_name, p_phone, p_email);

  -- Insert the appointment (EXCLUDE constraint catches race conditions)
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status, client_id, professional_id)
    values
      (v_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked', v_client_id, v_prof_id)
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;

-- -------------------------------------------
-- (h) Redefine owner_create_appointment with p_professional_id
-- -------------------------------------------
create or replace function owner_create_appointment(
  p_org_id         uuid,
  p_service_id     uuid,
  p_starts_at      timestamptz,
  p_name           text,
  p_phone          text,
  p_email          text,
  p_professional_id uuid default null
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
  v_prof_id   uuid := p_professional_id;
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

  if p_starts_at < now() then
    raise exception 'No se puede reservar en el pasado';
  end if;

  -- If no professional specified, find one who is available for this slot
  if v_prof_id is null then
    select p.id into v_prof_id
    from professionals p
    where p.org_id = p_org_id and p.active = true
      and exists (
        select 1 from business_hours bh
        where bh.professional_id = p.id
          and bh.org_id = p_org_id
          and bh.weekday = extract(dow from p_starts_at::date)::int
          and (p_starts_at::date || ' ' || bh.start_time::text)::timestamp at time zone 'America/Santiago' <= p_starts_at
          and (p_starts_at::date || ' ' || bh.end_time::text)::timestamp at time zone 'America/Santiago' >= v_ends_at
      )
      and not exists (
        select 1 from breaks b
        where b.professional_id = p.id
          and b.org_id = p_org_id
          and b.weekday = extract(dow from p_starts_at::date)::int
          and tstzrange(
            (p_starts_at::date || ' ' || b.start_time::text)::timestamp at time zone 'America/Santiago',
            (p_starts_at::date || ' ' || b.end_time::text)::timestamp at time zone 'America/Santiago'
          ) && tstzrange(p_starts_at, v_ends_at)
      )
      and not exists (
        select 1 from appointments a
        where a.professional_id = p.id
          and a.org_id = p_org_id
          and a.status = 'booked'
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_starts_at, v_ends_at)
      )
    limit 1;

    if v_prof_id is null then
      raise exception 'No hay profesional disponible para este horario';
    end if;
  else
    -- Validate the specified professional belongs to this org and is active
    if not exists (
      select 1 from professionals
      where id = v_prof_id and org_id = p_org_id and active = true
    ) then
      raise exception 'Profesional no válido';
    end if;
  end if;

  -- Find or create the client for this org
  v_client_id := find_or_create_client(p_org_id, p_name, p_phone, p_email);

  -- Insert with status='booked'; EXCLUDE constraint is the final guard
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status, client_id, professional_id)
    values
      (p_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked', v_client_id, v_prof_id)
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;

-- -------------------------------------------
-- (i) RPC: public_professionals(slug)
--     Returns active professionals for a business (public, no auth)
-- -------------------------------------------
create or replace function public_professionals(p_slug text)
returns table (
  id   uuid,
  name text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name
  from professionals p
  join organizations o on o.id = p.org_id
  where o.slug = p_slug and p.active = true
  order by p.name;
$$;

-- -------------------------------------------
-- (j) Redefine handle_new_user to also create a default professional
--     for the new organization.
-- -------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id   uuid;
  v_slug     text;
  v_name     text;
  v_prof_id  uuid;
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

  -- Create a default professional for the new org
  insert into professionals (org_id, name, active)
  values (v_org_id, coalesce(v_name, 'Profesional'), true);

  return new;
end;
$$;
