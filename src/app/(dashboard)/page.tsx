'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, MessageSquare, DollarSign, CalendarDays, AlertTriangle, ClipboardList } from 'lucide-react'
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
      ] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('properties').select('id', { count: 'exact', head: true }),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('reservations').select('id', { count: 'exact', head: true }).gte('check_in', today).lte('check_in', nextWeek).eq('status', 'confirmed'),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('status', 'escalated'),
        supabase.from('financial_transactions').select('amount').eq('type', 'revenue').gte('transaction_date', startOfMonth).eq('status', 'completed'),
        supabase.from('financial_transactions').select('amount').eq('type', 'expense').gte('transaction_date', startOfMonth).eq('status', 'completed'),
      ])

      const totalRevenue = (revenue.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
      const totalExpenses = (expenses.data || []).reduce((sum, t) => sum + Number(t.amount), 0)

      setStats({
        totalContacts: contacts.count || 0,
        totalProperties: properties.count || 0,
        activeConversations: conversations.count || 0,
        pendingTasks: tasks.count || 0,
        upcomingCheckins: checkins.count || 0,
        escalations: escalations.count || 0,
        monthlyRevenue: totalRevenue,
        monthlyExpenses: totalExpenses,
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

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/financial">
          <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Receita do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                {formatBRL(stats.monthlyRevenue)}
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/financial">
          <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                Despesas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {formatBRL(stats.monthlyExpenses)}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Resultado: <span className={stats.monthlyRevenue - stats.monthlyExpenses >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatBRL(stats.monthlyRevenue - stats.monthlyExpenses)}
                </span>
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
