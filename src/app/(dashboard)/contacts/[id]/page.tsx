'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ContactCategoryBadge } from '@/components/contacts/contact-category-badge'
import { ContactForm } from '@/components/contacts/contact-form'
import { createClient } from '@/lib/supabase/client'
import { formatPhone } from '@/lib/utils/phone'
import { formatDateTime } from '@/lib/utils/date'
import type { Contact } from '@/types/database'
import Link from 'next/link'

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showInitiate, setShowInitiate] = useState(false)
  const [goal, setGoal] = useState('')
  const [initiating, setInitiating] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', params.id as string)
        .single()
      setContact(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return
    const supabase = createClient()
    await supabase.from('contacts').update({ is_active: false }).eq('id', params.id as string)
    router.push('/contacts')
  }

  async function handleInitiate() {
    if (!goal.trim()) return
    setInitiating(true)
    try {
      const res = await fetch('/api/ai/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: params.id, goal, channel: 'whatsapp' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar conversa')
      router.push(`/conversations/${data.conversation_id}`)
    } catch (err) {
      alert((err as Error).message)
      setInitiating(false)
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />
  }

  if (!contact) {
    return <p className="text-muted-foreground">Contato não encontrado.</p>
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Editar Contato</h1>
        <ContactForm contact={contact} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">{contact.name}</h1>
        <Link href={`/conversations?contact=${contact.id}`}>
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4" />
            Conversas
          </Button>
        </Link>
        {contact.phone && (
          <Button variant="default" size="sm" onClick={() => setShowInitiate(true)}>
            <Sparkles className="h-4 w-4" />
            Iniciar com IA
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Editar
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Categoria</p>
              <ContactCategoryBadge category={contact.category} />
            </div>
            {contact.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{formatPhone(contact.phone)}</p>
              </div>
            )}
            {contact.email && (
              <div>
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium">{contact.email}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Criado em</p>
              <p className="text-sm">{formatDateTime(contact.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relacionamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {contact.relationship_description || 'Nenhuma descrição cadastrada.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {showInitiate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !initiating && setShowInitiate(false)}>
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">Iniciar conversa com IA</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              A Ana enviará a primeira mensagem para {contact.name} via WhatsApp com o objetivo abaixo.
            </p>
            <Textarea
              placeholder="Ex: agendar visita técnica para reparo no chuveiro da Casa Praia na quinta-feira"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              disabled={initiating}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInitiate(false)} disabled={initiating}>
                Cancelar
              </Button>
              <Button onClick={handleInitiate} disabled={initiating || !goal.trim()}>
                {initiating ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
