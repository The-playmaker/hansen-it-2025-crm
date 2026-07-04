-- Align phoenix_ideas with Project Phoenix CRM v1 data flow.
-- Keeps existing rows and only adds safe columns/defaults.

alter table public.phoenix_ideas
  add column if not exists priority text not null default 'normal';

alter table public.phoenix_ideas
  alter column status set default 'parked';

update public.phoenix_ideas
set status = case status
  when 'parkert' then 'parked'
  when 'vurderes' then 'reviewing'
  when 'aktiv' then 'active'
  when 'droppet' then 'dropped'
  when 'ferdig' then 'done'
  else status
end
where status in ('parkert', 'vurderes', 'aktiv', 'droppet', 'ferdig');

create index if not exists idx_phoenix_ideas_priority on public.phoenix_ideas(priority);
