'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { Property, PropertyStatus } from '@/types/database'
import { PROPERTY_STATUS_LABELS } from '@/lib/utils/constants'

interface PropertyFormProps {
  property?: Property
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function PropertyForm({ property }: PropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(property?.name || '')
  const [address, setAddress] = useState(property?.address || '')
  const [city, setCity] = useState(property?.city || '')
  const [state, setState] = useState(property?.state || 'BA')
  const [description, setDescription] = useState(property?.description || '')
  const [maxGuests, setMaxGuests] = useState(property?.max_guests?.toString() || '')
  const [bedrooms, setBedrooms] = useState(property?.bedrooms?.toString() || '')
  const [bathrooms, setBathrooms] = useState(property?.bathrooms?.toString() || '')
  const [status, setStatus] = useState<PropertyStatus>(property?.status || 'active')
  const [rules, setRules] = useState(property?.rules || '')
  const [checkInTime, setCheckInTime] = useState(property?.check_in_time || '15:00')
  const [checkOutTime, setCheckOutTime] = useState(property?.check_out_time || '11:00')
  const [amenitiesStr, setAmenitiesStr] = useState(
    property?.amenities ? (property.amenities as string[]).join(', ') : ''
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const amenities = amenitiesStr
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)

    const data = {
      name,
      slug: slugify(name),
      address: address || null,
      city: city || null,
      state,
      description: description || null,
      max_guests: maxGuests ? parseInt(maxGuests) : null,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseInt(bathrooms) : null,
      status,
      rules: rules || null,
      check_in_time: checkInTime,
      check_out_time: checkOutTime,
      amenities,
    }

    if (property) {
      const { error } = await supabase
        .from('properties')
        .update(data)
        .eq('id', property.id)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('properties')
        .insert(data)
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    }

    router.push('/properties')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{property ? 'Editar Imóvel' : 'Novo Imóvel'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1"
                placeholder="Casa Praia, Apt Centro..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(PROPERTY_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Endereço</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
              placeholder="Rua, número, bairro"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Cidade</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1"
                placeholder="Valença"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Estado</label>
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1"
                placeholder="BA"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Máx. Hóspedes</label>
              <Input
                type="number"
                value={maxGuests}
                onChange={(e) => setMaxGuests(e.target.value)}
                className="mt-1"
                min="1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Quartos</label>
              <Input
                type="number"
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="mt-1"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Banheiros</label>
              <Input
                type="number"
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="mt-1"
                min="0"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Horário Check-in</label>
              <Input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Horário Check-out</label>
              <Input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Comodidades</label>
            <Input
              value={amenitiesStr}
              onChange={(e) => setAmenitiesStr(e.target.value)}
              className="mt-1"
              placeholder="piscina, churrasqueira, wifi, ar-condicionado (separe por vírgula)"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Descrição do imóvel para uso interno e pela IA"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Regras da Casa</label>
            <Textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Regras que a IA deve informar aos hóspedes"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : property ? 'Salvar' : 'Criar Imóvel'}
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
