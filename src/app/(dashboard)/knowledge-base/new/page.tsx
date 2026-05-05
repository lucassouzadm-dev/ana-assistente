'use client'

import { KBForm } from '@/components/knowledge-base/kb-form'

export default function NewKBEntryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova Entrada</h1>
      <KBForm />
    </div>
  )
}
