'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Send, AlertTriangle, User, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ContactCategoryBadge } from '@/components/contacts/contact-category-badge'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils/date'
import { CONVERSATION_STATUS_LABELS } from '@/lib/utils/constants'
import type { Message, Contact, Conversation, ConversationStatus } from '@/types/database'

const statusVariant: Record<ConversationStatus, 'success' | 'destructive' | 'secondary'> = {
  active: 'success',
  escalated: 'destructive',
  closed: 'secondary',
}

export default function ConversationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const convId = params.id as string

      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .single()

      if (!conv) {
        setLoading(false)
        return
      }
      setConversation(conv as Conversation)

      const [contactRes, messagesRes] = await Promise.all([
        supabase.from('contacts').select('*').eq('id', conv.contact_id).single(),
        supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true }),
      ])

      setContact(contactRes.data as Contact)
      setMessages((messagesRes.data || []) as Message[])
      setLoading(false)
    }
    load()
  }, [params.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-${params.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${params.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [params.id])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const supabase = createClient()

    await supabase.from('messages').insert({
      conversation_id: params.id as string,
      direction: 'outbound',
      sender: 'user',
      content: newMessage,
      content_type: 'text',
    })

    setNewMessage('')
    setSending(false)
  }

  async function handleInitiateAI() {
    if (!contact) return
    const goal = prompt('Qual o objetivo da mensagem que a Ana deve enviar?')
    if (!goal) return

    const response = await fetch('/api/ai/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contact.id, goal }),
    })

    if (response.ok) {
      const data = await response.json()
      alert(`Mensagem enviada: "${data.message}"`)
    }
  }

  if (loading) return <div className="h-96 animate-pulse rounded-lg bg-muted" />
  if (!conversation) return <p className="text-muted-foreground">Conversa não encontrada.</p>

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{contact?.name || 'Desconhecido'}</h2>
            {contact && <ContactCategoryBadge category={contact.category} />}
            <Badge variant={statusVariant[conversation.status]}>
              {CONVERSATION_STATUS_LABELS[conversation.status]}
            </Badge>
          </div>
          {contact?.relationship_description && (
            <p className="text-xs text-muted-foreground">{contact.relationship_description}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleInitiateAI}>
          <Bot className="h-4 w-4" />
          Ana responder
        </Button>
      </div>

      {/* Escalation banner */}
      {conversation.status === 'escalated' && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 mt-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-700">
            Esta conversa foi escalada e aguarda sua resposta direta.
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                msg.direction === 'outbound'
                  ? msg.sender === 'ai'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {msg.direction === 'outbound' && (
                <div className="flex items-center gap-1 mb-1">
                  {msg.sender === 'ai' ? (
                    <Bot className="h-3 w-3" />
                  ) : (
                    <User className="h-3 w-3" />
                  )}
                  <span className="text-[10px] opacity-70">
                    {msg.sender === 'ai' ? 'Ana' : 'Você'}
                  </span>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-[10px] opacity-50 mt-1">
                {formatDateTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <Card className="p-3">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite uma mensagem (será enviada como você, não como Ana)..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  )
}
