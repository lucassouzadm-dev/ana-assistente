'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { FinancialNav } from '@/components/financial/financial-nav'
import { TrendingUp, Plus, Search, AlertCircle, CheckCircle, Clock, X } from 'lucide-react'
import { formatBRL } from '@/lib/utils/currency'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { AccountReceivable, PaymentMethod, FinancialCategory } from '@/types/database'

type AccountReceivableRow = AccountReceivable & {
  category?: { name: string } | null
  property?: { name: string } | null
  contact?: { name: string } | null
}

const today = new Date().toISOString().split('T')[0]

function isOverdue(acc: AccountReceivableRow) {
  return acc.status === 'open' && acc.due_date < today
}

function statusBadge(acc: AccountReceivableRow) {
  if (acc.status === 'received') return <Badge className="bg-green-100 text-green-700 text-xs">Recebido</Badge>
  if (acc.status === 'cancelled') return <Badge className="bg-gray-100 text-gray-500 text-xs">Cancelado</Badge>
  if (isOverdue(acc)) return <Badge className="bg-red-100 text-red-700 text-xs">Vencido</Badge>
  return <Badge className="bg-blue-100 text-blue-700 text-xs">A receber</Badge>
}

const emptyForm = {
  description: '', amount: '', due_date: '', category_id: '', property_id: '',
  contact_id: '', reservation_id: '', notes: '',
  payment_method: '' as PaymentMethod | '',
}

export default function ReceivablesPage() {
  const [accounts, setAccounts] = useState<AccountReceivableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AccountReceivableRow | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const [year, month] = monthFilter.split('-').map(Number)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const [accRes, catRes, propRes, contactRes] = await Promise.all([
      supabase.from('accounts_receivable')
        .select('*, category:category_id(name), property:property_id(name), contact:contact_id(name)')
        .gte('due_date', start).lt('due_date', end)
        .order('due_date', { ascending: true }),
      supabase.from('financial_categories').select('id, name, type').eq('type', 'revenue').eq('is_active', true),
      supabase.from('properties').select('id, name').eq('status', 'active'),
      supabase.from('contacts').select('id, name').eq('is_active', true).order('name'),
    ])
    setAccounts((accRes.data as AccountReceivableRow[]) || [])
    setCategories((catRes.data as FinancialCategory[]) || [])
    setProperties(propRes.data || [])
    setContacts(contactRes.data || [])
    setLoading(false)
  }, [monthFilter])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const data = {
      description: form.description,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      category_id: form.category_id || null,
      property_id: form.property_id || null,
      contact_id: form.contact_id || null,
      reservation_id: form.reservation_id || null,
      notes: form.notes || null,
      payment_method: (form.payment_method as PaymentMethod) || null,
    }
    if (editing) {
      await supabase.from('accounts_receivable').update(data).eq('id', editing.id)
    } else {
      await supabase.from('accounts_receivable').insert(data)
    }
    closeForm(); load()
  }

  async function baixar(id: string) {
    const supabase = createClient()
    await supabase.from('accounts_receivable').update({ status: 'received', received_date: today }).eq('id', id)
    load()
  }

  async function cancelar(id: string) {
    if (!confirm('Cancelar esta conta?')) return
    const supabase = createClient()
    await supabase.from('accounts_receivable').update({ status: 'cancelled' }).eq('id', id)
    load()
  }

  function openEdit(acc: AccountReceivableRow) {
    setEditing(acc)
    setForm({
      description: acc.description,
      amount: String(acc.amount),
      due_date: acc.due_date,
      category_id: acc.category_id || '',
      property_id: acc.property_id || '',
      contact_id: acc.contact_id || '',
      reservation_id: acc.reservation_id || '',
      notes: acc.notes || '',
      payment_method: acc.payment_method || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditing(null); setForm({ ...emptyForm })
  }

  const filtered = accounts.filter((a) => {
    const matchSearch = !search || a.description.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'overdue' && isOverdue(a))
      || (statusFilter !== 'overdue' && a.status === statusFilter)
    return matchSearch && matchStatus
  })

  const totalOpen = accounts.filter((a) => a.status === 'open' && !isOverdue(a)).reduce((s, a) => s + Number(a.amount), 0)
  const totalOverdue = accounts.filter(isOverdue).reduce((s, a) => s + Number(a.amount), 0)
  const totalReceived = accounts.filter((a) => a.status === 'received').reduce((s, a) => s + Number(a.amount), 0)

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <Button onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true) }}>
          <Plus className="mr-2 h-4 w-4" />Nova Conta a Receber
        </Button>
      </div>

      <FinancialNav />

      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
              <Clock className="h-4 w-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A receber</p>
              <p className="text-lg font-bold text-blue-700">{formatBRL(totalOpen)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totalOverdue > 0 ? 'border-red-300' : ''}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-4 w-4 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-lg font-bold text-red-700">{formatBRL(totalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-4 w-4 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido no mês</p>
              <p className="text-lg font-bold text-green-700">{formatBRL(totalReceived)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-auto" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="open">A receber</option>
          <option value="overdue">Vencidas</option>
          <option value="received">Recebidas</option>
          <option value="all">Todos</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{editing ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</h3>
              <button onClick={closeForm}><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Descrição *</label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required className="mt-1" placeholder="Ex: Saldo locação Apto 201 — João Silva" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Valor (R$) *</label>
                  <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="mt-1" placeholder="0,00" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Vencimento *</label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Sem categoria</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Imóvel</label>
                  <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Nenhum</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contato</label>
                  <select value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Nenhum</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Forma de recebimento</label>
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value as PaymentMethod | '' })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Não definido</option>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Observações</label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" placeholder="Opcional" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit">{editing ? 'Salvar' : 'Criar'}</Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Nenhuma conta a receber" description="Registre valores a receber para controle de inadimplência." />
      ) : (
        <div className="space-y-2">
          {filtered.map((acc) => (
            <Card key={acc.id} className={`transition-colors ${isOverdue(acc) ? 'border-red-200 bg-red-50/30' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{acc.description}</p>
                      {statusBadge(acc)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span>Venc: {new Date(acc.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      {(acc.category as { name: string } | null)?.name && <span>• {(acc.category as { name: string }).name}</span>}
                      {(acc.property as { name: string } | null)?.name && <span>• {(acc.property as { name: string }).name}</span>}
                      {(acc.contact as { name: string } | null)?.name && <span>• {(acc.contact as { name: string }).name}</span>}
                      {acc.payment_method && <span>• {PAYMENT_METHOD_LABELS[acc.payment_method]}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="font-bold text-green-700">{formatBRL(Number(acc.amount))}</p>
                    <div className="flex gap-1">
                      {acc.status === 'open' && (
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-green-700 border-green-200" onClick={() => baixar(acc.id)}>
                          Receber
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => openEdit(acc)}>
                        Editar
                      </Button>
                      {acc.status === 'open' && (
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-muted-foreground" onClick={() => cancelar(acc.id)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
