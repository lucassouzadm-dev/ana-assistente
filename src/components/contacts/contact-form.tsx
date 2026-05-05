'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { CONTACT_CATEGORY_LABELS } from '@/lib/utils/constants'
import type { Contact, ContactCategory } from '@/types/database'

interface ContactFormProps {
  contact?: Contact
}

export function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(contact?.name || '')
  const [phone, setPhone] = useState(contact?.phone || '')
  const [email, setEmail] = useState(contact?.email || '')
  const [category, setCategory] = useState<ContactCategory>(contact?.category || 'unknown')
  const [description, setDescription] = useState(contact?.relationship_description || '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const data = {
      name,
      phone: phone || null,
      email: email || null,
      category,
      relationship_description: description || null,
      qualification_status: category === 'unknown' ? 'pending' as const : 'manual' as const,
    }

    if (contact) {
      const { error } = await supabase
        .from('contacts')
        .update(data)
        .eq('id', contact.id)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('contacts')
        .insert(data)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    }

    router.push('/contacts')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contact ? 'Editar Contato' : 'Novo Contato'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
              placeholder="Nome do contato"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
                placeholder="+55 71 99999-9999"
              />
            </div>
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="contato@email.com"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ContactCategory)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(CONTACT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Descrição do Relacionamento</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              placeholder="Ex: Encanador da região de Praia do Forte, indicado pelo João. Atende emergências."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : contact ? 'Salvar' : 'Criar Contato'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
