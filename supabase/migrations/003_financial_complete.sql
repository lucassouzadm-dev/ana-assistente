-- ══════════════════════════════════════════════════════════════
-- OLS Gestão — Migração 003: Financeiro Completo
-- ══════════════════════════════════════════════════════════════

-- ── 1. CONTAS A PAGAR ─────────────────────────────────────────
create table accounts_payable (
  id                  uuid primary key default gen_random_uuid(),
  description         text not null,
  amount              numeric(12,2) not null check (amount > 0),
  due_date            date not null,
  paid_date           date,
  status              text not null default 'open'
                      check (status in ('open','paid','cancelled')),
  category_id         uuid references financial_categories(id),
  property_id         uuid references properties(id),
  contact_id          uuid references contacts(id),
  notes               text,
  installment_number  int,
  installments_total  int,
  payment_method      text check (payment_method in ('pix','cash','transfer','card','boleto','other')),
  receipt_url         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  created_by          uuid references profiles(id)
);

create index idx_ap_status     on accounts_payable(status);
create index idx_ap_due_date   on accounts_payable(due_date);
create index idx_ap_property   on accounts_payable(property_id);
create index idx_ap_contact    on accounts_payable(contact_id);

-- ── 2. CONTAS A RECEBER ───────────────────────────────────────
create table accounts_receivable (
  id                  uuid primary key default gen_random_uuid(),
  description         text not null,
  amount              numeric(12,2) not null check (amount > 0),
  due_date            date not null,
  received_date       date,
  status              text not null default 'open'
                      check (status in ('open','received','cancelled')),
  category_id         uuid references financial_categories(id),
  property_id         uuid references properties(id),
  reservation_id      uuid references reservations(id),
  contact_id          uuid references contacts(id),
  notes               text,
  installment_number  int,
  installments_total  int,
  payment_method      text check (payment_method in ('pix','cash','transfer','card','boleto','other')),
  receipt_url         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  created_by          uuid references profiles(id)
);

create index idx_ar_status     on accounts_receivable(status);
create index idx_ar_due_date   on accounts_receivable(due_date);
create index idx_ar_property   on accounts_receivable(property_id);
create index idx_ar_contact    on accounts_receivable(contact_id);
create index idx_ar_reservation on accounts_receivable(reservation_id);

-- ── 3. COMISSÕES ──────────────────────────────────────────────
create table commissions (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null references contacts(id),
  reservation_id      uuid references reservations(id),
  rate_percent        numeric(5,2),
  calculated_amount   numeric(12,2) not null,
  status              text not null default 'pending'
                      check (status in ('pending','paid','cancelled')),
  paid_date           date,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index idx_comm_contact    on commissions(contact_id);
create index idx_comm_status     on commissions(status);
create index idx_comm_reservation on commissions(reservation_id);

-- ── 4. TRIGGERS DE UPDATED_AT ────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- (Só cria se ainda não existir de uma migração anterior)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_contacts_updated_at') then
    -- trigger já pode ter sido criado na migração 001
    null;
  end if;
end $$;

create trigger trg_ap_updated_at
  before update on accounts_payable
  for each row execute function update_updated_at_column();

create trigger trg_ar_updated_at
  before update on accounts_receivable
  for each row execute function update_updated_at_column();

create trigger trg_comm_updated_at
  before update on commissions
  for each row execute function update_updated_at_column();

-- ── 5. ROW LEVEL SECURITY ────────────────────────────────────
alter table accounts_payable enable row level security;
alter table accounts_receivable enable row level security;
alter table commissions enable row level security;

-- Política: usuários autenticados têm acesso total (gestão interna)
create policy "authenticated_full_access_ap"
  on accounts_payable for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access_ar"
  on accounts_receivable for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated_full_access_comm"
  on commissions for all
  to authenticated
  using (true)
  with check (true);

-- Service role (usado pelo admin client) tem acesso irrestrito por padrão.

-- ── 6. COMENTÁRIOS ───────────────────────────────────────────
comment on table accounts_payable    is 'Contas a pagar com controle de vencimento e baixa';
comment on table accounts_receivable is 'Contas a receber com controle de vencimento e baixa';
comment on table commissions         is 'Comissões calculadas por reserva para parceiros e colaboradores';
