'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/utils/constants'
import type { TaskStatus, TaskPriority } from '@/types/database'

interface TaskWithRelations {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  property_id: string | null
  assigned_contact_id: string | null
  due_date: string | null
  completed_at: string | null
  category: string | null
  created_at: string
  properties: { name: string } | null
  assigned_contact: { name: string } | null
}

const priorityColors: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const statusColumns: TaskStatus[] = ['pending', 'in_progress', 'waiting', 'completed']

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null)
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', property_id: '', assigned_contact_id: '',
    due_date: '', category: 'maintenance', status: 'pending',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const [tasksRes, propsRes, contactsRes] = await Promise.all([
      supabase.from('tasks').select('*, properties:property_id(name), assigned_contact:assigned_contact_id(name)').order('created_at', { ascending: false }),
      supabase.from('properties').select('id, name').eq('status', 'active'),
      supabase.from('contacts').select('id, name').eq('is_active', true).order('name'),
    ])
    setTasks((tasksRes.data as TaskWithRelations[]) || [])
    setProperties(propsRes.data || [])
    setContacts(contactsRes.data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const data = {
      title: form.title,
      description: form.description || null,
      priority: form.priority as TaskPriority,
      property_id: form.property_id || null,
      assigned_contact_id: form.assigned_contact_id || null,
      due_date: form.due_date || null,
      category: form.category,
      status: form.status as TaskStatus,
    }

    if (editingTask) {
      await supabase.from('tasks').update(data).eq('id', editingTask.id)
    } else {
      await supabase.from('tasks').insert(data)
    }

    setShowForm(false)
    setEditingTask(null)
    setForm({ title: '', description: '', priority: 'medium', property_id: '', assigned_contact_id: '', due_date: '', category: 'maintenance', status: 'pending' })
    loadData()
  }

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    const supabase = createClient()
    const update: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'completed') update.completed_at = new Date().toISOString()
    await supabase.from('tasks').update(update).eq('id', taskId)
    loadData()
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    loadData()
  }

  function openEdit(task: TaskWithRelations) {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      property_id: task.property_id || '',
      assigned_contact_id: task.assigned_contact_id || '',
      due_date: task.due_date || '',
      category: task.category || 'maintenance',
      status: task.status,
    })
    setShowForm(true)
  }

  const filtered = tasks.filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}>
            {viewMode === 'kanban' ? 'Lista' : 'Kanban'}
          </Button>
          <Button onClick={() => { setEditingTask(null); setForm({ title: '', description: '', priority: 'medium', property_id: '', assigned_contact_id: '', due_date: '', category: 'maintenance', status: 'pending' }); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Título *</label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Prioridade</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Imóvel</label>
                  <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Nenhum</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Responsável</label>
                  <select value={form.assigned_contact_id} onChange={(e) => setForm({ ...form, assigned_contact_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                    <option value="">Nenhum</option>
                    {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Prazo</label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit">{editingTask ? 'Atualizar' : 'Criar'}</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingTask(null) }}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !showForm ? (
        <EmptyState icon={ClipboardList} title="Nenhuma tarefa" description="Crie tarefas para organizar a operação." />
      ) : viewMode === 'kanban' ? (
        <div className="grid gap-4 md:grid-cols-4">
          {statusColumns.map((status) => (
            <div key={status} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground px-1">{TASK_STATUS_LABELS[status]} ({filtered.filter((t) => t.status === status).length})</h3>
              <div className="space-y-2 min-h-[100px] rounded-lg bg-muted/30 p-2">
                {filtered.filter((t) => t.status === status).map((task) => (
                  <Card key={task.id} className="cursor-pointer" onClick={() => openEdit(task)}>
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium">{task.title}</p>
                      <div className="flex gap-1 flex-wrap">
                        <Badge className={`text-xs ${priorityColors[task.priority]}`}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                        {task.properties?.name && <Badge variant="outline" className="text-xs">{task.properties.name}</Badge>}
                      </div>
                      {task.due_date && <p className="text-xs text-muted-foreground">Prazo: {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                      <div className="flex gap-1">
                        {status !== 'completed' && (
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, status === 'pending' ? 'in_progress' : status === 'in_progress' ? 'waiting' : 'completed') }}>
                            {status === 'pending' ? 'Iniciar' : status === 'in_progress' ? 'Aguardar' : 'Concluir'}
                          </Button>
                        )}
                        {status !== 'completed' && (
                          <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-green-700" onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'completed') }}>Concluir</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <Card key={task.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openEdit(task)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={task.status === 'completed'} onChange={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')} onClick={(e) => e.stopPropagation()} className="h-4 w-4" />
                  <div>
                    <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {task.properties?.name && <span>{task.properties.name}</span>}
                      {task.assigned_contact?.name && <span>• {task.assigned_contact.name}</span>}
                      {task.due_date && <span>• {new Date(task.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className={`text-xs ${priorityColors[task.priority]}`}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                  <Badge variant="outline" className="text-xs">{TASK_STATUS_LABELS[task.status]}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
