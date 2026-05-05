import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ptBR })
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, "dd/MM/yyyy 'às' HH:mm")
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

export function todayBRT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }))
}
