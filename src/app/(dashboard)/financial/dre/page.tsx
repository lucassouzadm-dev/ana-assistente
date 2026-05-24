'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialNav } from '@/components/financial/financial-nav'
import { TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronUp } from 'lucide-react'
import { formatBRL } from '@/lib/utils/currency'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

type TxRow = { type: string; amount: number; category_id: string | null; category?: { name: string } | null }

type CategoryGroup = { name: string; amount: number; percentage: number }

function getPrevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function buildRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end }
}

async function fetchTx(supabase: ReturnType<typeof createClient>, ym: string) {
  const { start, end } = buildRange(ym)
  const res = await supabase
    .from('financial_transactions')
    .select('type, amount, category_id, category:category_id(name)')
    .eq('status', 'completed')
    .gte('transaction_date', start)
    .lt('transaction_date', end)
  return ((res.data || []) as unknown as TxRow[]).map((t) => ({ ...t, amount: Number(t.amount) }))
}

function groupByCategory(txs: TxRow[], type: string): CategoryGroup[] {
  const filtered = txs.filter((t) => t.type === type)
  const total = filtered.reduce((s, t) => s + t.amount, 0)
  const map: Record<string, number> = {}
  for (const t of filtered) {
    const name = (t.category as { name: string } | null)?.name || 'Sem categoria'
    map[name] = (map[name] || 0) + t.amount
  }
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount, percentage: total > 0 ? (amount / total) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null
  const delta = ((current - prev) / prev) * 100
  const up = delta >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}

function CategoryTable({ groups, color }: { groups: CategoryGroup[]; color: string }) {
  if (groups.length === 0) return <p className="text-xs text-muted-foreground py-2">Nenhum lançamento no período.</p>
  return (
    <div className="space-y-1 mt-2">
      {groups.map((g) => (
        <div key={g.name} className="flex items-center gap-2">
          <div className="w-28 text-xs text-muted-foreground truncate shrink-0">{g.name}</div>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${g.percentage}%` }} />
          </div>
          <div className="text-xs font-medium w-24 text-right">{formatBRL(g.amount)}</div>
          <div className="text-xs text-muted-foreground w-10 text-right">{g.percentage.toFixed(0)}%</div>
        </div>
      ))}
    </div>
  )
}

export default function DrePage() {
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [current, setCurrent] = useState<TxRow[]>([])
  const [prev, setPrev] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const prevMonth = getPrevMonth(monthFilter)
    const [curRes, prevRes] = await Promise.all([fetchTx(supabase, monthFilter), fetchTx(supabase, prevMonth)])
    setCurrent(curRes)
    setPrev(prevRes)
    setLoading(false)
  }, [monthFilter])

  useEffect(() => { load() }, [load])

  const curRevenue = useMemo(() => current.filter((t) => t.type === 'revenue').reduce((s, t) => s + t.amount, 0), [current])
  const curExpenses = useMemo(() => current.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [current])
  const curResult = curRevenue - curExpenses

  const prevRevenue = useMemo(() => prev.filter((t) => t.type === 'revenue').reduce((s, t) => s + t.amount, 0), [prev])
  const prevExpenses = useMemo(() => prev.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [prev])
  const prevResult = prevRevenue - prevExpenses

  const revenueGroups = useMemo(() => groupByCategory(current, 'revenue'), [current])
  const expenseGroups = useMemo(() => groupByCategory(current, 'expense'), [current])

  const margin = curRevenue > 0 ? (curResult / curRevenue) * 100 : 0

  const comparisonData = [
    { name: 'Mês anterior', receitas: prevRevenue, despesas: prevExpenses, resultado: prevResult },
    { name: monthLabel(monthFilter).split(' ')[0], receitas: curRevenue, despesas: curExpenses, resultado: curResult },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium mb-1">{label}</p>
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
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
      </div>

      <FinancialNav />

      {/* Period label */}
      <p className="text-sm text-muted-foreground mb-4 capitalize">
        DRE — {monthLabel(monthFilter)}
      </p>

      {/* KPI cards */}
      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
              <TrendingUp className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita bruta</p>
              <p className="text-lg font-bold text-green-700">{formatBRL(curRevenue)}</p>
              <DeltaBadge current={curRevenue} prev={prevRevenue} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <TrendingDown className="h-4 w-4 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas totais</p>
              <p className="text-lg font-bold text-red-700">{formatBRL(curExpenses)}</p>
              <DeltaBadge current={curExpenses} prev={prevExpenses} />
            </div>
          </CardContent>
        </Card>
        <Card className={curResult < 0 ? 'border-red-200' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${curResult >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
              <Wallet className={`h-4 w-4 ${curResult >= 0 ? 'text-blue-700' : 'text-red-700'}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resultado líquido</p>
              <p className={`text-lg font-bold ${curResult >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatBRL(curResult)}</p>
              <span className="text-xs text-muted-foreground">Margem {margin.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison chart */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparativo com mês anterior</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={comparisonData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={customTooltip} />
              <Bar dataKey="receitas" name="Receitas" radius={[4, 4, 0, 0]}>
                {comparisonData.map((_, i) => <Cell key={i} fill={i === 0 ? '#10b98166' : '#10b981'} />)}
              </Bar>
              <Bar dataKey="despesas" name="Despesas" radius={[4, 4, 0, 0]}>
                {comparisonData.map((_, i) => <Cell key={i} fill={i === 0 ? '#ef444466' : '#ef4444'} />)}
              </Bar>
              <Bar dataKey="resultado" name="Resultado" radius={[4, 4, 0, 0]}>
                {comparisonData.map((entry, i) => <Cell key={i} fill={entry.resultado >= 0 ? (i === 0 ? '#3b82f666' : '#3b82f6') : (i === 0 ? '#f9731666' : '#f97316')} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue and Expense breakdown */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Receitas por categoria</CardTitle>
              <span className="text-sm font-bold text-green-700">{formatBRL(curRevenue)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryTable groups={revenueGroups} color="bg-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Despesas por categoria</CardTitle>
              <span className="text-sm font-bold text-red-700">{formatBRL(curExpenses)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryTable groups={expenseGroups} color="bg-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* DRE Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Demonstrativo resumido</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 font-medium">Descrição</th>
                <th className="text-right py-2 font-medium">{monthLabel(getPrevMonth(monthFilter)).split(' ').slice(0, 2).join(' ')}</th>
                <th className="text-right py-2 font-medium capitalize">{monthLabel(monthFilter).split(' ').slice(0, 2).join(' ')}</th>
                <th className="text-right py-2 font-medium">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 font-medium text-green-700">Receita bruta</td>
                <td className="py-2 text-right">{formatBRL(prevRevenue)}</td>
                <td className="py-2 text-right font-semibold">{formatBRL(curRevenue)}</td>
                <td className="py-2 text-right"><DeltaBadge current={curRevenue} prev={prevRevenue} /></td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-red-700">(-) Despesas totais</td>
                <td className="py-2 text-right">{formatBRL(prevExpenses)}</td>
                <td className="py-2 text-right font-semibold">{formatBRL(curExpenses)}</td>
                <td className="py-2 text-right"><DeltaBadge current={curExpenses} prev={prevExpenses} /></td>
              </tr>
              <tr className="bg-muted/40">
                <td className="py-2 font-bold">= Resultado líquido</td>
                <td className={`py-2 text-right font-bold ${prevResult >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatBRL(prevResult)}</td>
                <td className={`py-2 text-right font-bold ${curResult >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatBRL(curResult)}</td>
                <td className="py-2 text-right"><DeltaBadge current={curResult} prev={prevResult} /></td>
              </tr>
              <tr>
                <td className="py-2 text-muted-foreground">Margem líquida</td>
                <td className="py-2 text-right text-muted-foreground">
                  {prevRevenue > 0 ? `${((prevResult / prevRevenue) * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-2 text-right text-muted-foreground">
                  {curRevenue > 0 ? `${margin.toFixed(1)}%` : '—'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
        </CardContent>
      </Card>
    </div>
  )
}
