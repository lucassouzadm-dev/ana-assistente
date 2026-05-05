'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ContactCategoryBadge } from '@/components/contacts/contact-category-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { createClient } from '@/lib/supabase/client'
import { formatPhone } from '@/lib/utils/phone'
import { formatRelative } from '@/lib/utils/date'
import type { Contact, ContactCategory } from '@/types/database'
import { CONTACT_CATEGORY_LABELS } from '@/lib/utils/constants'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ContactCategory | ''>('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })

      if (categoryFilter) {
        query = query.eq('category', categoryFilter)
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data } = await query
      setContacts(data || [])
      setLoading(false)
    }
    load()
  }, [search, categoryFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <Link href="/contacts/new">
          <Button>
            <Plus className="h-4 w-4" />
            Novo Contato
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ContactCategory | '')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas categorias</option>
          {Object.entries(CONTACT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-20 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum contato encontrado"
          description={search || categoryFilter ? 'Tente ajustar os filtros' : 'Cadastre seu primeiro contato'}
          action={
            !search && !categoryFilter && (
              <Link href="/contacts/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  Novo Contato
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Link key={contact.id} href={`/contacts/${contact.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{contact.name}</h3>
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground">{formatPhone(contact.phone)}</p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-muted-foreground truncate">{contact.email}</p>
                      )}
                    </div>
                    <ContactCategoryBadge category={contact.category} />
                  </div>
                  {contact.relationship_description && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {contact.relationship_description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Atualizado {formatRelative(contact.updated_at)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
