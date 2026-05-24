'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Kanban,
  ExternalLink,
  Flame,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Phone,
  Building2,
  Loader2,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
type LeadStage =
  | 'new_lead'
  | 'contacted'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiating'
  | 'won'
  | 'lost'

interface Lead {
  id: string
  title: string | null
  stage: LeadStage
  origin: string | null
  estimated_value: number | null
  check_in_date: string | null
  check_out_date: string | null
  guests_count: number | null
  notes: string | null
  created_at: string
  stage_updated_at: string | null
  last_activity_at: string | null
  contact?: { id: string; name: string; phone: string | null; email: string | null } | null
  property?: { id: string; name: string; city: string | null } | null
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: 'Novo',
  contacted: 'Contactado',
  qualified: 'Qualificado',
  proposal_sent: 'Proposta Enviada',
  negotiating: 'Negociando',
  won: 'Ganho',
  lost: 'Perdido',
}

const STAGE_COLORS: Record<LeadStage, string> = {
  new_lead: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700',
  proposal_sent: 'bg-amber-100 text-amber-700',
  negotiating: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const ORIGIN_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  airbnb: 'Airbnb',
  booking: 'Booking',
  instagram: 'Instagram',
  referral: 'Indicação',
  direct: 'Direto',
  other: 'Outro',
}

const ALL_STAGES: LeadStage[] = [
  'new_lead',
  'contacted',
  'qualified',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
]

const STALE_DAYS = 7

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

type SortField = 'created_at' | 'stage_updated_at' | 'estimated_value' | 'contact'
type SortDir = 'asc' | 'desc'

// ─── Component ───────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showNewModal, setShowNewModal] = useState(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const url = stageFilter === 'all'
        ? '/api/crm/leads'
        : `/api/crm/leads?stage=${stageFilter}`
      const res = await fetch(url)
      if (res.ok) setLeads(await res.json())
    } finally {
      setLoading(false)
    }
  }, [stageFilter])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // ── Filtering & sorting ──────────────────────────────────────────────────
  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.contact?.name?.toLowerCase().includes(q) ||
      l.property?.name?.toLowerCase().includes(q) ||
      l.title?.toLowerCase().includes(q) ||
      l.contact?.phone?.includes(q)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    let va: string | number | null = null
    let vb: string | number | null = null
    if (sortField === 'created_at') { va = a.created_at; vb = b.created_at }
    else if (sortField === 'stage_updated_at') { va = a.stage_updated_at; vb = b.stage_updated_at }
    else if (sortField === 'estimated_value') { va = a.estimated_value; vb = b.estimated_value }
    else if (sortField === 'contact') { va = a.contact?.name ?? ''; vb = b.contact?.name ?? '' }
    if (va == null) return sortDir === 'asc' ? -1 : 1
    if (vb == null) return sortDir === 'asc' ? 1 : -1
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />
  }

  // ── Stage counts ─────────────────────────────────────────────────────────
  const stageCounts = ALL_STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length
    return acc
  }, {} as Record<LeadStage, number>)

  const activeLeads = leads.filter(l => l.stage !== 'won' && l.stage !== 'lost')
  const totalFunnel = activeLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0)
  const staleCount = activeLeads.filter(l => daysSince(l.stage_updated_at ?? l.created_at) >= STALE_DAYS).length

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie todos os leads comerciais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/crm/pipeline"
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Kanban className="h-4 w-4" />
            Ver Pipeline
          </Link>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Leads Ativos" value={activeLeads.length.toString()} />
        <StatCard label="Funil Total" value={formatCurrency(totalFunnel)} />
        <StatCard label="Ganhos" value={stageCounts.won.toString()} color="text-green-600" />
        <StatCard label="Parados há 7d+" value={staleCount.toString()} color={staleCount > 0 ? 'text-amber-600' : undefined} />
      </div>

      {/* Stage filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setStageFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            stageFilter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Todos ({leads.length})
        </button>
        {ALL_STAGES.map(s => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              stageFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {STAGE_LABELS[s]} ({stageCounts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por contato, imóvel..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando leads…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
            <p className="text-sm">Nenhum lead encontrado.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="text-xs text-primary hover:underline"
            >
              Criar primeiro lead
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('contact')}>
                    Contato <SortIcon field="contact" />
                  </button>
                </th>
                <th className="px-4 py-3">Imóvel</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('estimated_value')}>
                    Valor Est. <SortIcon field="estimated_value" />
                  </button>
                </th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('created_at')}>
                    Criado <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button className="flex items-center gap-1" onClick={() => toggleSort('stage_updated_at')}>
                    Últ. Mov. <SortIcon field="stage_updated_at" />
                  </button>
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map(lead => {
                const staleDays = daysSince(lead.stage_updated_at ?? lead.created_at)
                const isStale = staleDays >= STALE_DAYS && lead.stage !== 'won' && lead.stage !== 'lost'
                return (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isStale && (
                          <span title={`Parado há ${staleDays} dias`}>
                            <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                        <div>
                          <p className="font-medium text-foreground leading-tight">
                            {lead.contact?.name ?? '—'}
                          </p>
                          {lead.contact?.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Phone className="h-3 w-3" />
                              {lead.contact.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.property ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span>{lead.property.name}</span>
                          {lead.property.city && (
                            <span className="text-xs">· {lead.property.city}</span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[lead.stage]}`}>
                        {STAGE_LABELS[lead.stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {lead.origin ? (ORIGIN_LABELS[lead.origin] ?? lead.origin) : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(lead.estimated_value)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {lead.check_in_date
                        ? `${formatDate(lead.check_in_date)} → ${formatDate(lead.check_out_date)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {staleDays < 9999 ? `há ${staleDays}d` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href="/crm/pipeline"
                        title="Ver no pipeline"
                        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground inline-flex"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New Lead Modal */}
      {showNewModal && (
        <NewLeadModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); fetchLeads() }}
        />
      )}
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? 'text-foreground'}`}>{value}</p>
    </div>
  )
}

// ─── New Lead Modal ───────────────────────────────────────────────────────────
interface Contact { id: string; name: string; phone: string | null }
interface Property { id: string; name: string; city: string | null }

function NewLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    contact_id: '',
    property_id: '',
    stage: 'new_lead' as LeadStage,
    origin: '',
    estimated_value: '',
    check_in_date: '',
    check_out_date: '',
    guests_count: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/properties').then(r => r.json()),
    ]).then(([c, p]) => {
      setContacts(Array.isArray(c) ? c : c.data ?? [])
      setProperties(Array.isArray(p) ? p : p.data ?? [])
    })
  }, [])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        contact_id: form.contact_id || null,
        property_id: form.property_id || null,
        stage: form.stage,
        origin: form.origin || null,
        estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
        check_in_date: form.check_in_date || null,
        check_out_date: form.check_out_date || null,
        guests_count: form.guests_count ? parseInt(form.guests_count) : null,
        notes: form.notes || null,
      }
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onCreated()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-background border shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-lg">Novo Lead</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Contato</label>
            <select
              value={form.contact_id}
              onChange={e => set('contact_id', e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Selecionar contato…</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Property */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Imóvel</label>
            <select
              value={form.property_id}
              onChange={e => set('property_id', e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Selecionar imóvel…</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Stage & Origin row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Etapa</label>
              <select
                value={form.stage}
                onChange={e => set('stage', e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {ALL_STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Origem</label>
              <select
                value={form.origin}
                onChange={e => set('origin', e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">—</option>
                {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated value & guests */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Valor Estimado (R$)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={form.estimated_value}
                onChange={e => set('estimated_value', e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Hóspedes</label>
              <input
                type="number"
                min={1}
                value={form.guests_count}
                onChange={e => set('guests_count', e.target.value)}
                placeholder="1"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Check-in</label>
              <input
                type="date"
                value={form.check_in_date}
                onChange={e => set('check_in_date', e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Check-out</label>
              <input
                type="date"
                value={form.check_out_date}
                onChange={e => set('check_out_date', e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Informações adicionais sobre o lead…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
