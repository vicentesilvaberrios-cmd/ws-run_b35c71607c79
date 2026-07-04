-- =============================================
-- 0009_email_optional.sql — Allow null/empty email in owner_create_appointment
-- Walk-in or phone bookings don't always require an email.
-- Copies the function from 0006 and relaxes only the email validation.
-- =============================================

create or replace function owner_create_appointment(
  p_org_id          uuid,
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
  v_duration  int;
  v_ends_at   timestamptz;
  v_apt_id    uuid;
  v_client_id uuid;
  v_prof_id   uuid := p_professional_id;
  v_email     text := nullif(trim(coalesce(p_email, '')), '');
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
  -- Email is now OPTIONAL: only validate format if a non-empty value is provided
  if v_email is not null and v_email !~ '^.+@.+\..+$' then
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

  -- Find or create the client for this org (find_or_create_client handles null email)
  v_client_id := find_or_create_client(p_org_id, p_name, p_phone, v_email);

  -- Insert with status='booked'; EXCLUDE constraint is the final guard
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status, client_id, professional_id)
    values
      (p_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), v_email, 'booked', v_client_id, v_prof_id)
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;
