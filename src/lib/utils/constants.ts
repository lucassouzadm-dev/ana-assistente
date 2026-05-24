import type { ContactCategory, PropertyStatus, ReservationStatus, TaskStatus, TaskPriority, ConversationStatus, KBCategory, TemplateCategory, EscalationAction, TransactionType, PaymentMethod, AccountPayableStatus, AccountReceivableStatus, CommissionStatus } from '@/types/database'

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  collaborator: 'Colaborador',
  partner: 'Parceiro',
  maintenance: 'Manutenção',
  accounting: 'Contabilidade',
  tenant: 'Inquilino',
  guest: 'Hóspede',
  rental_company: 'Locadora',
  supplier: 'Fornecedor',
  unknown: 'Desconhecido',
}

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Em Manutenção',
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
  cancelled: 'Cancelada',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  waiting: 'Aguardando',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  active: 'Ativa',
  escalated: 'Escalada',
  closed: 'Encerrada',
}

export const KB_CATEGORY_LABELS: Record<KBCategory, string> = {
  property: 'Imóvel',
  procedure: 'Procedimento',
  pricing: 'Preços',
  faq: 'FAQ',
  policy: 'Política',
  company: 'Empresa',
  other: 'Outro',
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  welcome: 'Boas-vindas',
  maintenance: 'Manutenção',
  payment: 'Pagamento',
  confirmation: 'Confirmação',
  reminder: 'Lembrete',
  general: 'Geral',
}

export const ESCALATION_ACTION_LABELS: Record<EscalationAction, string> = {
  escalate: 'Escalar',
  notify: 'Notificar',
  block: 'Bloquear',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  revenue: 'Receita',
  expense: 'Despesa',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  transfer: 'Transferência',
  card: 'Cartão',
  boleto: 'Boleto',
  other: 'Outro',
}

export const ACCOUNT_PAYABLE_STATUS_LABELS: Record<AccountPayableStatus, string> = {
  open: 'Em aberto',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export const ACCOUNT_RECEIVABLE_STATUS_LABELS: Record<AccountReceivableStatus, string> = {
  open: 'Em aberto',
  received: 'Recebido',
  cancelled: 'Cancelado',
}

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
}
