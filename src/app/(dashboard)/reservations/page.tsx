'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { CalendarDays, Plus, Search, List } from 'lucide-react'
import { RESERVATION_STATUS_LABELS } from '@/lib/utils/constants'
import { formatBRL } from '@/lib/utils/currency'
import { ReservationCalendar } from '@/components/reservations/reservation-calendar'
import type { Reservation, ReservationStatus } from '@/types/database'

interface ReservationWithProperty extends Reservation {
  properties: { name: string } | null
}

const statusColors: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-green-100 text-green-800',
  checked_out: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<ReservationWithProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [view, setView] = useState<'list' | 'calendar'>('list')

  useEffect(() => {
    loadReservations()
  }, [])

  async function loadReservations() {
    const supabase = createClient()
    const { data } = await supabase
      .from('reservations')
      .select('*, properties:property_id(name)')
      .order('check_in', { ascending: false })
    setReservations((data as ReservationWithProperty[]) || [])
    setLoading(false)
  }

  const filtered = reservations.filter((r) => {
    const matchesSearch = !search || r.guest_name.toLowerCase().includes(search.toLowerCase()) || r.properties?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reservas</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1 px-3 py-2 text-sm ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1 px-3 py-2 text-sm ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <CalendarDays className="h-4 w-4" />
              Calendário
            </button>
          </div>
          <Link href="/reservations/new">
            <Button><Plus className="mr-2 h-4 w-4" />Nova Reserva</Button>
          </Link>
        </div>
      </div>

      {view === 'list' && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar hóspede ou imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="all">Todos status</option>
            {Object.entries(RESERVATION_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {view === 'calendar' ? (
        <ReservationCalendar reservations={reservations} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nenhuma reserva" description="Crie a primeira reserva." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link key={r.id} href={`/reservations/${r.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer mb-3">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{r.guest_name}</p>
                      <p className="text-sm text-muted-foreground">{r.properties?.name || 'Imóvel não definido'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p>{new Date(r.check_in + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(r.check_out + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                        {r.total_price && <p className="font-medium">{formatBRL(r.total_price)}</p>}
                      </div>
                      <Badge className={statusColors[r.status]}>
                        {RESERVATION_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
