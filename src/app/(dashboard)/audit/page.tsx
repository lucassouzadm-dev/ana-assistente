'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { ScrollText, Search, ChevronDown, ChevronUp } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  actor: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  ai_response: 'Resposta IA',
  escalation: 'Escalonamento',
  lucas_command: 'Comando do Lucas',
  contact_created: 'Contato criado',
  contact_updated: 'Contato atualizado',
  property_created: 'Imóvel criado',
  reservation_created: 'Reserva criada',
  task_created: 'Tarefa criada',
}

const ACTION_COLORS: Record<string, string> = {
  ai_response: 'bg-blue-100 text-blue-700',
  escalation: 'bg-red-100 text-red-700',
  lucas_command: 'bg-purple-100 text-purple-700',
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadEntries()
  }, [page, actionFilter])

  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter)
    }

    const { data } = await query
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter((e) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      e.action.toLowerCase().includes(searchLower) ||
      e.actor.toLowerCase().includes(searchLower) ||
      JSON.stringify(e.details).toLowerCase().includes(searchLower)
    )
  })

  const uniqueActions = [...new Set(entries.map((e) => e.action))]

  if (loading && page === 0) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Auditoria</h1>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ação, ator, detalhes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(0) }} className="rounded-md border px-3 py-2 text-sm">
          <option value="all">Todas ações</option>
          {uniqueActions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhum registro" description="O log de auditoria aparecerá aqui." />
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-700'}`}>
                      {ACTION_LABELS[entry.action] || entry.action}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{entry.actor}</span>
                    {entry.entity_type && <span className="text-xs text-muted-foreground">({entry.entity_type})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}
                    </span>
                    {expanded === entry.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                {expanded === entry.id && (
                  <div className="mt-3 rounded bg-muted p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(entry.details, null, 2)}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
        <span className="text-sm text-muted-foreground py-2">Página {page + 1}</span>
        <Button variant="outline" size="sm" disabled={entries.length < pageSize} onClick={() => setPage(page + 1)}>Próxima</Button>
      </div>
    </div>
  )
}
