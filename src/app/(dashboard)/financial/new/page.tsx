'use client'

import { TransactionForm } from '@/components/financial/transaction-form'

export default function NewTransactionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova Transação</h1>
      <TransactionForm />
    </div>
  )
}
