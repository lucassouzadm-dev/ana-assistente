'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Building2, BedDouble, Bath, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { createClient } from '@/lib/supabase/client'
import { PROPERTY_STATUS_LABELS } from '@/lib/utils/constants'
import type { Property } from '@/types/database'

const statusVariant: Record<string, 'success' | 'secondary' | 'warning'> = {
  active: 'success',
  inactive: 'secondary',
  maintenance: 'warning',
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('properties')
        .select('*')
        .order('name')
      setProperties(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Imóveis</h1>
        <Link href="/properties/new">
          <Button>
            <Plus className="h-4 w-4" />
            Novo Imóvel
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum imóvel cadastrado"
          description="Cadastre seu primeiro imóvel para começar"
          action={
            <Link href="/properties/new">
              <Button>
                <Plus className="h-4 w-4" />
                Novo Imóvel
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Link key={property.id} href={`/properties/${property.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{property.name}</h3>
                      {property.city && (
                        <p className="text-sm text-muted-foreground">
                          {property.city}{property.state ? `, ${property.state}` : ''}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusVariant[property.status]}>
                      {PROPERTY_STATUS_LABELS[property.status]}
                    </Badge>
                  </div>

                  <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                    {property.bedrooms != null && (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-4 w-4" /> {property.bedrooms}
                      </span>
                    )}
                    {property.bathrooms != null && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-4 w-4" /> {property.bathrooms}
                      </span>
                    )}
                    {property.max_guests != null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" /> {property.max_guests}
                      </span>
                    )}
                  </div>

                  {property.amenities && (property.amenities as string[]).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(property.amenities as string[]).slice(0, 4).map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {a}
                        </span>
                      ))}
                      {(property.amenities as string[]).length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{(property.amenities as string[]).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
