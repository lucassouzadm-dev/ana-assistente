'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, BedDouble, Bath, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PropertyForm } from '@/components/properties/property-form'
import { createClient } from '@/lib/supabase/client'
import { PROPERTY_STATUS_LABELS } from '@/lib/utils/constants'
import type { Property } from '@/types/database'

const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  maintenance: 'warning',
}

export default function PropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('id', params.id as string)
        .single()
      setProperty(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este imóvel?')) return
    const supabase = createClient()
    await supabase.from('properties').delete().eq('id', params.id as string)
    router.push('/properties')
  }

  if (loading) return <div className="h-48 animate-pulse rounded-lg bg-muted" />
  if (!property) return <p className="text-muted-foreground">Imóvel não encontrado.</p>

  if (editing) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Editar Imóvel</h1>
        <PropertyForm property={property} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold flex-1">{property.name}</h1>
        <Badge variant={statusVariant[property.status]}>
          {PROPERTY_STATUS_LABELS[property.status]}
        </Badge>
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
            {property.address && (
              <div>
                <p className="text-sm text-muted-foreground">Endereço</p>
                <p>{property.address}</p>
              </div>
            )}
            {property.city && (
              <div>
                <p className="text-sm text-muted-foreground">Cidade</p>
                <p>{property.city}, {property.state}</p>
              </div>
            )}
            <div className="flex gap-6">
              {property.bedrooms != null && (
                <div className="flex items-center gap-1">
                  <BedDouble className="h-4 w-4 text-muted-foreground" />
                  <span>{property.bedrooms} quartos</span>
                </div>
              )}
              {property.bathrooms != null && (
                <div className="flex items-center gap-1">
                  <Bath className="h-4 w-4 text-muted-foreground" />
                  <span>{property.bathrooms} banheiros</span>
                </div>
              )}
              {property.max_guests != null && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{property.max_guests} hóspedes</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Check-in: {property.check_in_time} | Check-out: {property.check_out_time}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comodidades</CardTitle>
          </CardHeader>
          <CardContent>
            {(property.amenities as string[])?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(property.amenities as string[]).map((a) => (
                  <span key={a} className="rounded-full bg-muted px-3 py-1 text-sm">
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma comodidade cadastrada.</p>
            )}
          </CardContent>
        </Card>

        {property.description && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{property.description}</p>
            </CardContent>
          </Card>
        )}

        {property.rules && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Regras da Casa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{property.rules}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
