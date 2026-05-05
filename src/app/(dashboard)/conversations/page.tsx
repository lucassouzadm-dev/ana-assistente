'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { createClient } from '@/lib/supabase/client'
import { formatRelative } from '@/lib/utils/date'
import { CONVERSATION_STATUS_LABELS } from '@/lib/utils/constants'
import type { Conversation, ConversationStatus } from '@/types/database'

const statusVariant: Record<ConversationStatus, 'success' | 'destructive' | 'secondary'> = {
  active: 'success',
  escalated: 'destructive',
  closed: 'secondary',
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<(Conversation & { contact: { name: string; category: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      let query = supabase
        .from('conversations')
        .select('*, contacts(name, category)')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50)

      if (statusFilter) {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query

      let results = (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        contact: c.contacts as { name: string; category: string },
      })) as (Conversation & { contact: { name: string; category: string } })[]

      if (search) {
        const s = search.toLowerCase()
        results = results.filter((c) => c.contact?.name?.toLowerCase().includes(s))
      }

      setConversations(results)
      setLoading(false)
    }
    load()
  }, [statusFilter, search])

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === conversations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(conversations.map((c) => c.id)))
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return
    const count = selected.size
    if (!confirm(`Excluir ${count} conversa${count > 1 ? 's' : ''}? As mensagens também serão removidas.`)) return

    setDeleting(true)
    const supabase = createClient()
    const ids = Array.from(selected)

    await supabase.from('messages').delete().in('conversation_id', ids)
    await supabase.from('conversations').delete().in('id', ids)

    setConversations((prev) => prev.filter((c) => !selected.has(c.id)))
    setSelected(new Set())
    setDeleting(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conversas</h1>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? 'Excluindo...' : `Excluir (${selected.size})`}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | '')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(CONVERSATION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nenhuma conversa"
          description="As conversas aparecerão aqui quando contatos enviarem mensagens via WhatsApp."
        />
      ) : (
        <div className="space-y-2">
          {conversations.length > 0 && (
            <label className="flex items-center gap-2 px-4 py-1 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={selected.size === conversations.length}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300"
              />
              Selecionar todas
            </label>
          )}
          {conversations.map((conv) => (
            <div key={conv.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.has(conv.id)}
                onClick={(e) => toggleSelect(conv.id, e)}
                onChange={() => {}}
                className="ml-4 h-4 w-4 shrink-0 rounded border-gray-300 cursor-pointer"
              />
              <Link href={`/conversations/${conv.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                    {conv.contact?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{conv.contact?.name || 'Desconhecido'}</h3>
                      <Badge variant={statusVariant[conv.status]} className="text-[10px]">
                        {CONVERSATION_STATUS_LABELS[conv.status]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {conv.channel}
                      </Badge>
                    </div>
                    {conv.summary && (
                      <p className="text-sm text-muted-foreground truncate">{conv.summary}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {conv.last_message_at ? formatRelative(conv.last_message_at) : ''}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
