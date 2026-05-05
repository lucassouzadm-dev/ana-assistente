-- ══════════════════════════════════════════════════════════════
-- Ana Assistente — Schema Inicial
-- ══════════════════════════════════════════════════════════════

-- 1. PROFILES (extensão do Supabase Auth)
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  phone         text,
  role          text not null default 'owner' check (role in ('owner','manager','viewer')),
  avatar_url    text,
  notification_whatsapp boolean default true,
  notification_email    boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. CONTACTS
create table contacts (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text,
  email               text,
  category            text not null default 'unknown'
                      check (category in (
                        'collaborator','partner','maintenance','accounting',
                        'tenant','guest','rental_company','supplier','unknown'
                      )),
  relationship_description text,
  qualification_status text not null default 'pending'
                      check (qualification_status in ('pending','qualified','manual')),
  is_active           boolean default true,
  metadata            jsonb default '{}',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  created_by          uuid references profiles(id)
);
create unique index idx_contacts_phone on contacts(phone) where phone is not null;
create index idx_contacts_category on contacts(category);

-- 3. PROPERTIES
create table properties (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  address       text,
  city          text,
  state         text default 'BA',
  description   text,
  amenities     jsonb default '[]',
  max_guests    int,
  bedrooms      int,
  bathrooms     int,
  status        text default 'active' check (status in ('active','inactive','maintenance')),
  photos        jsonb default '[]',
  rules         text,
  check_in_time time default '15:00',
  check_out_time time default '11:00',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 4. RESERVATIONS
create table reservations (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id),
  guest_contact_id uuid references contacts(id),
  guest_name      text not null,
  guest_phone     text,
  guest_email     text,
  check_in        date not null,
  check_out       date not null,
  num_guests      int default 1,
  status          text default 'confirmed'
                  check (status in ('pending','confirmed','checked_in','checked_out','cancelled')),
  total_price     numeric(12,2),
  daily_rate      numeric(10,2),
  cleaning_fee    numeric(10,2) default 0,
  notes           text,
  source          text default 'direct'
                  check (source in ('direct','partner','referral','returning')),
  partner_contact_id uuid references contacts(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint valid_dates check (check_out > check_in)
);
create index idx_reservations_property_dates on reservations(property_id, check_in, check_out);
create index idx_reservations_status on reservations(status);

-- 5. CONVERSATIONS
create table conversations (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references contacts(id),
  channel       text not null check (channel in ('whatsapp','email','internal')),
  status        text default 'active' check (status in ('active','escalated','closed')),
  subject       text,
  summary       text,
  last_message_at timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index idx_conversations_contact on conversations(contact_id);

-- 6. MESSAGES
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction       text not null check (direction in ('inbound','outbound')),
  sender          text not null check (sender in ('contact','ai','user')),
  content         text not null,
  content_type    text default 'text' check (content_type in ('text','image','document','audio','location')),
  media_url       text,
  channel_message_id text,
  ai_model        text,
  ai_tokens_in    int,
  ai_tokens_out   int,
  status          text default 'sent' check (status in ('pending','sent','delivered','read','failed')),
  created_at      timestamptz default now()
);
create index idx_messages_conversation on messages(conversation_id, created_at);
create unique index idx_messages_channel_id on messages(channel_message_id) where channel_message_id is not null;

-- 7. KNOWLEDGE BASE
create table knowledge_base (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null check (category in (
    'property','procedure','pricing','faq','policy','company','other'
  )),
  content       text not null,
  property_id   uuid references properties(id),
  tags          text[] default '{}',
  is_active     boolean default true,
  priority      int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);
create index idx_kb_category on knowledge_base(category);
create index idx_kb_property on knowledge_base(property_id);

create table knowledge_base_documents (
  id            uuid primary key default gen_random_uuid(),
  kb_entry_id   uuid not null references knowledge_base(id) on delete cascade,
  file_name     text not null,
  file_type     text not null,
  storage_path  text not null,
  extracted_text text,
  created_at    timestamptz default now()
);

-- 8. ESCALATION RULES
create table escalation_rules (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  condition_type text not null check (condition_type in (
    'financial_above','complaint','legal','unknown','keyword','category','custom'
  )),
  condition_value jsonb not null default '{}',
  action        text default 'escalate' check (action in ('escalate','notify','block')),
  notify_via    text[] default '{whatsapp,email}',
  response_template text,
  is_active     boolean default true,
  priority      int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 9. FINANCIAL CATEGORIES
create table financial_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null check (type in ('revenue','expense')),
  parent_id     uuid references financial_categories(id),
  is_active     boolean default true
);

-- 10. FINANCIAL TRANSACTIONS
create table financial_transactions (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('revenue','expense')),
  amount        numeric(12,2) not null,
  category_id   uuid references financial_categories(id),
  property_id   uuid references properties(id),
  reservation_id uuid references reservations(id),
  contact_id    uuid references contacts(id),
  description   text,
  transaction_date date not null,
  payment_method text check (payment_method in ('pix','cash','transfer','card','boleto','other')),
  receipt_url   text,
  status        text default 'completed' check (status in ('pending','completed','cancelled')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);
create index idx_transactions_property on financial_transactions(property_id);
create index idx_transactions_date on financial_transactions(transaction_date);
create index idx_transactions_type on financial_transactions(type);

-- 11. TASKS
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text default 'pending'
                check (status in ('pending','in_progress','waiting','completed','cancelled')),
  priority      text default 'medium'
                check (priority in ('low','medium','high','urgent')),
  property_id   uuid references properties(id),
  assigned_contact_id uuid references contacts(id),
  reservation_id uuid references reservations(id),
  due_date      date,
  completed_at  timestamptz,
  category      text check (category in ('maintenance','cleaning','inspection','supply','other')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  created_by    uuid references profiles(id)
);
create index idx_tasks_status on tasks(status);
create index idx_tasks_property on tasks(property_id);

-- 12. MESSAGE TEMPLATES
create table message_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null check (category in (
    'check_in','check_out','welcome','maintenance','payment',
    'confirmation','reminder','general'
  )),
  content       text not null,
  variables     text[] default '{}',
  channel       text check (channel in ('whatsapp','email','both')),
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 13. AUDIT LOG
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  action        text not null,
  actor         text not null,
  entity_type   text,
  entity_id     uuid,
  details       jsonb default '{}',
  ip_address    text,
  created_at    timestamptz default now()
);
create index idx_audit_action on audit_log(action, created_at);
create index idx_audit_entity on audit_log(entity_type, entity_id);

-- 14. CONVERSATION SUMMARIES
create table conversation_summaries (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references contacts(id),
  summary         text not null,
  key_facts       jsonb default '[]',
  last_message_id uuid references messages(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create unique index idx_summaries_contact on conversation_summaries(contact_id);

-- 15. DAILY REPORTS
create table daily_reports (
  id                  uuid primary key default gen_random_uuid(),
  report_date         date unique not null,
  summary             text not null,
  conversations_count int default 0,
  new_contacts_count  int default 0,
  escalations_count   int default 0,
  revenue_total       numeric(12,2) default 0,
  expense_total       numeric(12,2) default 0,
  highlights          jsonb default '[]',
  sent_at             timestamptz,
  created_at          timestamptz default now()
);

-- ══════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ══════════════════════════════════════════════════════════════

alter table profiles enable row level security;
alter table contacts enable row level security;
alter table properties enable row level security;
alter table reservations enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table knowledge_base enable row level security;
alter table knowledge_base_documents enable row level security;
alter table escalation_rules enable row level security;
alter table financial_categories enable row level security;
alter table financial_transactions enable row level security;
alter table tasks enable row level security;
alter table message_templates enable row level security;
alter table audit_log enable row level security;
alter table conversation_summaries enable row level security;
alter table daily_reports enable row level security;

-- Authenticated users can read everything
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','contacts','properties','reservations','conversations',
    'messages','knowledge_base','knowledge_base_documents','escalation_rules',
    'financial_categories','financial_transactions','tasks','message_templates',
    'audit_log','conversation_summaries','daily_reports'
  ]) loop
    execute format('create policy "auth_read_%s" on %I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth_write_%s" on %I for insert with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth_update_%s" on %I for update using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth_delete_%s" on %I for delete using (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════
-- SEED: Financial Categories
-- ══════════════════════════════════════════════════════════════

insert into financial_categories (name, type) values
  ('Locação', 'revenue'),
  ('Taxa de limpeza', 'revenue'),
  ('Serviços extras', 'revenue'),
  ('Manutenção', 'expense'),
  ('Limpeza', 'expense'),
  ('Contas (água/luz/internet)', 'expense'),
  ('Comissão', 'expense'),
  ('Suprimentos', 'expense'),
  ('Impostos', 'expense'),
  ('Seguro', 'expense'),
  ('Outros', 'expense');

-- ══════════════════════════════════════════════════════════════
-- SEED: Default Escalation Rules
-- ══════════════════════════════════════════════════════════════

insert into escalation_rules (name, description, condition_type, condition_value, action, response_template) values
  ('Valor financeiro alto', 'Escalar quando mencionarem valores acima do limite', 'financial_above', '{"amount": 500}', 'escalate', 'Entendo! Para tratar sobre valores, vou pedir para o Lucas entrar em contato com você diretamente. Ele retornará em breve!'),
  ('Reclamação', 'Escalar quando houver reclamação ou insatisfação', 'keyword', '{"keywords": ["reclamação","insatisfeito","problema grave","péssimo","horrível","nunca mais"]}', 'escalate', 'Lamento muito pela situação. Vou encaminhar diretamente para o Lucas para que ele possa resolver isso pessoalmente. Ele entrará em contato o mais breve possível.'),
  ('Assunto jurídico', 'Escalar quando mencionarem questões legais', 'keyword', '{"keywords": ["advogado","processo","justiça","procon","dano","indenização","notificação"]}', 'escalate', 'Entendo a seriedade do assunto. Vou pedir para o Lucas entrar em contato com você diretamente para tratar dessa questão.'),
  ('Contato desconhecido', 'Notificar quando contato não identificado enviar mensagem', 'category', '{"categories": ["unknown"]}', 'notify', null);

-- ══════════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at
-- ══════════════════════════════════════════════════════════════

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','contacts','properties','reservations','conversations',
    'knowledge_base','escalation_rules','financial_transactions',
    'tasks','message_templates','conversation_summaries'
  ]) loop
    execute format('create trigger trg_updated_at_%s before update on %I for each row execute function update_updated_at()', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile on signup
-- ══════════════════════════════════════════════════════════════

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
