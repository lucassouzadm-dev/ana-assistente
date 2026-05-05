'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Reply, Bot, Send } from 'lucide-react'

interface EmailMessage {
  id: string
  threadId: string
  from: string
  fromName: string
  to: string
  subject: string
  snippet: string
  body: string
  bodyHtml: string
  date: string
  labels: string[]
  isRead: boolean
  hasAttachments: boolean
  attachments: { filename: string; mimeType: string }[]
}

export default function EmailThreadPage() {
  const params = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiInstruction, setAiInstruction] = useState('')
  const [showAiForm, setShowAiForm] = useState(false)

  useEffect(() => {
    loadThread()
  }, [params.threadId])

  async function loadThread() {
    setLoading(true)
    try {
      const res = await fetch(`/api/email/${params.threadId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      setError('Erro ao carregar thread')
    }
    setLoading(false)
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyBody.trim()) return
    setSending(true)
    const lastMsg = messages[messages.length - 1]
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lastMsg.from,
          subject: lastMsg.subject.startsWith('Re:') ? lastMsg.subject : `Re: ${lastMsg.subject}`,
          body: replyBody,
          threadId: params.threadId,
          inReplyTo: lastMsg.id,
        }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setReplyBody('')
      setShowReply(false)
      loadThread()
    } catch {
      alert('Erro ao enviar resposta')
    }
    setSending(false)
  }

  async function handleAiReply(e: React.FormEvent) {
    e.preventDefault()
    setAiLoading(true)
    try {
      const res = await fetch('/api/email/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: params.threadId,
          instruction: aiInstruction || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setAiInstruction('')
      setShowAiForm(false)
      loadThread()
    } catch {
      alert('Erro ao gerar resposta da Ana')
    }
    setAiLoading(false)
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleString('pt-BR', {
        timeZone: 'America/Bahia',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!messages.length) return <div className="p-6">Thread não encontrada</div>

  const subject = messages[0]?.subject || '(sem assunto)'
  const fromEmail = process.env.NEXT_PUBLIC_APP_URL ? '' : ''

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/emails')}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
        <h1 className="text-lg font-bold flex-1 truncate">{subject}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setShowReply(!showReply); setShowAiForm(false) }}>
            <Reply className="mr-2 h-4 w-4" />Responder
          </Button>
          <Button size="sm" onClick={() => { setShowAiForm(!showAiForm); setShowReply(false) }}>
            <Bot className="mr-2 h-4 w-4" />Ana Responder
          </Button>
        </div>
      </div>

      {showAiForm && (
        <Card className="border-primary/50">
          <CardContent className="p-4">
            <form onSubmit={handleAiReply} className="space-y-3">
              <p className="text-sm font-medium">Ana vai gerar e enviar uma resposta automaticamente</p>
              <div>
                <label className="text-sm text-muted-foreground">Instrução específica (opcional)</label>
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Ex: Confirme a reserva e pergunte sobre horário de chegada"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={aiLoading}>
                  {aiLoading ? 'Gerando resposta...' : 'Ana Responder'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAiForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showReply && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleReply} className="space-y-3">
              <p className="text-sm text-muted-foreground">Respondendo para: {messages[messages.length - 1]?.from}</p>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Escreva sua resposta..."
                className="w-full min-h-[150px] rounded-md border px-3 py-2 text-sm"
                required
              />
              <div className="flex gap-3">
                <Button type="submit" disabled={sending}>
                  <Send className="mr-2 h-4 w-4" />{sending ? 'Enviando...' : 'Enviar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowReply(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {messages.map((msg, idx) => {
          const isSent = msg.from === 'tassimirimco@gmail.com' || msg.labels.includes('SENT')

          return (
            <Card key={msg.id}>
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${isSent ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {isSent ? 'A' : msg.fromName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isSent ? 'Ana (enviado)' : msg.fromName}
                        {isSent && <Badge variant="secondary" className="ml-2 text-xs">Enviado</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{msg.from} — {formatDate(msg.date)}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {msg.bodyHtml && !isSent ? (
                  <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} />
                ) : (
                  <pre className="text-sm whitespace-pre-wrap font-sans">{msg.body}</pre>
                )}
                {msg.hasAttachments && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {msg.attachments.map((att, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {att.filename}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
