'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionForm } from '@/components/financial/transaction-form'
import { TRANSACTION_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/utils/constants'
import { formatBRL } from '@/lib/utils/currency'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import type { FinancialTransaction, TransactionType, PaymentMethod } from '@/types/database'

export default function TransactionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [transaction, setTransaction] = useState<FinancialTransaction | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadTransaction()
  }, [params.id])

  async function loadTransaction() {
    const supabase = createClient()
    const { data } = await supabase.from('financial_transactions').select('*, category:category_id(name), property:property_id(name)').eq('id', params.id).single()
    setTransaction(data as FinancialTransaction)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return
    const supabase = createClient()
    await supabase.from('financial_transactions').delete().eq('id', params.id)
    router.push('/financial')
  }

  if (loading) return <div className="p-6">Carregando...</div>
  if (!transaction) return <div className="p-6">Transação não encontrada</div>

  if (editing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Editar Transação</h1>
        <TransactionForm transaction={transaction} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/financial')}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />Excluir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className={transaction.type === 'revenue' ? 'text-green-700' : 'text-red-700'}>
              {transaction.type === 'revenue' ? '+' : '-'}{formatBRL(Number(transaction.amount))}
            </CardTitle>
            <Badge variant={transaction.type === 'revenue' ? 'default' : 'secondary'}>
              {TRANSACTION_TYPE_LABELS[transaction.type as TransactionType]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Data</p>
              <p className="font-medium">{new Date(transaction.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">{transaction.status === 'completed' ? 'Concluída' : transaction.status === 'pending' ? 'Pendente' : 'Cancelada'}</p>
            </div>
            {(transaction.category as { name: string } | undefined)?.name && (
              <div>
                <p className="text-sm text-muted-foreground">Categoria</p>
                <p className="font-medium">{(transaction.category as { name: string }).name}</p>
              </div>
            )}
            {(transaction.property as { name: string } | undefined)?.name && (
              <div>
                <p className="text-sm text-muted-foreground">Imóvel</p>
                <p className="font-medium">{(transaction.property as { name: string }).name}</p>
              </div>
            )}
            {transaction.payment_method && (
              <div>
                <p className="text-sm text-muted-foreground">Pagamento</p>
                <p className="font-medium">{PAYMENT_METHOD_LABELS[transaction.payment_method as PaymentMethod]}</p>
              </div>
            )}
          </div>
          {transaction.description && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">Descrição</p>
              <p className="whitespace-pre-wrap">{transaction.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
