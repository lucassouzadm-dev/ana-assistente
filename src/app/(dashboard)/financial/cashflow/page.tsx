'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialNav } from '@/components/financial/financial-nav'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { formatBRL } from '@/lib/utils/currency'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'

export default function CashflowPage() {
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [transactions, setTransactions] = useState<{ type: string; amount: number; transaction_date: string; status: string }[]>([])
  const [payables, setPayables] = useState<{ amount: number; due_date: string; status: string }[]>([])
  const [receivables, setReceivables] = useState<{ amount: number; due_date: string; status: string }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [year, month] = monthFilter.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const [txRes, apRes, arRes] = await Promise.all([
      supabase.from('financial_transactions').select('type, amount, transaction_date, status').gte('transaction_date', start).lt('transaction_date', end),
      supabase.from('accounts_payable').select('amount, due_date, status').gte('due_date', start).lt('due_date', end),
      supabase.from('accounts_receivable').select('amount, due_date, status').gte('due_date', start).lt('due_date', end),
    ])
    setTransactions((txRes.data || []).map((t) => ({ ...t, amount: Number(t.amount) })))
    setPayables((apRes.data || []).map((t) => ({ ...t, amount: Number(t.amount) })))
    setReceivables((arRes.data || []).map((t) => ({ ...t, amount: Number(t.amount) })))
    setLoading(false)
  }, [monthFilter])

  useEffect(() => { load() }, [load])

  const dailySeries = useMemo(() => {
    const [year, month] = monthFilter.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const days: { date: string; label: string; entradas: number; saidas: number; projetadoEntradas: number; projetadoSaidas: number }[] = []

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const entradas = transactions.filter((t) => t.type === 'revenue' && t.status === 'completed' && t.transaction_date === dateStr).reduce((s, t) => s + t.amount, 0)
      const saidas = transactions.filter((t) => t.type === 'expense' && t.status === 'completed' && t.transaction_date === dateStr).reduce((s, t) => s + t.amount, 0)
      const projetadoEntradas = receivables.filter((r) => r.status === 'open' && r.due_date === dateStr).reduce((s, r) => s + r.amount, 0)
      const projetadoSaidas = payables.filter((p) => p.status === 'open' && p.due_date === dateStr).reduce((s, p) => s + p.amount, 0)
      days.push({ date: dateStr, label: String(d), entradas, saidas, projetadoEntradas, projetadoSaidas })
    }
    return days
  }, [transactions, payables, receivables, monthFilter])

  const balanceSeries = useMemo(() => {
    let balance = 0
    return dailySeries.map((d) => {
      balance += d.entradas - d.saidas
      return { ...d, saldo: balance }
    })
  }, [dailySeries])

  const totalEntradas = transactions.filter((t) => t.type === 'revenue' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const totalSaidas = transactions.filter((t) => t.type === 'expense' && t.status === 'completed').reduce((s, t) => s + t.amount, 0)
  const projetadoEntradas = receivables.filter((r) => r.status === 'open').reduce((s, r) => s + r.amount, 0)
  const projetadoSaidas = payables.filter((p) => p.status === 'open').reduce((s, p) => s + p.amount, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium mb-1">Dia {label}</p>
        {payload.map((p: { name: string; value: number; color: string }, i: number) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {formatBRL(Number(p.value ?? 0))}</p>
        ))}
      </div>
    )
  }

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
      </div>

      <FinancialNav />

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas realizadas</p>
              <p className="text-lg font-bold text-green-700">{formatBRL(totalEntradas)}</p>
              {projetadoEntradas > 0 && <p className="text-xs text-muted-foreground">+ {formatBRL(projetadoEntradas)} projetado</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas realizadas</p>
              <p className="text-lg font-bold text-red-700">{formatBRL(totalSaidas)}</p>
              {projetadoSaidas > 0 && <p className="text-xs text-muted-foreground">+ {formatBRL(projetadoSaidas)} projetado</p>}
            </div>
          </CardContent>
        </Card>
        <Card className={(totalEntradas - totalSaidas) >= 0 ? '' : 'border-red-200'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${(totalEntradas - totalSaidas) >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
              <Wallet className={`h-4 w-4 ${(totalEntradas - totalSaidas) >= 0 ? 'text-blue-700' : 'text-red-700'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo realizado</p>
              <p className={`text-lg font-bold ${(totalEntradas - totalSaidas) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatBRL(totalEntradas - totalSaidas)}</p>
              <p className="text-xs text-muted-foreground">Projetado: {formatBRL(totalEntradas + projetadoEntradas - totalSaidas - projetadoSaidas)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saldo acumulado */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldo Acumulado Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={balanceSeries}>
              <defs>
                <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              <Area type="monotone" dataKey="saldo" stroke="#3b82f6" fill="url(#colorSaldo)" name="Saldo" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Entradas e saídas diárias */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Entradas e Saídas por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entradas" fill="#10b981" name="Entradas realizadas" stackId="a" />
              <Bar dataKey="projetadoEntradas" fill="#10b98166" name="Entradas projetadas" stackId="a" />
              <Bar dataKey="saidas" fill="#ef4444" name="Saídas realizadas" stackId="b" />
              <Bar dataKey="projetadoSaidas" fill="#ef444466" name="Saídas projetadas" stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
