'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { KB_CATEGORY_LABELS } from '@/lib/utils/constants'
import type { KnowledgeBaseEntry, KBCategory } from '@/types/database'

interface KBFormProps {
  entry?: KnowledgeBaseEntry
}

export function KBForm({ entry }: KBFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<{
    title: string; category: string; content: string; tags: string;
    priority: number; is_active: boolean; property_id: string;
  }>({
    title: entry?.title || '',
    category: entry?.category || 'faq',
    content: entry?.content || '',
    tags: entry?.tags?.join(', ') || '',
    priority: entry?.priority || 5,
    is_active: entry?.is_active ?? true,
    property_id: entry?.property_id || '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const data = {
      title: form.title,
      category: form.category as KBCategory,
      content: form.content,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      priority: Number(form.priority),
      is_active: form.is_active,
      property_id: form.property_id || null,
    }

    if (entry) {
      await supabase.from('knowledge_base').update(data).eq('id', entry.id)
    } else {
      await supabase.from('knowledge_base').insert(data)
    }

    router.push('/knowledge-base')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="text-sm font-medium">Título *</label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium">Categoria *</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
          {Object.entries(KB_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Conteúdo *</label>
        <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required className="mt-1 min-h-[200px]" />
      </div>

      <div>
        <label className="text-sm font-medium">Tags (separadas por vírgula)</label>
        <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="check-in, praia, regras" className="mt-1" />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Prioridade (1-10)</label>
          <Input type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="mt-1" />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          <label htmlFor="active" className="text-sm font-medium">Ativa</label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : entry ? 'Atualizar' : 'Criar'}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
