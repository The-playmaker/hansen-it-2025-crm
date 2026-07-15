-- =============================================================================
-- backfill_schema_migrations.sql (ENGANGS)
--
-- 1. Kjør supabase/migrations/00000000000000_migration_tracking.sql
-- 2. Kjør supabase/DIAGNOSE-skjema.sql
-- 3. Fjern/kommenter ut versjoner som viste ❌ i diagnosen
-- 4. Kjør denne filen
-- 5. Kjør npm run migrate:apply for de som mangler (typisk invoices + archived_at)
--
-- VIKTIG: Ikke registrer en versjon som «kjørt» hvis diagnosen viste ❌.
-- De to kjente hullene i produksjon (historisk):
--   20260705113000  (invoices)     → ofte ❌
--   20260708100000  (archived_at)  → ofte ❌
-- =============================================================================

insert into public.schema_migrations (version) values
  ('00000000000000'),
  ('20260701130000'),
  ('20260704193000'),
  ('20260704210000'),
  ('20260704223000'),
  ('20260704224500'),
  ('20260704225000'),
  ('20260704230000'),
  ('20260704231500'),
  ('20260705090000'),
  ('20260705091000'),
  ('20260705093000'),
  ('20260705110000'),
  -- ('20260705113000'), -- invoices: bare hvis DIAGNOSE viser ✅
  ('20260706120000'),
  ('20260706123000'),
  ('20260706124500'),
  ('20260706125000'),
  ('20260706130000'),
  ('20260706130500'),
  ('20260706131500'),
  ('20260706132000'),
  ('20260706133000'),
  ('20260707100000'),
  ('20260707123000'),
  ('20260707133000'),
  -- ('20260708100000'), -- archived_at: bare hvis DIAGNOSE viser ✅
  ('20260716010000')
on conflict (version) do nothing;
