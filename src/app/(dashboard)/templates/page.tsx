'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { FileText, Plus, Pencil, Trash2, Copy } from 'lucide-react'
import { TEMPLATE_CATEGORY_LABELS } from '@/lib/utils/constants'
import type { MessageTemplate, TemplateCategory } from '@/types/database'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', category: 'general' as string, content: '', channel: 'whatsapp' as string, is_active: true,
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const supabase = createClient()
    const { data } = await supabase.from('message_templates').select('*').order('category').order('name')
    setTemplates(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const variables = (form.content.match(/\{\{(\w+)\}\}/g) || []).map((v) => v.replace(/\{\{|\}\}/g, ''))

    const data = {
      name: form.name,
      category: form.category as TemplateCategory,
      content: form.content,
      variables,
      channel: form.channel as 'whatsapp' | 'email' | 'both',
      is_active: form.is_active,
    }

    if (editing) {
      await supabase.from('message_templates').update(data).eq('id', editing.id)
    } else {
      await supabase.from('message_templates').insert(data)
    }

    setShowForm(false)
    setEditing(null)
    setForm({ name: '', category: 'general', content: '', channel: 'whatsapp', is_active: true })
    loadTemplates()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este template?')) return
    const supabase = createClient()
    await supabase.from('message_templates').delete().eq('id', id)
    loadTemplates()
  }

  function openEdit(t: MessageTemplate) {
    setEditing(t)
    setForm({ name: t.name, category: t.category, content: t.content, channel: t.channel || 'whatsapp', is_active: t.is_active })
    setShowForm(true)
  }

  function copyContent(id: string, content: string) {
    navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = templates.filter((t) => categoryFilter === 'all' || t.category === categoryFilter)

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates de Mensagem</h1>
        <Button onClick={() => { setEditing(null); setForm({ name: '', category: 'general', content: '', channel: 'whatsapp', is_active: true }); setShowForm(true) }}>
          <Plus className="mr-2 h-4 w-4" />Novo Template
        </Button>
      </div>

      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
        <option value="all">Todas categorias</option>
        {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Nome *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Canal</label>
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="both">Ambos</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Conteúdo *</label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required placeholder="Use {{nome_hospede}}, {{nome_imovel}}, etc." className="mt-1 min-h-[120px]" />
                <p className="text-xs text-muted-foreground mt-1">Variáveis disponíveis: {'{{nome_hospede}}'}, {'{{nome_imovel}}'}, {'{{data_checkin}}'}, {'{{data_checkout}}'}, {'{{valor}}'}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tpl-active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                <label htmlFor="tpl-active" className="text-sm">Ativo</label>
              </div>
              <div className="flex gap-3">
                <Button type="submit">{editing ? 'Atualizar' : 'Criar'}</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !showForm ? (
        <EmptyState icon={FileText} title="Nenhum template" description="Crie templates para padronizar comunicações." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyContent(t.id, t.content)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{TEMPLATE_CATEGORY_LABELS[t.category as TemplateCategory]}</Badge>
                  <Badge variant="outline">{t.channel === 'both' ? 'WhatsApp + E-mail' : t.channel === 'email' ? 'E-mail' : 'WhatsApp'}</Badge>
                  {!t.is_active && <Badge variant="secondary">Inativo</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.content}</p>
                {t.variables?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {t.variables.map((v) => <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>)}
                  </div>
                )}
                {copied === t.id && <p className="text-xs text-green-600 mt-1">Copiado!</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
