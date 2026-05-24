'use client'

import { useEffect, useState, useRef } from 'react'
import { Lead, LeadStage } from '@/types/database'
import {
  Plus, Phone, Mail, Building2, Calendar, DollarSign,
  ChevronDown, X, User, TrendingUp, AlertCircle, MoreHorizontal,
  Flame
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES: { key: LeadStage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'new',          label: 'Novo Lead',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  { key: 'qualified',    label: 'Qualificado',   color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { key: 'proposal',     label: 'Proposta',      color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  { key: 'negotiation',  label: 'Negociação',    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  { key: 'closed_won',   label: 'Fechado ✓',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  { key: 'closed_lost',  label: 'Perdido',       color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
]

const ORIGIN_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', email: 'E-mail', referral: 'Indicação',
  instagram: 'Instagram', facebook: 'Facebook', google: 'Google',
  portal: 'Portal', direct: 'Direto', other: 'Outro',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatCurrency(v: number | null) {
  if (!v) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v)
}

function isStale(lead: Lead) {
  const ref = lead.last_activity_at || lead.stage_updated_at
  return daysSince(ref) >= 7 && lead.stage !== 'closed_won' && lead.stage !== 'closed_lost'
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────

interface NewLeadModalProps { defaultStage?: LeadStage; onClose: () => void; onCreated: (lead: Lead) => void }

function NewLeadModal({ defaultStage = 'new', onClose, onCreated }: NewLeadModalProps) {
  const [form, setForm] = useState({ title: '', stage: defaultStage, origin: 'other', estimated_value: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Título obrigatório')
    setLoading(true)
    const res = await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onCreated(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-foreground">Novo Lead</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Família Silva — Casa Azul — Jan/27" autoFocus
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Etapa</label>
              <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value as LeadStage }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                {STAGES.filter(s => s.key !== 'closed_won' && s.key !== 'closed_lost').map(s =>
                  <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Origem</label>
              <select value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50">
                {Object.entries(ORIGIN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor estimado (R$)</label>
            <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
              placeholder="0,00" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {loading ? 'Criando…' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

interface LeadCardProps { lead: Lead; onStageChange: (id: string, stage: LeadStage) => void; onDelete: (id: string) => void }

function LeadCard({ lead, onStageChange, onDelete }: LeadCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const stale = isStale(lead)
  const days = daysSince(lead.stage_updated_at)

  useEffect(() => {
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className={cn('group relative rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-shadow', stale && 'border-amber-500/40')}>
      {stale && (
        <div className="absolute -top-1.5 -right-1.5">
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-white">
            <Flame className="h-2 w-2" />
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-foreground leading-tight flex-1 line-clamp-2">{lead.title}</p>
        <div ref={menuRef} className="relative shrink-0">
          <button onClick={() => setMenuOpen(v => !v)}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-5 z-50 w-44 rounded-lg border bg-popover shadow-lg py-1">
              {STAGES.map(s => (
                <button key={s.key} onClick={() => { onStageChange(lead.id, s.key); setMenuOpen(false) }}
                  className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-accent', lead.stage === s.key && 'font-semibold text-primary')}>
                  {lead.stage === s.key ? `✓ ${s.label}` : s.label}
                </button>
              ))}
              <div className="border-t my-1" />
              <button onClick={() => { onDelete(lead.id); setMenuOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-accent">
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {lead.contact && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.contact.name}</span>
          </div>
        )}
        {lead.property && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.property.name}</span>
          </div>
        )}
        {lead.check_in_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{new Date(lead.check_in_date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              {lead.check_out_date && ` → ${new Date(lead.check_out_date + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
            </span>
          </div>
        )}
        {lead.estimated_value && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground">{formatCurrency(lead.estimated_value)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t">
        <span className="text-[10px] text-muted-foreground">{ORIGIN_LABELS[lead.origin] || lead.origin}</span>
        <span className={cn('text-[10px]', days >= 7 ? 'text-amber-500 font-medium' : 'text-muted-foreground')}>
          {days === 0 ? 'hoje' : `${days}d`}
        </span>
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface ColumnProps {
  stage: typeof STAGES[number]
  leads: Lead[]
  onStageChange: (id: string, stage: LeadStage) => void
  onDelete: (id: string) => void
  onAddLead: (stage: LeadStage) => void
}

function KanbanColumn({ stage, leads, onStageChange, onDelete, onAddLead }: ColumnProps) {
  const total = leads.reduce((s, l) => s + (l.estimated_value || 0), 0)

  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className={cn('flex items-center justify-between rounded-t-lg border px-3 py-2.5', stage.bg, stage.border)}>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', stage.color)}>{stage.label}</span>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', stage.bg, stage.color)}>{leads.length}</span>
        </div>
        {total > 0 && <span className="text-[10px] text-muted-foreground font-medium">{formatCurrency(total)}</span>}
      </div>

      <div className={cn('flex-1 rounded-b-lg border-x border-b p-2 space-y-2 min-h-32', stage.border, 'bg-muted/20')}>
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} onStageChange={onStageChange} onDelete={onDelete} />
        ))}
        {stage.key !== 'closed_won' && stage.key !== 'closed_lost' && (
          <button onClick={() => onAddLead(stage.key)}
            className="w-full flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
            <Plus className="h-3 w-3" /> Adicionar lead
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [defaultStage, setDefaultStage] = useState<LeadStage>('new')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setLoading(true)
    const res = await fetch('/api/crm/leads')
    const data = await res.json()
    setLeads(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function handleStageChange(id: string, stage: LeadStage) {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage, stage_updated_at: new Date().toISOString() } : l))
    await fetch(`/api/crm/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lead?')) return
    setLeads(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' })
  }

  function handleCreated(lead: Lead) {
    setLeads(prev => [lead, ...prev])
    setShowModal(false)
  }

  const filtered = leads.filter(l => !search || l.title.toLowerCase().includes(search.toLowerCase()))
  const staleCount = leads.filter(isStale).length
  const totalValue = leads.filter(l => l.stage !== 'closed_lost').reduce((s, l) => s + (l.estimated_value || 0), 0)

  // Summary stats
  const wonLeads = leads.filter(l => l.stage === 'closed_won')
  const totalLeads = leads.filter(l => l.stage !== 'closed_won' && l.stage !== 'closed_lost').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Pipeline de Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalLeads} leads ativos · {formatCurrency(totalValue) || 'R$ 0'} no funil
              {staleCount > 0 && <span className="ml-2 text-amber-500 font-medium">· {staleCount} parado{staleCount > 1 ? 's' : ''}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead…"
              className="w-48 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            <button onClick={() => { setDefaultStage('new'); setShowModal(true) }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Novo Lead
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: 'Em andamento', value: totalLeads, icon: TrendingUp, color: 'text-blue-400' },
            { label: 'Fechados', value: wonLeads.length, icon: DollarSign, color: 'text-green-400' },
            { label: 'Parados (+7d)', value: staleCount, icon: AlertCircle, color: staleCount > 0 ? 'text-amber-400' : 'text-muted-foreground' },
            { label: 'Valor total', value: formatCurrency(totalValue) || 'R$ 0', icon: TrendingUp, color: 'text-foreground' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <s.icon className={cn('h-3.5 w-3.5', s.color)} />
              <span className="text-muted-foreground">{s.label}:</span>
              <span className="font-medium text-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Carregando pipeline…</div>
        ) : (
          <div className="flex gap-3 pb-4" style={{ minWidth: 'max-content' }}>
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                leads={filtered.filter(l => l.stage === stage.key)}
                onStageChange={handleStageChange}
                onDelete={handleDelete}
                onAddLead={(s) => { setDefaultStage(s); setShowModal(true) }}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewLeadModal defaultStage={defaultStage} onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
