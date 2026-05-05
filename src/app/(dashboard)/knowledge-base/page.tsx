'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { BookOpen, Plus, Search } from 'lucide-react'
import { KB_CATEGORY_LABELS } from '@/lib/utils/constants'
import type { KnowledgeBaseEntry, KBCategory } from '@/types/database'

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    loadEntries()
  }, [])

  async function loadEntries() {
    const supabase = createClient()
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('priority', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter((e) => {
    const matchesSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
        <Link href="/knowledge-base/new">
          <Button><Plus className="mr-2 h-4 w-4" />Nova Entrada</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">Todas categorias</option>
          {Object.entries(KB_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhuma entrada" description="Adicione informações à base de conhecimento da Ana." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((entry) => (
            <Link key={entry.id} href={`/knowledge-base/${entry.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                      {entry.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{KB_CATEGORY_LABELS[entry.category as KBCategory]}</Badge>
                    <Badge variant="outline">Prioridade: {entry.priority}</Badge>
                    {entry.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">{entry.content}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
