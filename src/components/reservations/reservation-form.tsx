'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RESERVATION_STATUS_LABELS } from '@/lib/utils/constants'
import type { Reservation, ReservationStatus, ReservationSource } from '@/types/database'

interface ReservationFormProps {
  reservation?: Reservation
}

export function ReservationForm({ reservation }: ReservationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])

  const [form, setForm] = useState<{
    property_id: string; guest_name: string; guest_phone: string; guest_email: string;
    guest_contact_id: string; check_in: string; check_out: string; num_guests: number;
    status: string; total_price: string | number; daily_rate: string | number;
    cleaning_fee: number; source: string; notes: string;
  }>({
    property_id: reservation?.property_id || '',
    guest_name: reservation?.guest_name || '',
    guest_phone: reservation?.guest_phone || '',
    guest_email: reservation?.guest_email || '',
    guest_contact_id: reservation?.guest_contact_id || '',
    check_in: reservation?.check_in || '',
    check_out: reservation?.check_out || '',
    num_guests: reservation?.num_guests || 1,
    status: reservation?.status || 'pending',
    total_price: reservation?.total_price || '',
    daily_rate: reservation?.daily_rate || '',
    cleaning_fee: reservation?.cleaning_fee || 0,
    source: reservation?.source || 'direct',
    notes: reservation?.notes || '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('properties').select('id, name').eq('status', 'active').then(({ data }) => setProperties(data || []))
    supabase.from('contacts').select('id, name').eq('is_active', true).order('name').then(({ data }) => setContacts(data || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const data = {
      property_id: form.property_id,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone || null,
      guest_email: form.guest_email || null,
      guest_contact_id: form.guest_contact_id || null,
      check_in: form.check_in,
      check_out: form.check_out,
      num_guests: Number(form.num_guests),
      status: form.status as ReservationStatus,
      total_price: form.total_price ? Number(form.total_price) : null,
      daily_rate: form.daily_rate ? Number(form.daily_rate) : null,
      cleaning_fee: Number(form.cleaning_fee),
      source: form.source as ReservationSource,
      notes: form.notes || null,
    }

    if (reservation) {
      await supabase.from('reservations').update(data).eq('id', reservation.id)
    } else {
      await supabase.from('reservations').insert(data)
    }

    router.push('/reservations')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className="text-sm font-medium">Imóvel *</label>
        <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} required className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
          <option value="">Selecione...</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Nome do Hóspede *</label>
          <Input value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Contato Vinculado</label>
          <select value={form.guest_contact_id} onChange={(e) => setForm({ ...form, guest_contact_id: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Nenhum</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Telefone</label>
          <Input value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">E-mail</label>
          <Input type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Check-in *</label>
          <Input type="date" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Check-out *</label>
          <Input type="date" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} required className="mt-1" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Hóspedes</label>
          <Input type="number" min={1} value={form.num_guests} onChange={(e) => setForm({ ...form, num_guests: Number(e.target.value) })} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            {Object.entries(RESERVATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Origem</label>
          <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="direct">Direta</option>
            <option value="partner">Parceiro</option>
            <option value="referral">Indicação</option>
            <option value="returning">Retorno</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">Diária (R$)</label>
          <Input type="number" step="0.01" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Taxa de Limpeza (R$)</label>
          <Input type="number" step="0.01" value={form.cleaning_fee} onChange={(e) => setForm({ ...form, cleaning_fee: Number(e.target.value) })} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Total (R$)</label>
          <Input type="number" step="0.01" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} className="mt-1" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Observações</label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : reservation ? 'Atualizar' : 'Criar Reserva'}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </form>
  )
}
