-- Migration 004: CRM Comercial Completo
-- Fase 2 do Plano de Expansão OLS
-- Tabelas: leads, lead_activities, proposals, guest_nps, loyalty_records

-- ─── Lead stage enum ──────────────────────────────────────────────────────────
create type lead_stage as enum (
  'new',          -- Novo Lead
  'qualified',    -- Qualificado
  'proposal',     -- Proposta
  'negotiation',  -- Negociação
  'closed_won',   -- Fechado (ganho)
  'closed_lost'   -- Perdido
);

create type lead_origin as enum (
  'whatsapp', 'email', 'referral', 'instagram',
  'facebook', 'google', 'portal', 'direct', 'other'
);

create type proposal_status as enum (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
);

-- ─── leads ────────────────────────────────────────────────────────────────────
create table leads (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid references contacts(id) on delete set null,
  property_id         uuid references properties(id) on delete set null,
  title               text not null,
  stage               lead_stage not null default 'new',
  origin              lead_origin not null default 'other',
  estimated_value     numeric(12,2),
  probability         int check (probability between 0 and 100),
  check_in_date       date,
  check_out_date      date,
  guests_count        int,
  notes               text,
  lost_reason         text,
  stage_updated_at    timestamptz not null default now(),
  last_activity_at    timestamptz,
  assigned_to         uuid references profiles(id) on delete set null,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── lead_activities ──────────────────────────────────────────────────────────
create type lead_activity_type as enum (
  'note', 'call', 'email', 'whatsapp', 'visit',
  'proposal_sent', 'stage_change', 'other'
);

create table lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  type        lead_activity_type not null default 'note',
  title       text,
  description text not null,
  occurred_at timestamptz not null default now(),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── proposals ────────────────────────────────────────────────────────────────
create table proposals (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references leads(id) on delete set null,
  contact_id      uuid references contacts(id) on delete set null,
  property_id     uuid references properties(id) on delete set null,
  number          serial,
  title           text not null,
  check_in_date   date,
  check_out_date  date,
  guests_count    int,
  nightly_rate    numeric(12,2),
  total_nights    int,
  subtotal        numeric(12,2),
  discount        numeric(12,2) default 0,
  total_value     numeric(12,2),
  includes        text[],       -- itens incluídos (café, limpeza, etc.)
  observations    text,
  status          proposal_status not null default 'draft',
  pdf_url         text,
  sent_at         timestamptz,
  viewed_at       timestamptz,
  responded_at    timestamptz,
  valid_until     date,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── guest_nps ────────────────────────────────────────────────────────────────
create table guest_nps (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid references reservations(id) on delete set null,
  contact_id      uuid not null references contacts(id) on delete cascade,
  property_id     uuid references properties(id) on delete set null,
  score           int not null check (score between 0 and 10),
  comment         text,
  sent_at         timestamptz not null default now(),
  responded_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── loyalty_records ──────────────────────────────────────────────────────────
create table loyalty_records (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null unique references contacts(id) on delete cascade,
  total_stays         int not null default 0,
  total_nights        int not null default 0,
  total_spent         numeric(12,2) not null default 0,
  discount_percent    numeric(5,2) not null default 0,
  tier                text not null default 'standard', -- standard / silver / gold / vip
  last_stay_at        date,
  next_visit_expected date,
  notes               text,
  updated_at          timestamptz not null default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────
create index leads_stage_idx              on leads(stage);
create index leads_contact_id_idx         on leads(contact_id);
create index leads_property_id_idx        on leads(property_id);
create index leads_stage_updated_at_idx   on leads(stage_updated_at);
create index leads_last_activity_at_idx   on leads(last_activity_at);
create index lead_activities_lead_id_idx  on lead_activities(lead_id);
create index proposals_lead_id_idx        on proposals(lead_id);
create index proposals_contact_id_idx     on proposals(contact_id);
create index proposals_status_idx         on proposals(status);
create index guest_nps_contact_id_idx     on guest_nps(contact_id);
create index guest_nps_reservation_id_idx on guest_nps(reservation_id);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger leads_updated_at
  before update on leads for each row execute function update_updated_at();

create trigger proposals_updated_at
  before update on proposals for each row execute function update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table leads            enable row level security;
alter table lead_activities  enable row level security;
alter table proposals        enable row level security;
alter table guest_nps        enable row level security;
alter table loyalty_records  enable row level security;

-- Authenticated users can do everything (team-based access)
create policy "leads_all"           on leads            for all to authenticated using (true) with check (true);
create policy "lead_activities_all" on lead_activities  for all to authenticated using (true) with check (true);
create policy "proposals_all"       on proposals        for all to authenticated using (true) with check (true);
create policy "guest_nps_all"       on guest_nps        for all to authenticated using (true) with check (true);
create policy "loyalty_records_all" on loyalty_records  for all to authenticated using (true) with check (true);

-- ─── Comments ─────────────────────────────────────────────────────────────────
comment on table leads           is 'Pipeline de oportunidades comerciais (CRM)';
comment on table lead_activities is 'Timeline de atividades por lead';
comment on table proposals       is 'Propostas comerciais geradas para leads';
comment on table guest_nps       is 'Avaliações NPS automáticas pós check-out';
comment on table loyalty_records is 'Programa de fidelidade de hóspedes';
