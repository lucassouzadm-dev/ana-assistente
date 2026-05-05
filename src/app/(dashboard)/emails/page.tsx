'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { Mail, Search, RefreshCw, Send, Settings } from 'lucide-react'

interface EmailThread {
  id: string
  subject: string
  snippet: string
  lastDate: string
  from: string
  messageCount: number
  isRead: boolean
  labels: string[]
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailThread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [showCompose, setShowCompose] = useState(false)
  const [composeForm, setComposeForm] = useState({ to: '', subject: '', body: '' })
  const [sending, setSending] = useState(false)

  const loadEmails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      const res = await fetch(`/api/email?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load')
      }
      const data = await res.json()
      setEmails(data.emails || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar e-mails')
    }
    setLoading(false)
  }, [searchQuery])

  useEffect(() => {
    loadEmails()
  }, [loadEmails])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(search)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeForm),
      })
      if (!res.ok) throw new Error('Failed to send')
      setShowCompose(false)
      setComposeForm({ to: '', subject: '', body: '' })
      loadEmails()
    } catch {
      alert('Erro ao enviar e-mail')
    }
    setSending(false)
  }

  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      if (isToday) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } catch {
      return dateStr
    }
  }

  if (error && error.includes('Gmail connection')) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">E-mails</h1>
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Gmail não conectado</h2>
            <p className="text-muted-foreground">Conecte a conta tassimirimco@gmail.com para gerenciar e-mails.</p>
            <Link href="/api/auth/gmail">
              <Button><Settings className="mr-2 h-4 w-4" />Conectar Gmail</Button>
            </Link>
            <div className="text-left max-w-md mx-auto text-sm text-muted-foreground space-y-2 mt-6">
              <p className="font-medium text-foreground">Pré-requisitos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Criar projeto no Google Cloud Console</li>
                <li>Habilitar a Gmail API</li>
                <li>Criar credenciais OAuth 2.0 (Web Application)</li>
                <li>Adicionar redirect URI: <code className="bg-muted px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/gmail/callback</code></li>
                <li>Preencher GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env.local</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">E-mails</h1>
          {unreadCount > 0 && <Badge>{unreadCount} não lidos</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadEmails} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowCompose(!showCompose)}>
            <Send className="mr-2 h-4 w-4" />Novo E-mail
          </Button>
        </div>
      </div>

      {showCompose && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSend} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Para *</label>
                  <Input type="email" value={composeForm.to} onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })} required placeholder="email@exemplo.com" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Assunto *</label>
                  <Input value={composeForm.subject} onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })} required className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Mensagem *</label>
                <textarea value={composeForm.body} onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })} required className="mt-1 w-full min-h-[150px] rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={sending}>{sending ? 'Enviando...' : 'Enviar'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowCompose(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar e-mails..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button type="submit" variant="outline">Buscar</Button>
      </form>

      {loading && emails.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">Carregando e-mails...</div>
      ) : error ? (
        <Card><CardContent className="p-6 text-center text-destructive">{error}</CardContent></Card>
      ) : emails.length === 0 ? (
        <EmptyState icon={Mail} title="Nenhum e-mail" description={searchQuery ? 'Nenhum resultado para esta busca.' : 'A caixa de entrada está vazia.'} />
      ) : (
        <div className="divide-y rounded-lg border">
          {emails.map((email) => (
            <Link key={email.id} href={`/emails/${email.id}`}>
              <div className={`flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${!email.isRead ? 'bg-blue-50/50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : ''}`}>{email.from}</span>
                    {email.messageCount > 1 && <Badge variant="secondary" className="text-xs">{email.messageCount}</Badge>}
                    {!email.isRead && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                  <p className={`text-sm truncate ${!email.isRead ? 'font-medium' : 'text-muted-foreground'}`}>{email.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(email.lastDate)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
