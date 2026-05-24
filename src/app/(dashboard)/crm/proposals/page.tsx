'use client'

import { useEffect, useState } from 'react'
import { Proposal, ProposalStatus } from '@/types/database'
import { Plus, FileText, Send, Eye, CheckCircle, XCircle, Clock, Search, MoreHorizontal, X, Building2, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import Link from 'next/link'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ProposalStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft:    { label: 'Rascunho',  color: 'text-muted-foreground', bg: 'bg-muted',           icon: FileText },
  sent:     { label: 'Enviada',   color: 'text-blue-400',         bg: 'bg-blue-500/10',     icon: Send },
  viewed:   { label: 'Visualizada', color: 'text-purple-400',    bg: 'bg-purple-500/10',   icon: Eye },
  accepted: { label: 'Aceita',    color: 'text-green-400',        bg: 'bg-green-500/10',    icon: CheckCircle },
  rejected: { label: 'Recusada', color: 'text-red-400',           bg: 'bg-red-500/10',      icon: XCircle },
  expired:  { label: 'Expirada', color: 'text-amber-400',         bg: 'bg-amber-500/10',    icon: Clock },
}

function formatCurrency(v: number | null) {
  if (!v) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + (d.includes('T') ? '' : 'T12:00')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

// ─── New Proposal Modal ───────────────────────────────────────────────────────

interface NewProposalModalProps { onClose: () => void; onCreated: (p: Proposal) => void }

function NewProposalModal({ onClose, onCreated }: NewProposalModalProps) {
  const [form, setForm] = useState({
    title: '', contact_id: '', property_id: '',
    check_in_date: '', check_out_date: '', guests_count: '',
    nightly_rate: '', discount: '0',
    includes: 'Limpeza final, Enxoval de cama e banho',
    observations: '', valid_until: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Calculate derived values
  const nights = form.check_in_date && form.check_out_date
    ? Math.ceil((new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)
    : 0
  const subtotal = parseFloat(form.nightly_rate || '0') * nights
  const discount = parseFloat(form.discount || '0')
  const total = subtotal - discount

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('Título obrigatório')
    setLoading(true)
    const res = await fetch('/api/crm/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        guests_count: form.guests_count ? parseInt(form.guests_count) : null,
        nightly_rate: form.nightly_rate ? parseFloat(form.nightly_rate) : null,
        discount: parseFloat(form.discount || '0'),
        includes: form.includes.split(',').map(s => s.trim()).filter(Boolean),
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    onCreated(data)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl border bg-card shadow-2xl my-4">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold text-foreground">Nova Proposta</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título da proposta *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus
              placeholder="Ex: Proposta — Casa Azul — Família Silva — Jan/27"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-in</label>
              <input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Check-out</label>
              <input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hóspedes</label>
              <input type="number" value={form.guests_count} onChange={e => setForm(f => ({ ...f, guests_count: e.target.value }))}
                placeholder="0" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Diária (R$)</label>
              <input type="number" value={form.nightly_rate} onChange={e => setForm(f => ({ ...f, nightly_rate: e.target.value }))}
                placeholder="0,00" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Desconto (R$)</label>
              <input type="number" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                placeholder="0,00" className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>

          {/* Price summary */}
          {nights > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>{nights} noite{nights > 1 ? 's' : ''} × {formatCurrency(parseFloat(form.nightly_rate || '0'))}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span>- {formatCurrency(discount)}</span></div>}
              <div className="flex justify-between font-semibold text-foreground border-t pt-1">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Itens incluídos (separados por vírgula)</label>
            <input value={form.includes} onChange={e => setForm(f => ({ ...f, includes: e.target.value }))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
            <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} rows={2}
              placeholder="Condições especiais, políticas de cancelamento, etc."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Validade da proposta</label>
            <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {loading ? 'Criando…' : 'Criar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | ''>('')

  useEffect(() => { fetchProposals() }, [])

  async function fetchProposals() {
    setLoading(true)
    const params = filterStatus ? `?status=${filterStatus}` : ''
    const res = await fetch(`/api/crm/proposals${params}`)
    const data = await res.json()
    setProposals(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: ProposalStatus) {
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    await fetch(`/api/crm/proposals/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  const filtered = proposals.filter(p =>
    (!search || p.title.toLowerCase().includes(search.toLowerCase())) &&
    (!filterStatus || p.status === filterStatus)
  )

  const stats = {
    total: proposals.length,
    sent: proposals.filter(p => p.status === 'sent' || p.status === 'viewed').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    totalValue: proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.total_value || 0), 0),
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Propostas Comerciais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} proposta{stats.total !== 1 ? 's' : ''} · {stats.sent} aguardando resposta · {formatCurrency(stats.totalValue)} em contratos fechados
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nova Proposta
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
            className="pl-9 w-52 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-1.5">
          {([['', 'Todas'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])] as [string, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setFilterStatus(k as ProposalStatus | '')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                filterStatus === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent border-border')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando propostas…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhuma proposta encontrada</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-primary hover:underline">Criar a primeira proposta</button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {['Nº', 'Proposta', 'Imóvel / Cliente', 'Período', 'Valor', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status]
                const StatusIcon = cfg.icon
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">#{p.number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground line-clamp-1">{p.title}</p>
                      {p.observations && <p className="text-xs text-muted-foreground line-clamp-1">{p.observations}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.property && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{p.property.name}</div>}
                      {p.contact && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><User className="h-3 w-3" />{p.contact.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {p.check_in_date ? <>{formatDate(p.check_in_date)} → {formatDate(p.check_out_date)}<br />{p.total_nights} noite{(p.total_nights || 0) > 1 ? 's' : ''}</> : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{formatCurrency(p.total_value)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', cfg.bg, cfg.color)}>
                        <StatusIcon className="h-3 w-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select value={p.status}
                        onChange={e => updateStatus(p.id, e.target.value as ProposalStatus)}
                        className="text-xs rounded-md border bg-background px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50">
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NewProposalModal onClose={() => setShowModal(false)} onCreated={p => { setProposals(prev => [p, ...prev]); setShowModal(false) }} />}
    </div>
  )
}
