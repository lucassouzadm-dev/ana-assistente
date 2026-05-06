'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/utils/currency'

interface ChartTransaction {
  type: 'revenue' | 'expense'
  amount: number | string
  status: string
  transaction_date: string
  category?: { name: string } | null
  property?: { name: string } | null
}

const REVENUE_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']
const EXPENSE_COLORS = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2']

export function FinancialCharts({ transactions }: { transactions: ChartTransaction[] }) {
  const completed = transactions.filter((t) => t.status === 'completed')

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; receita: number; despesa: number }>()
    for (const t of completed) {
      const day = t.transaction_date
      const entry = map.get(day) || { date: day, receita: 0, despesa: 0 }
      if (t.type === 'revenue') entry.receita += Number(t.amount)
      else entry.despesa += Number(t.amount)
      map.set(day, entry)
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        ...e,
        label: new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      }))
  }, [completed])

  const revenueByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of completed) {
      if (t.type !== 'revenue') continue
      const name = t.category?.name || 'Sem categoria'
      map.set(name, (map.get(name) || 0) + Number(t.amount))
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [completed])

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of completed) {
      if (t.type !== 'expense') continue
      const name = t.category?.name || 'Sem categoria'
      map.set(name, (map.get(name) || 0) + Number(t.amount))
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [completed])

  const byProperty = useMemo(() => {
    const map = new Map<string, { name: string; receita: number; despesa: number }>()
    for (const t of completed) {
      const name = t.property?.name || 'Sem imóvel'
      const entry = map.get(name) || { name, receita: 0, despesa: 0 }
      if (t.type === 'revenue') entry.receita += Number(t.amount)
      else entry.despesa += Number(t.amount)
      map.set(name, entry)
    }
    return Array.from(map.values())
  }, [completed])

  if (completed.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Sem transações concluídas neste período para gerar gráficos.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Receitas vs Despesas (diário)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" fill="#10b981" name="Receita" />
              <Bar dataKey="despesa" fill="#ef4444" name="Despesa" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {revenueByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={revenueByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => String(entry.name ?? '')}>
                  {revenueByCategory.map((_, i) => (
                    <Cell key={i} fill={REVENUE_COLORS[i % REVENUE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {expenseByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesa por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => String(entry.name ?? '')}>
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {byProperty.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Resultado por imóvel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byProperty} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="receita" fill="#10b981" name="Receita" />
                <Bar dataKey="despesa" fill="#ef4444" name="Despesa" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
