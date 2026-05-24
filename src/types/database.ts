export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ContactCategory =
  | 'collaborator' | 'partner' | 'maintenance' | 'accounting'
  | 'tenant' | 'guest' | 'rental_company' | 'supplier' | 'unknown'

export type PropertyStatus = 'active' | 'inactive' | 'maintenance'
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type ReservationSource = 'direct' | 'partner' | 'referral' | 'returning'
export type ConversationChannel = 'whatsapp' | 'email' | 'internal'
export type ConversationStatus = 'active' | 'escalated' | 'closed'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageSender = 'contact' | 'ai' | 'user'
export type MessageContentType = 'text' | 'image' | 'document' | 'audio' | 'location'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type KBCategory = 'property' | 'procedure' | 'pricing' | 'faq' | 'policy' | 'company' | 'other'
export type EscalationConditionType = 'financial_above' | 'complaint' | 'legal' | 'unknown' | 'keyword' | 'category' | 'custom'
export type EscalationAction = 'escalate' | 'notify' | 'block'
export type TransactionType = 'revenue' | 'expense'
export type PaymentMethod = 'pix' | 'cash' | 'transfer' | 'card' | 'boleto' | 'other'
export type AccountPayableStatus = 'open' | 'paid' | 'cancelled'
export type AccountReceivableStatus = 'open' | 'received' | 'cancelled'
export type CommissionStatus = 'pending' | 'paid' | 'cancelled'
export type TaskStatus = 'pending' | 'in_progress' | 'waiting' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskCategory = 'maintenance' | 'cleaning' | 'inspection' | 'supply' | 'other'
export type TemplateCategory = 'check_in' | 'check_out' | 'welcome' | 'maintenance' | 'payment' | 'confirmation' | 'reminder' | 'general'
export type UserRole = 'owner' | 'manager' | 'viewer'

export interface Profile {
  id: string
  full_name: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  notification_whatsapp: boolean
  notification_email: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
  category: ContactCategory
  relationship_description: string | null
  qualification_status: 'pending' | 'qualified' | 'manual'
  is_active: boolean
  metadata: Json
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface Property {
  id: string
  name: string
  slug: string
  address: string | null
  city: string | null
  state: string
  description: string | null
  amenities: string[]
  max_guests: number | null
  bedrooms: number | null
  bathrooms: number | null
  status: PropertyStatus
  photos: string[]
  rules: string | null
  check_in_time: string
  check_out_time: string
  created_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  property_id: string
  guest_contact_id: string | null
  guest_name: string
  guest_phone: string | null
  guest_email: string | null
  check_in: string
  check_out: string
  num_guests: number
  status: ReservationStatus
  total_price: number | null
  daily_rate: number | null
  cleaning_fee: number
  notes: string | null
  source: ReservationSource
  partner_contact_id: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  contact_id: string
  channel: ConversationChannel
  status: ConversationStatus
  subject: string | null
  summary: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
  contact?: Contact
}

export interface Message {
  id: string
  conversation_id: string
  direction: MessageDirection
  sender: MessageSender
  content: string
  content_type: MessageContentType
  media_url: string | null
  channel_message_id: string | null
  ai_model: string | null
  ai_tokens_in: number | null
  ai_tokens_out: number | null
  status: MessageStatus
  created_at: string
}

export interface KnowledgeBaseEntry {
  id: string
  title: string
  category: KBCategory
  content: string
  property_id: string | null
  tags: string[]
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface EscalationRule {
  id: string
  name: string
  description: string | null
  condition_type: EscalationConditionType
  condition_value: Json
  action: EscalationAction
  notify_via: string[]
  response_template: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface FinancialCategory {
  id: string
  name: string
  type: TransactionType
  parent_id: string | null
  is_active: boolean
}

export interface FinancialTransaction {
  id: string
  type: TransactionType
  amount: number
  category_id: string | null
  property_id: string | null
  reservation_id: string | null
  contact_id: string | null
  description: string | null
  transaction_date: string
  payment_method: PaymentMethod | null
  receipt_url: string | null
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  created_by: string | null
  category?: FinancialCategory
  property?: Property
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  property_id: string | null
  assigned_contact_id: string | null
  reservation_id: string | null
  due_date: string | null
  completed_at: string | null
  category: TaskCategory | null
  created_at: string
  updated_at: string
  created_by: string | null
  property?: Property
  assigned_contact?: Contact
}

export interface MessageTemplate {
  id: string
  name: string
  category: TemplateCategory
  content: string
  variables: string[]
  channel: 'whatsapp' | 'email' | 'both' | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AccountPayable {
  id: string
  description: string
  amount: number
  due_date: string
  paid_date: string | null
  status: AccountPayableStatus
  category_id: string | null
  property_id: string | null
  contact_id: string | null
  notes: string | null
  installment_number: number | null
  installments_total: number | null
  payment_method: PaymentMethod | null
  receipt_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  category?: FinancialCategory
  property?: Property
  contact?: Contact
}

export interface AccountReceivable {
  id: string
  description: string
  amount: number
  due_date: string
  received_date: string | null
  status: AccountReceivableStatus
  category_id: string | null
  property_id: string | null
  reservation_id: string | null
  contact_id: string | null
  notes: string | null
  installment_number: number | null
  installments_total: number | null
  payment_method: PaymentMethod | null
  receipt_url: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  category?: FinancialCategory
  property?: Property
  contact?: Contact
}

export interface Commission {
  id: string
  contact_id: string
  reservation_id: string | null
  rate_percent: number | null
  calculated_amount: number
  status: CommissionStatus
  paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  contact?: Contact
}

export interface DailyReport {
  id: string
  report_date: string
  summary: string
  conversations_count: number
  new_contacts_count: number
  escalations_count: number
  revenue_total: number
  expense_total: number
  highlights: Json
  sent_at: string | null
  created_at: string
}

// ─── CRM Comercial — Fase 2 ──────────────────────────────────────────────────

export type LeadStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
export type LeadOrigin = 'whatsapp' | 'email' | 'referral' | 'instagram' | 'facebook' | 'google' | 'portal' | 'direct' | 'other'
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
export type LeadActivityType = 'note' | 'call' | 'email' | 'whatsapp' | 'visit' | 'proposal_sent' | 'stage_change' | 'other'
export type LoyaltyTier = 'standard' | 'silver' | 'gold' | 'vip'

export interface Lead {
  id: string
  contact_id: string | null
  property_id: string | null
  title: string
  stage: LeadStage
  origin: LeadOrigin
  estimated_value: number | null
  probability: number | null
  check_in_date: string | null
  check_out_date: string | null
  guests_count: number | null
  notes: string | null
  lost_reason: string | null
  stage_updated_at: string
  last_activity_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  contact?: Pick<Contact, 'id' | 'name' | 'phone' | 'email' | 'category'>
  property?: Pick<Property, 'id' | 'name' | 'city'>
}

export interface LeadActivity {
  id: string
  lead_id: string
  type: LeadActivityType
  title: string | null
  description: string
  occurred_at: string
  created_by: string | null
  created_at: string
}

export interface Proposal {
  id: string
  lead_id: string | null
  contact_id: string | null
  property_id: string | null
  number: number
  title: string
  check_in_date: string | null
  check_out_date: string | null
  guests_count: number | null
  nightly_rate: number | null
  total_nights: number | null
  subtotal: number | null
  discount: number
  total_value: number | null
  includes: string[]
  observations: string | null
  status: ProposalStatus
  pdf_url: string | null
  sent_at: string | null
  viewed_at: string | null
  responded_at: string | null
  valid_until: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  contact?: Pick<Contact, 'id' | 'name' | 'phone'>
  property?: Pick<Property, 'id' | 'name' | 'city'>
}

export interface GuestNps {
  id: string
  reservation_id: string | null
  contact_id: string
  property_id: string | null
  score: number
  comment: string | null
  sent_at: string
  responded_at: string | null
  created_at: string
}

export interface LoyaltyRecord {
  id: string
  contact_id: string
  total_stays: number
  total_nights: number
  total_spent: number
  discount_percent: number
  tier: LoyaltyTier
  last_stay_at: string | null
  next_visit_expected: string | null
  notes: string | null
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string; full_name: string }; Update: Partial<Profile> }
      contacts: { Row: Contact; Insert: Partial<Contact> & { name: string }; Update: Partial<Contact> }
      properties: { Row: Property; Insert: Partial<Property> & { name: string; slug: string }; Update: Partial<Property> }
      reservations: { Row: Reservation; Insert: Partial<Reservation> & { property_id: string; guest_name: string; check_in: string; check_out: string }; Update: Partial<Reservation> }
      conversations: { Row: Conversation; Insert: Partial<Conversation> & { contact_id: string; channel: ConversationChannel }; Update: Partial<Conversation> }
      messages: { Row: Message; Insert: Partial<Message> & { conversation_id: string; direction: MessageDirection; sender: MessageSender; content: string }; Update: Partial<Message> }
      knowledge_base: { Row: KnowledgeBaseEntry; Insert: Partial<KnowledgeBaseEntry> & { title: string; category: KBCategory; content: string }; Update: Partial<KnowledgeBaseEntry> }
      escalation_rules: { Row: EscalationRule; Insert: Partial<EscalationRule> & { name: string; condition_type: EscalationConditionType }; Update: Partial<EscalationRule> }
      financial_categories: { Row: FinancialCategory; Insert: Partial<FinancialCategory> & { name: string; type: TransactionType }; Update: Partial<FinancialCategory> }
      financial_transactions: { Row: FinancialTransaction; Insert: Partial<FinancialTransaction> & { type: TransactionType; amount: number; transaction_date: string }; Update: Partial<FinancialTransaction> }
      tasks: { Row: Task; Insert: Partial<Task> & { title: string }; Update: Partial<Task> }
      message_templates: { Row: MessageTemplate; Insert: Partial<MessageTemplate> & { name: string; category: TemplateCategory; content: string }; Update: Partial<MessageTemplate> }
      audit_log: { Row: { id: string; action: string; actor: string; entity_type: string | null; entity_id: string | null; details: Json; ip_address: string | null; created_at: string }; Insert: { action: string; actor: string; entity_type?: string; entity_id?: string; details?: Json; ip_address?: string }; Update: never }
      conversation_summaries: { Row: { id: string; contact_id: string; summary: string; key_facts: Json; last_message_id: string | null; created_at: string; updated_at: string }; Insert: { contact_id: string; summary: string; key_facts?: Json; last_message_id?: string }; Update: Partial<{ summary: string; key_facts: Json; last_message_id: string }> }
      daily_reports: { Row: DailyReport; Insert: Partial<DailyReport> & { report_date: string; summary: string }; Update: Partial<DailyReport> }
      accounts_payable: { Row: AccountPayable; Insert: Partial<AccountPayable> & { description: string; amount: number; due_date: string }; Update: Partial<AccountPayable> }
      accounts_receivable: { Row: AccountReceivable; Insert: Partial<AccountReceivable> & { description: string; amount: number; due_date: string }; Update: Partial<AccountReceivable> }
      commissions: { Row: Commission; Insert: Partial<Commission> & { contact_id: string; calculated_amount: number }; Update: Partial<Commission> }
      leads: { Row: Lead; Insert: Partial<Lead> & { title: string }; Update: Partial<Lead> }
      lead_activities: { Row: LeadActivity; Insert: Partial<LeadActivity> & { lead_id: string; description: string }; Update: Partial<LeadActivity> }
      proposals: { Row: Proposal; Insert: Partial<Proposal> & { title: string }; Update: Partial<Proposal> }
      guest_nps: { Row: GuestNps; Insert: Partial<GuestNps> & { contact_id: string; score: number }; Update: Partial<GuestNps> }
      loyalty_records: { Row: LoyaltyRecord; Insert: Partial<LoyaltyRecord> & { contact_id: string }; Update: Partial<LoyaltyRecord> }
    }
  }
}
