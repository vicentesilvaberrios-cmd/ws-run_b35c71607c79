-- =============================================
-- 0005_appointment_reminders.sql — incremental
-- Agrega columna reminder_sent_at a appointments para
-- soporte de recordatorios automáticos (idempotencia).
-- No modifica 0001-0004; respeta org_id, RLS y no_overlap_booked.
-- =============================================

alter table appointments
  add column if not exists reminder_sent_at timestamptz null;
