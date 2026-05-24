'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Building2, MessageSquare, DollarSign, CalendarDays, AlertTriangle,
  ClipboardList, TrendingUp, TrendingDown, AlertCircle, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/utils/currency'

interface DashboardStats {
  totalContacts: number
  totalProperties: number
  activeConversations: number
  pendingTasks: number
  upcomingCheckins: number
  escalations: number
  monthlyRevenue: number
  monthlyExpenses: number
  overduePayables: number
  overdueReceivables: number
  weekPayables: number
  totalOpenPayables: number
  totalOpenReceivables: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalContacts: 0,
    totalProperties: 0,
    activeConversations: 0,
    pendingTasks: 0,
    upcomingCheckins: 0,
    escalations: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    overduePayables: 0,
    overdueReceivables: 0,
    weekPayables: 0,
    totalOpenPayables: 0,
    totalOpenReceivables: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const supabase = createClient()
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]

      const [
        contacts,
        properties,
        conversations,
        tasks,
        checkins,
        escalations,
        revenue,
        expenses,
        overduePayRes,
        overdueRecRes,
        weekPayRes,
        openPayRes,
        openRecRes,
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('properties').select('id', { count: 'exact', head: true }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('reservations').select('id', { count: 'exact', head: true }).gte('check_in', today).lte('check_in', nextWeek).eq('status', 'confirmed'),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'escalated'),
        supabase.from('financial_transactions').select('amount').eq('type', 'revenue').gte('transaction_date', startOfMonth).eq('status', 'completed'),
        supabase.from('financial_transactions').select('amount').eq('type', 'expense').gte('transaction_date', startOfMonth).eq('status', 'completed'),
        supabase.from('accounts_payable').select('amount').eq('status', 'open').lt('due_date', today),
        supabase.from('accounts_receivable').select('amount').eq('status', 'open').lt('due_date', today),
        supabase.from('accounts_payable').select('amount').eq('status', 'open').gte('due_date', today).lte('due_date', nextWeek),
        supabase.from('accounts_payable').select('amount').eq('status', 'open'),
        supabase.from('accounts_receivable').select('amount').eq('status', 'open'),
      ])

      const totalRevenue = (revenue.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
      const totalExpenses = (expenses.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
      const overduePayables = (overduePayRes.data || []).reduce((s, t) => s + Number(t.amount), 0)
      const overdueReceivables = (overdueRecRes.data || []).reduce((s, t) => s + Number(t.amount), 0)
      const weekPayables = (weekPayRes.data || []).reduce((s, t) => s + Number(t.amount), 0)
      const totalOpenPayables = (openPayRes.data || []).reduce((s, t) => s + Number(t.amount), 0)
      const totalOpenReceivables = (openRecRes.data || []).reduce((s, t) => s + Number(t.amount), 0)

      setStats({
        totalContacts: contacts.count || 0,
        totalProperties: properties.count || 0,
        activeConversations: conversations.count || 0,
        pendingTasks: tasks.count || 0,
        upcomingCheckins: checkins.count || 0,
        escalations: escalations.count || 0,
        monthlyRevenue: totalRevenue,
        monthlyExpenses: totalExpenses,
        overduePayables,
        overdueReceivables,
        weekPayables,
        totalOpenPayables,
        totalOpenReceivables,
      })
      setLoading(false)
    }

    loadStats()
  }, [])

  const cards = [
    { title: 'Contatos', value: stats.totalContacts, icon: Users, color: 'text-blue-600', href: '/contacts' },
    { title: 'Imóveis', value: stats.totalProperties, icon: Building2, color: 'text-emerald-600', href: '/properties' },
    { title: 'Conversas Ativas', value: stats.activeConversations, icon: MessageSquare, color: 'text-purple-600', href: '/conversations' },
    { title: 'Check-ins (7 dias)', value: stats.upcomingCheckins, icon: CalendarDays, color: 'text-amber-600', href: '/reservations' },
    { title: 'Escalações', value: stats.escalations, icon: AlertTriangle, color: 'text-red-600', href: '/conversations' },
    { title: 'Tarefas Pendentes', value: stats.pendingTasks, icon: ClipboardList, color: 'text-orange-600', href: '/tasks' },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Operations cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Financial overview */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financeiro do mês</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/financial">
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                  <TrendingUp className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receitas</p>
                  <p className="text-lg font-bold text-green-700">{formatBRL(stats.monthlyRevenue)}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/financial">
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
                  <TrendingDown className="h-4 w-4 text-red-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Despesas</p>
                  <p className="text-lg font-bold text-red-700">{formatBRL(stats.monthlyExpenses)}</p>
                  <p className="text-xs text-muted-foreground">
                    Resultado:{' '}
                    <span className={(stats.monthlyRevenue - stats.monthlyExpenses) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {formatBRL(stats.monthlyRevenue - stats.monthlyExpenses)}
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/financial/receivables">
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                  <Clock className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A receber</p>
                  <p className="text-lg font-bold text-blue-700">{formatBRL(stats.totalOpenReceivables)}</p>
                  {stats.overdueReceivables > 0 && (
                    <p className="text-xs text-red-600">{formatBRL(stats.overdueReceivables)} vencido</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/financial/payables">
            <Card className={`transition-colors hover:bg-muted/50 cursor-pointer ${stats.overduePayables > 0 ? 'border-red-200' : ''}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${stats.overduePayables > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <AlertCircle className={`h-4 w-4 ${stats.overduePayables > 0 ? 'text-red-700' : 'text-amber-700'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A pagar</p>
                  <p className={`text-lg font-bold ${stats.overduePayables > 0 ? 'text-red-700' : 'text-amber-700'}`}>{formatBRL(stats.totalOpenPayables)}</p>
                  {stats.overduePayables > 0 && (
                    <p className="text-xs text-red-600">{formatBRL(stats.overduePayables)} vencido</p>
                  )}
                  {stats.weekPayables > 0 && stats.overduePayables === 0 && (
                    <p className="text-xs text-muted-foreground">{formatBRL(stats.weekPayables)} vence em 7 dias</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Alerts row: overdue + upcoming */}
      {(stats.overduePayables > 0 || stats.overdueReceivables > 0 || stats.weekPayables > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Atenção</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {stats.overduePayables > 0 && (
              <Link href="/financial/payables?status=overdue">
                <Card className="border-red-200 bg-red-50/40 transition-colors hover:bg-red-50/70 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Contas a pagar vencidas</p>
                      <p className="text-lg font-bold text-red-700">{formatBRL(stats.overduePayables)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            {stats.overdueReceivables > 0 && (
              <Link href="/financial/receivables?status=overdue">
                <Card className="border-orange-200 bg-orange-50/40 transition-colors hover:bg-orange-50/70 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-700">Contas a receber vencidas</p>
                      <p className="text-lg font-bold text-orange-700">{formatBRL(stats.overdueReceivables)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
            {stats.weekPayables > 0 && (
              <Link href="/financial/payables">
                <Card className="border-amber-200 bg-amber-50/40 transition-colors hover:bg-amber-50/70 cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700">Vencimentos próximos (7 dias)</p>
                      <p className="text-lg font-bold text-amber-700">{formatBRL(stats.weekPayables)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
