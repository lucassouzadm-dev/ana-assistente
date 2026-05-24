'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { FinancialNav } from '@/components/financial/financial-nav'
import {
  DollarSign, Plus, Search, TrendingUp, TrendingDown, ArrowUpDown,
  AlertCircle, Clock, CheckCircle,
} from 'lucide-react'
import { formatBRL } from '@/lib/utils/currency'
import { TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { FinancialTransaction, PaymentMethod } from '@/types/database'

const today = new Date().toISOString().split('T')[0]

export default function FinancialPage() {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // C/P and C/R summaries
  const [payablesSummary, setPayablesSummary] = useState({ open: 0, overdue: 0, paidMonth: 0 })
  const [receivablesSummary, setReceivablesSummary] = useState({ open: 0, overdue: 0, receivedMonth: 0 })

  const load = useCallback(async () => {
    const supabase = createClient()
    const [year, month] = monthFilter.split('-').map(Number)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const [txRes, apRes, arRes] = await Promise.all([
      supabase
        .from('financial_transactions')
        .select('*, category:category_id(name), property:property_id(name)')
        .gte('transaction_date', startDate)
        .lt('transaction_date', endDate)
        .order('transaction_date', { ascending: false }),
      supabase.from('accounts_payable').select('amount, status, due_date').gte('due_date', startDate).lt('due_date', endDate),
      supabase.from('accounts_receivable').select('amount, status, due_date').gte('due_date', startDate).lt('due_date', endDate),
    ])

    setTransactions((txRes.data as FinancialTransaction[]) || [])

    const payables = apRes.data || []
    setPayablesSummary({
      open: payables.filter((p) => p.status === 'open' && p.due_date >= today).reduce((s, p) => s + Number(p.amount), 0),
      overdue: payables.filter((p) => p.status === 'open' && p.due_date < today).reduce((s, p) => s + Number(p.amount), 0),
      paidMonth: payables.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0),
    })

    const receivables = arRes.data || []
    setReceivablesSummary({
      open: receivables.filter((r) => r.status === 'open' && r.due_date >= today).reduce((s, r) => s + Number(r.amount), 0),
      overdue: receivables.filter((r) => r.status === 'open' && r.due_date < today).reduce((s, r) => s + Number(r.amount), 0),
      receivedMonth: receivables.filter((r) => r.status === 'received').reduce((s, r) => s + Number(r.amount), 0),
    })

    setLoading(false)
  }, [monthFilter])

  useEffect(() => { load() }, [load])

  const filtered = transactions.filter((t) => {
    const matchesSearch = !search || t.description?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || t.type === typeFilter
    return matchesSearch && matchesType
  })

  const totalRevenue = transactions.filter((t) => t.type === 'revenue' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = transactions.filter((t) => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalRevenue - totalExpenses

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <div className="flex items-center gap-2">
          <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-auto" />
          <Link href="/financial/new">
            <Button><Plus className="mr-2 h-4 w-4" />Nova Transação</Button>
          </Link>
        </div>
      </div>

      <FinancialNav />

      {/* Transactions KPIs */}
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-xl font-bold text-green-700">{formatBRL(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-xl font-bold text-red-700">{formatBRL(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <ArrowUpDown className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resultado</p>
              <p className={`text-xl font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatBRL(balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* C/P and C/R summary */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Contas a Pagar */}
        <Link href="/financial/payables">
          <Card className={`transition-colors hover:bg-muted/50 cursor-pointer ${payablesSummary.overdue > 0 ? 'border-red-200' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Contas a Pagar
                <span className="text-xs text-primary">Ver tudo →</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex justify-center mb-1"><Clock className="h-4 w-4 text-amber-500" /></div>
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="text-sm font-bold text-amber-700">{formatBRL(payablesSummary.open)}</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1"><AlertCircle className="h-4 w-4 text-red-500" /></div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p className={`text-sm font-bold ${payablesSummary.overdue > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                  {formatBRL(payablesSummary.overdue)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1"><CheckCircle className="h-4 w-4 text-green-500" /></div>
                <p className="text-xs text-muted-foreground">Pagas</p>
                <p className="text-sm font-bold text-green-700">{formatBRL(payablesSummary.paidMonth)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Contas a Receber */}
        <Link href="/financial/receivables">
          <Card className={`transition-colors hover:bg-muted/50 cursor-pointer ${receivablesSummary.overdue > 0 ? 'border-orange-200' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                Contas a Receber
                <span className="text-xs text-primary">Ver tudo →</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex justify-center mb-1"><Clock className="h-4 w-4 text-blue-500" /></div>
                <p className="text-xs text-muted-foreground">A receber</p>
                <p className="text-sm font-bold text-blue-700">{formatBRL(receivablesSummary.open)}</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1"><AlertCircle className="h-4 w-4 text-orange-500" /></div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p className={`text-sm font-bold ${receivablesSummary.overdue > 0 ? 'text-orange-700' : 'text-muted-foreground'}`}>
                  {formatBRL(receivablesSummary.overdue)}
                </p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-1"><CheckCircle className="h-4 w-4 text-green-500" /></div>
                <p className="text-xs text-muted-foreground">Recebidas</p>
                <p className="text-sm font-bold text-green-700">{formatBRL(receivablesSummary.receivedMonth)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Transaction list filters */}
      <div className="flex flex-col gap-4 sm:flex-row mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">Todos</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title="Nenhuma transação" description="Registre receitas e despesas para visualizar aqui." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link key={t.id} href={`/financial/${t.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${t.type === 'revenue' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {t.type === 'revenue'
                          ? <TrendingUp className="h-4 w-4 text-green-700" />
                          : <TrendingDown className="h-4 w-4 text-red-700" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.description || (t.category as { name: string } | undefined)?.name || 'Sem descrição'}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{new Date(t.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          {(t.property as { name: string } | undefined)?.name && <span>• {(t.property as { name: string }).name}</span>}
                          {t.payment_method && <span>• {PAYMENT_METHOD_LABELS[t.payment_method as PaymentMethod]}</span>}
                        </div>
                      </div>
                    </div>
                    <p className={`font-bold ${t.type === 'revenue' ? 'text-green-700' : 'text-red-700'}`}>
                      {t.type === 'revenue' ? '+' : '-'}{formatBRL(Number(t.amount))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
