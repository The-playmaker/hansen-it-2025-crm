-- Sporing av hvilke SQL-migrasjoner som er kjørt i denne databasen.
-- Kjør denne FØRST (SQL Editor eller npm run migrate:apply).

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  applied_by text default current_user
);

alter table public.schema_migrations enable row level security;
