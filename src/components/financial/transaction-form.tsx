'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import type { FinancialTransaction, TransactionType, PaymentMethod } from '@/types/database'

interface TransactionFormProps {
  transaction?: FinancialTransaction
}

export function TransactionForm({ transaction }: TransactionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<{ id: string; name: string; type: string }[]>([])
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState<{
    type: string; amount: string | number; category_id: string; property_id: string;
    description: string; transaction_date: string; payment_method: string; status: string;
  }>({
    type: transaction?.type || 'expense',
    amount: transaction?.amount || '',
    category_id: transaction?.category_id || '',
    property_id: transaction?.property_id || '',
    description: transaction?.description || '',
    transaction_date: transaction?.transaction_date || new Date().toISOString().split('T')[0],
    payment_method: transaction?.payment_method || 'pix',
    status: transaction?.status || 'completed',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('financial_categories').select('id, name, type').eq('is_active', true).order('name').then(({ data }) => setCategories(data || []))
    supabase.from('properties').select('id, name').eq('status', 'active').then(({ data }) => setProperties(data || []))
  }, [])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const data = {
      type: form.type as TransactionType,
      amount: Number(form.amount),
      category_id: form.category_id || null,
      property_id: form.property_id || null,
      description: form.description || null,
      transaction_date: form.transaction_date,
      payment_method: (form.payment_method || null) as PaymentMethod | null,
      status: form.status as 'pending' | 'completed' | 'cancelled',
    }

    if (transaction) {
      await supabase.from('financial_transactions').update(data).eq('id', transaction.id)
    } else {
      await supabase.from('financial_transactions').insert(data)
    }

    router.push('/financial')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="type" checked={form.type === 'revenue'} onChange={() => setForm({ ...form, type: 'revenue', category_id: '' })} />
          <span className="text-sm font-medium text-green-700">Receita</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="type" checked={form.type === 'expense'} onChange={() => setForm({ ...form, type: 'expense', category_id: '' })} />
          <span className="text-sm font-medium text-red-700">Despesa</span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Valor (R$) *</label>
          <Input type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Data *</label>
          <Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} required className="mt-1" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Categoria</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Selecione...</option>
            {filteredCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Imóvel</label>
          <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Nenhum</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Método de Pagamento</label>
          <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="completed">Concluída</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Descrição</label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : transaction ? 'Atualizar' : 'Registrar'}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
