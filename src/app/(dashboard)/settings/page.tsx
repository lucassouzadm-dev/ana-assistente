'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ESCALATION_ACTION_LABELS } from '@/lib/utils/constants'
import { Settings, Plus, Pencil, Trash2, Shield, Smartphone, Mail, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'
import type { EscalationRule, EscalationConditionType, EscalationAction } from '@/types/database'

const CONDITION_TYPE_LABELS: Record<EscalationConditionType, string> = {
  financial_above: 'Valor financeiro acima de',
  complaint: 'Reclamação',
  legal: 'Ameaça jurídica',
  unknown: 'Contato desconhecido',
  keyword: 'Palavra-chave',
  category: 'Categoria de contato',
  custom: 'Personalizado',
}

export default function SettingsPage() {
  const [rules, setRules] = useState<EscalationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EscalationRule | null>(null)

  // WhatsApp connection
  const [waStatus, setWaStatus] = useState<string>('checking')
  const [waQR, setWaQR] = useState<string | null>(null)
  const [waLoading, setWaLoading] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', condition_type: 'keyword' as string, condition_value: '',
    action: 'escalate' as string, response_template: '', priority: 5, is_active: true,
    notify_via: ['whatsapp'] as string[],
  })

  useEffect(() => {
    loadRules()
    checkWhatsAppStatus()
  }, [])

  useEffect(() => {
    if (waStatus !== 'qr_ready' && waStatus !== 'connecting') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status')
        const data = await res.json()
        const state = data.instance?.state || 'disconnected'
        if (state === 'open') {
          setWaStatus('open')
          setWaQR(null)
          clearInterval(interval)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [waStatus])

  async function checkWhatsAppStatus() {
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json()
      setWaStatus(data.instance?.state || 'disconnected')
    } catch {
      setWaStatus('not_configured')
    }
  }

  async function connectWhatsApp() {
    setWaLoading(true)
    setWaQR(null)
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'POST' })
      const data = await res.json()
      if (data.base64) {
        setWaQR(data.base64)
        setWaStatus('qr_ready')
      } else if (data.code) {
        setWaQR(null)
        setWaStatus('connecting')
      }
    } catch {
      setWaStatus('error')
    }
    setWaLoading(false)
  }

  async function loadRules() {
    const supabase = createClient()
    const { data } = await supabase.from('escalation_rules').select('*').order('priority', { ascending: false })
    setRules(data || [])
    setLoading(false)
  }

  function getConditionValueInput() {
    switch (form.condition_type) {
      case 'financial_above':
        return <Input type="number" placeholder="500" value={form.condition_value} onChange={(e) => setForm({ ...form, condition_value: e.target.value })} className="mt-1" />
      case 'keyword':
        return <Input placeholder="palavra1, palavra2, palavra3" value={form.condition_value} onChange={(e) => setForm({ ...form, condition_value: e.target.value })} className="mt-1" />
      case 'category':
        return <Input placeholder="unknown, guest" value={form.condition_value} onChange={(e) => setForm({ ...form, condition_value: e.target.value })} className="mt-1" />
      default:
        return null
    }
  }

  function parseConditionValue(): Record<string, unknown> {
    switch (form.condition_type) {
      case 'financial_above': return { amount: Number(form.condition_value) || 500 }
      case 'keyword': return { keywords: form.condition_value.split(',').map((k) => k.trim()).filter(Boolean) }
      case 'category': return { categories: form.condition_value.split(',').map((k) => k.trim()).filter(Boolean) }
      default: return {}
    }
  }

  function formatConditionValue(rule: EscalationRule): string {
    const val = rule.condition_value as Record<string, unknown>
    switch (rule.condition_type) {
      case 'financial_above': return `R$ ${val.amount || 500}`
      case 'keyword': return (val.keywords as string[] || []).join(', ')
      case 'category': return (val.categories as string[] || []).join(', ')
      default: return ''
    }
  }

  function editConditionValue(rule: EscalationRule): string {
    const val = rule.condition_value as Record<string, unknown>
    switch (rule.condition_type) {
      case 'financial_above': return String(val.amount || 500)
      case 'keyword': return (val.keywords as string[] || []).join(', ')
      case 'category': return (val.categories as string[] || []).join(', ')
      default: return ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const data = {
      name: form.name,
      description: form.description || null,
      condition_type: form.condition_type as EscalationConditionType,
      condition_value: parseConditionValue(),
      action: form.action as EscalationAction,
      response_template: form.response_template || null,
      priority: Number(form.priority),
      is_active: form.is_active,
      notify_via: form.notify_via,
    }

    if (editing) {
      await supabase.from('escalation_rules').update(data).eq('id', editing.id)
    } else {
      await supabase.from('escalation_rules').insert(data)
    }

    setShowForm(false)
    setEditing(null)
    resetForm()
    loadRules()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta regra?')) return
    const supabase = createClient()
    await supabase.from('escalation_rules').delete().eq('id', id)
    loadRules()
  }

  async function toggleActive(rule: EscalationRule) {
    const supabase = createClient()
    await supabase.from('escalation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    loadRules()
  }

  function openEdit(rule: EscalationRule) {
    setEditing(rule)
    setForm({
      name: rule.name,
      description: rule.description || '',
      condition_type: rule.condition_type,
      condition_value: editConditionValue(rule),
      action: rule.action,
      response_template: rule.response_template || '',
      priority: rule.priority,
      is_active: rule.is_active,
      notify_via: rule.notify_via || ['whatsapp'],
    })
    setShowForm(true)
  }

  function resetForm() {
    setForm({ name: '', description: '', condition_type: 'keyword', condition_value: '', action: 'escalate', response_template: '', priority: 5, is_active: true, notify_via: ['whatsapp'] })
  }

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      {/* Connection Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* WhatsApp */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              <CardTitle className="text-base">WhatsApp</CardTitle>
              {waStatus === 'open' ? (
                <Badge className="bg-green-100 text-green-700"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>
              ) : waStatus === 'not_configured' ? (
                <Badge variant="secondary">Não configurado</Badge>
              ) : waStatus === 'checking' ? (
                <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Verificando</Badge>
              ) : (
                <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Número: +55 73 99982-6003</p>
            {waStatus !== 'open' && (
              <div className="space-y-3">
                <Button size="sm" onClick={connectWhatsApp} disabled={waLoading}>
                  {waLoading ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Gerando QR...</> : 'Conectar via QR Code'}
                </Button>
                {waQR && (
                  <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-white border">
                    <img src={waQR.startsWith('data:') ? waQR : `data:image/png;base64,${waQR}`} alt="QR Code WhatsApp" className="w-48 h-48" />
                    <p className="text-xs text-muted-foreground">Escaneie com o WhatsApp em até 30s</p>
                    <Button size="sm" variant="outline" onClick={checkWhatsAppStatus}>
                      <RefreshCw className="mr-2 h-3 w-3" />Verificar conexão
                    </Button>
                  </div>
                )}
              </div>
            )}
            {waStatus === 'open' && (
              <Button size="sm" variant="outline" onClick={checkWhatsAppStatus}>
                <RefreshCw className="mr-2 h-3 w-3" />Verificar status
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Gmail */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <CardTitle className="text-base">Gmail</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Conta: tassimirimco@gmail.com</p>
            <div className="flex gap-2">
              <Link href="/api/auth/gmail">
                <Button size="sm" variant="outline">Reconectar Gmail</Button>
              </Link>
              <Link href="/emails">
                <Button size="sm">Ver E-mails</Button>
              </Link>
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mt-2">
              <p>Para configurar pela primeira vez:</p>
              <ol className="list-decimal list-inside">
                <li>Google Cloud Console → criar projeto</li>
                <li>Ativar Gmail API</li>
                <li>Criar credencial OAuth 2.0 (Web)</li>
                <li>Adicionar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Regras de Escalonamento</CardTitle>
            </div>
            <Button size="sm" onClick={() => { setEditing(null); resetForm(); setShowForm(true) }}>
              <Plus className="mr-2 h-4 w-4" />Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <Card className="border-primary/50">
              <CardContent className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Nome *</label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Descrição</label>
                      <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Tipo de Condição</label>
                      <select value={form.condition_type} onChange={(e) => setForm({ ...form, condition_type: e.target.value, condition_value: '' })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                        {Object.entries(CONDITION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Valor da Condição</label>
                      {getConditionValueInput()}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">Ação</label>
                      <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                        {Object.entries(ESCALATION_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Prioridade (1-10)</label>
                      <Input type="number" min={1} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="mt-1" />
                    </div>
                    <div className="flex items-end gap-2 pb-1">
                      <input type="checkbox" id="rule-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                      <label htmlFor="rule-active" className="text-sm font-medium">Ativa</label>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Resposta automática (opcional)</label>
                    <Textarea value={form.response_template} onChange={(e) => setForm({ ...form, response_template: e.target.value })} placeholder="Mensagem enviada ao contato quando a regra dispara" className="mt-1" />
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit">{editing ? 'Atualizar' : 'Criar'}</Button>
                    <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>Cancelar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {rules.length === 0 && !showForm ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra criada.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{rule.name}</p>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{CONDITION_TYPE_LABELS[rule.condition_type as EscalationConditionType]}</span>
                      {formatConditionValue(rule) && <span>• {formatConditionValue(rule)}</span>}
                      <span>• Ação: {ESCALATION_ACTION_LABELS[rule.action as EscalationAction]}</span>
                      <span>• Prioridade: {rule.priority}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActive(rule)}>
                      {rule.is_active ? '⏸' : '▶'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(rule)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
