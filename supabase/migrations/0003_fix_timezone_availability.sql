-- =============================================
-- 0003_fix_timezone_availability.sql — incremental
-- Redefine public_availability to construct timestamps as
-- (p_date || ' ' || start_time)::timestamp AT TIME ZONE 'America/Santiago'
-- instead of ::timestamptz (which depends on session timezone).
-- Logic for slots, appointment overlap, and break overlap is unchanged.
-- =============================================

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
    v_start_ts := (p_date || ' ' || v_bh.start_time::text)::timestamp at time zone 'America/Santiago';
    v_end_ts   := (p_date || ' ' || v_bh.end_time::text)::timestamp at time zone 'America/Santiago';

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
            (p_date || ' ' || b.start_time::text)::timestamp at time zone 'America/Santiago',
            (p_date || ' ' || b.end_time::text)::timestamp at time zone 'America/Santiago'
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
