'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Reservation, ReservationStatus } from '@/types/database'

interface ReservationWithProperty extends Reservation {
  properties: { name: string } | null
}

const statusColor: Record<ReservationStatus, string> = {
  pending: 'bg-yellow-200 hover:bg-yellow-300 text-yellow-900',
  confirmed: 'bg-blue-200 hover:bg-blue-300 text-blue-900',
  checked_in: 'bg-green-200 hover:bg-green-300 text-green-900',
  checked_out: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  cancelled: 'bg-red-200 hover:bg-red-300 text-red-900 line-through',
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T12:00:00')
}

function isInRange(day: Date, checkIn: Date, checkOut: Date): boolean {
  const d = day.setHours(0, 0, 0, 0)
  const ci = new Date(checkIn).setHours(0, 0, 0, 0)
  const co = new Date(checkOut).setHours(0, 0, 0, 0)
  return d >= ci && d < co
}

export function ReservationCalendar({ reservations }: { reservations: ReservationWithProperty[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const days = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const result: (Date | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) result.push(null)
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d))
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [cursor])

  const reservationsByDay = useMemo(() => {
    const map = new Map<string, ReservationWithProperty[]>()
    for (const r of reservations) {
      if (r.status === 'cancelled') continue
      const checkIn = parseDate(r.check_in)
      const checkOut = parseDate(r.check_out)
      for (const day of days) {
        if (!day) continue
        if (isInRange(new Date(day), checkIn, checkOut)) {
          const key = day.toISOString().split('T')[0]
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(r)
        }
      }
    }
    return map
  }, [days, reservations])

  function prev() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  }
  function next() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  }
  function today() {
    const now = new Date()
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const todayKey = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>Hoje</Button>
        </div>
        <h2 className="text-lg font-semibold">
          {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="w-32" />
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={idx} className="aspect-square rounded bg-muted/20" />
          const key = day.toISOString().split('T')[0]
          const dayReservations = reservationsByDay.get(key) || []
          const isToday = key === todayKey
          return (
            <div
              key={idx}
              className={`min-h-[80px] rounded border p-1 ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <div className={`text-xs font-medium ${isToday ? 'text-primary' : ''}`}>
                {day.getDate()}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayReservations.slice(0, 3).map((r) => (
                  <Link key={r.id} href={`/reservations/${r.id}`}>
                    <div
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${statusColor[r.status]}`}
                      title={`${r.guest_name} — ${r.properties?.name || ''}`}
                    >
                      {r.guest_name}
                    </div>
                  </Link>
                ))}
                {dayReservations.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayReservations.length - 3}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
