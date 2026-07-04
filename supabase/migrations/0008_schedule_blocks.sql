-- =============================================
-- 0008_schedule_blocks.sql — Bloqueos de agenda
-- (a) schedule_blocks table + RLS
-- (b) Redefine public_availability to EXCLUDE schedule_blocks
--     (professional_id null = whole business; start/end null = full day)
--     Uses same AT TIME ZONE 'America/Santiago' pattern.
-- =============================================

-- -------------------------------------------
-- (a) schedule_blocks table
-- -------------------------------------------
create table if not exists schedule_blocks (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  block_date      date not null,
  start_time      time,
  end_time        time,
  reason          text,
  created_at      timestamptz not null default now(),
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

alter table schedule_blocks enable row level security;

create policy "sb_select_member"
  on schedule_blocks for select
  using (is_member(org_id));

create policy "sb_insert_admin"
  on schedule_blocks for insert
  with check (is_admin(org_id));

create policy "sb_update_admin"
  on schedule_blocks for update
  using (is_admin(org_id))
  with check (is_admin(org_id));

create policy "sb_delete_admin"
  on schedule_blocks for delete
  using (is_admin(org_id));

-- -------------------------------------------
-- (b) Redefine public_availability to exclude schedule_blocks
--     A schedule_block applies to a professional when:
--       professional_id = p_professional_id  OR  professional_id IS NULL (whole business)
--     When start_time/end_time are NULL → blocks the entire day.
--     Otherwise blocks the time range on that date.
--     All comparisons use the AT TIME ZONE 'America/Santiago' pattern.
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
              -- Check overlap with schedule_blocks (full-day or time-range)
              -- A block applies to this professional when professional_id matches
              -- OR professional_id IS NULL (whole business).
              -- When start_time/end_time are NULL → entire day is blocked.
              select exists(
                select 1 from schedule_blocks sb
                where sb.org_id = v_org_id
                  and sb.block_date = p_date
                  and (sb.professional_id is null or sb.professional_id = v_prof.id)
                  and (
                    (sb.start_time is null and sb.end_time is null)
                    or tstzrange(
                      (p_date || ' ' || sb.start_time::text)::timestamp at time zone 'America/Santiago',
                      (p_date || ' ' || sb.end_time::text)::timestamp at time zone 'America/Santiago'
                    ) && tstzrange(v_slot_start, v_slot_end)
                  )
              ) into v_overlap;

              if not v_overlap then
                starts_at := v_slot_start;
                ends_at := v_slot_end;
                return next;
                v_done := v_done || v_slot_start::text;
              end if;
            end if;
          end if;
        end if;

        v_slot_start := v_slot_end;
      end loop;
    end loop;
  end loop;
end;
$$;
