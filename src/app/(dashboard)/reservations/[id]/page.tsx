'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReservationForm } from '@/components/reservations/reservation-form'
import { RESERVATION_STATUS_LABELS } from '@/lib/utils/constants'
import { formatBRL } from '@/lib/utils/currency'
import { Pencil, Trash2, ArrowLeft } from 'lucide-react'
import type { Reservation, ReservationStatus } from '@/types/database'

interface ReservationDetail extends Reservation {
  properties: { name: string } | null
}

export default function ReservationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [reservation, setReservation] = useState<ReservationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    loadReservation()
  }, [params.id])

  async function loadReservation() {
    const supabase = createClient()
    const { data } = await supabase.from('reservations').select('*, properties:property_id(name)').eq('id', params.id).single()
    setReservation(data as ReservationDetail)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta reserva?')) return
    const supabase = createClient()
    await supabase.from('reservations').delete().eq('id', params.id)
    router.push('/reservations')
  }

  if (loading) return <div className="p-6">Carregando...</div>
  if (!reservation) return <div className="p-6">Reserva não encontrada</div>

  if (editing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Editar Reserva</h1>
        <ReservationForm reservation={reservation} />
      </div>
    )
  }

  const nights = Math.ceil((new Date(reservation.check_out).getTime() - new Date(reservation.check_in).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/reservations')}>
          <ArrowLeft className="mr-2 h-4 w-4" />Voltar
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-2 h-4 w-4" />Editar
        </Button>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />Excluir
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{reservation.guest_name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{reservation.properties?.name}</p>
            </div>
            <Badge className={reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : reservation.status === 'checked_in' ? 'bg-green-100 text-green-800' : ''}>
              {RESERVATION_STATUS_LABELS[reservation.status as ReservationStatus]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Check-in</p>
              <p className="font-medium">{new Date(reservation.check_in + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-out</p>
              <p className="font-medium">{new Date(reservation.check_out + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Noites</p>
              <p className="font-medium">{nights}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hóspedes</p>
              <p className="font-medium">{reservation.num_guests}</p>
            </div>
          </div>

          <div className="border-t pt-4 grid gap-4 sm:grid-cols-3">
            {reservation.daily_rate && (
              <div>
                <p className="text-sm text-muted-foreground">Diária</p>
                <p className="font-medium">{formatBRL(reservation.daily_rate)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Limpeza</p>
              <p className="font-medium">{formatBRL(reservation.cleaning_fee)}</p>
            </div>
            {reservation.total_price && (
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-medium text-lg">{formatBRL(reservation.total_price)}</p>
              </div>
            )}
          </div>

          {(reservation.guest_phone || reservation.guest_email) && (
            <div className="border-t pt-4 grid gap-4 sm:grid-cols-2">
              {reservation.guest_phone && <div><p className="text-sm text-muted-foreground">Telefone</p><p>{reservation.guest_phone}</p></div>}
              {reservation.guest_email && <div><p className="text-sm text-muted-foreground">E-mail</p><p>{reservation.guest_email}</p></div>}
            </div>
          )}

          {reservation.notes && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="whitespace-pre-wrap">{reservation.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
