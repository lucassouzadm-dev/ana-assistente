'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KBForm } from '@/components/knowledge-base/kb-form'
import { KB_CATEGORY_LABELS } from '@/lib/utils/constants'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import type { KnowledgeBaseEntry, KBCategory } from '@/types/database'

export default function KBEntryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [entry, setEntry] = useState<KnowledgeBaseEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadEntry()
  }, [params.id])

  async function loadEntry() {
    const supabase = createClient()
    const { data } = await supabase.from('knowledge_base').select('*').eq('id', params.id).single()
    setEntry(data)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta entrada?')) return
    const supabase = createClient()
    await supabase.from('knowledge_base').delete().eq('id', params.id)
    router.push('/knowledge-base')
  }

  if (loading) return <div className="p-6">Carregando...</div>
  if (!entry) return <div className="p-6">Entrada não encontrada</div>

  if (editing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Editar Entrada</h1>
        <KBForm entry={entry} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/knowledge-base')}>
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
            <CardTitle>{entry.title}</CardTitle>
            <Badge variant={entry.is_active ? 'default' : 'secondary'}>
              {entry.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{KB_CATEGORY_LABELS[entry.category as KBCategory]}</Badge>
            <Badge variant="outline">Prioridade: {entry.priority}</Badge>
            {entry.tags?.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm">{entry.content}</div>
        </CardContent>
      </Card>
    </div>
  )
}
