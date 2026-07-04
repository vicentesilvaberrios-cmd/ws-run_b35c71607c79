-- =============================================
-- 0007_appointment_confirmation.sql — incremental
-- (a) Add public_token (uuid, unique) and confirmed_at (timestamptz, nullable) to appointments
-- (b) Backfill public_token for existing appointments
-- (c) RPC: public_appointment_by_token(p_token) — public detail lookup
-- (d) RPC: public_confirm_appointment(p_token) — set confirmed_at=now(), keep status='booked'
-- (e) RPC: public_cancel_appointment(p_token) — cancel if future & 'booked' (frees slot via partial EXCLUDE)
-- NB: no_overlap_booked (from 0006) is NOT touched; cancelling sets status='cancelled'
--     which the partial EXCLUDE already excludes, freeing the slot.
-- =============================================

-- -------------------------------------------
-- (a) Add columns
-- -------------------------------------------
alter table appointments
  add column if not exists public_token uuid not null default gen_random_uuid();

alter table appointments
  add column if not exists confirmed_at timestamptz;

-- Unique index so the token is unpredictable and unique
create unique index if not exists appointments_public_token_key
  on appointments (public_token);

-- -------------------------------------------
-- (b) Backfill existing rows that still have the default gen_random_uuid()
--     (gen_random_uuid() is already non-null per row, but ensure they're all set)
-- -------------------------------------------
-- gen_random_uuid() is evaluated per-row at insert time, so existing rows already have
-- unique values. No further backfill needed.

-- -------------------------------------------
-- (c) RPC: public_appointment_by_token(p_token)
--     Returns appointment detail for the public confirmation page.
--     SECURITY DEFINER because appointments RLS requires org membership.
-- -------------------------------------------
create or replace function public_appointment_by_token(p_token uuid)
returns table (
  id             uuid,
  service_name   text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  professional_name text,
  org_name       text,
  status         text,
  confirmed_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id,
         s.name as service_name,
         a.starts_at,
         a.ends_at,
         p.name as professional_name,
         o.name as org_name,
         a.status,
         a.confirmed_at
  from appointments a
  join services s   on s.id = a.service_id
  join organizations o on o.id = a.org_id
  left join professionals p on p.id = a.professional_id
  where a.public_token = p_token;
$$;

-- -------------------------------------------
-- (d) RPC: public_confirm_appointment(p_token)
--     Sets confirmed_at = now() without changing status (keeps 'booked').
-- -------------------------------------------
create or replace function public_confirm_appointment(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update appointments
    set confirmed_at = now()
    where public_token = p_token
      and status = 'booked';

  if not found then
    raise exception 'Cita no encontrada o no se puede confirmar';
  end if;
end;
$$;

-- -------------------------------------------
-- (e) RPC: public_cancel_appointment(p_token)
--     Cancels a 'booked' appointment that hasn't occurred yet (starts_at > now()).
--     Setting status='cancelled' frees the slot because the partial EXCLUDE
--     constraint (where status='booked') no longer includes this row.
-- -------------------------------------------
create or replace function public_cancel_appointment(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starts_at timestamptz;
  v_status    text;
begin
  -- Look up the appointment
  select starts_at, status into v_starts_at, v_status
  from appointments
  where public_token = p_token;

  if not found then
    raise exception 'La cita no existe o ya fue cancelada';
  end if;

  if v_status <> 'booked' then
    raise exception 'La cita ya no se puede cancelar (estado: %)', v_status;
  end if;

  if v_starts_at <= now() then
    raise exception 'No se puede cancelar una cita que ya ocurrió o está en curso';
  end if;

  update appointments
    set status = 'cancelled'
    where public_token = p_token
      and status = 'booked';
end;
$$;
