-- =============================================
-- 0002_appointment_management.sql — incremental
-- (a) Replace status CHECK to admit 'attended' and 'no_show'
-- (b) RPC owner_create_appointment (SECURITY DEFINER)
-- NB: no_overlap_booked (from 0001) stays unchanged; it only
--     filters status='booked' so cancelled/attended/no_show never block.
-- =============================================

-- -------------------------------------------
-- (a) Expand appointments.status domain
-- -------------------------------------------
alter table appointments
  drop constraint if exists appointments_status_check;

alter table appointments
  add constraint appointments_status_check
  check (status in ('booked','cancelled','attended','no_show'));

-- -------------------------------------------
-- (b) RPC: owner_create_appointment
--     Member-only manual booking that respects no_overlap_booked.
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
  v_duration int;
  v_ends_at  timestamptz;
  v_apt_id   uuid;
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

  -- Insert with status='booked'; EXCLUDE constraint is the final guard
  begin
    insert into appointments
      (org_id, service_id, starts_at, ends_at, customer_name, customer_phone, customer_email, status)
    values
      (p_org_id, p_service_id, p_starts_at, v_ends_at, trim(p_name), trim(p_phone), trim(p_email), 'booked')
    returning id into v_apt_id;
  exception
    when exclusion_violation then
      raise exception 'Slot ya reservado';
  end;

  return v_apt_id;
end;
$$;
