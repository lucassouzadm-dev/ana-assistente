'use client'

import { ReservationForm } from '@/components/reservations/reservation-form'

export default function NewReservationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nova Reserva</h1>
      <ReservationForm />
    </div>
  )
}
