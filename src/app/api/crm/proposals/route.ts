import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(id, name, phone),
      property:properties(id, name, city)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()

    // Calculate totals
    const totalNights = body.check_in_date && body.check_out_date
      ? Math.ceil((new Date(body.check_out_date).getTime() - new Date(body.check_in_date).getTime()) / (1000 * 60 * 60 * 24))
      : body.total_nights || null
    const subtotal = body.nightly_rate && totalNights ? body.nightly_rate * totalNights : null
    const discount = body.discount || 0
    const total = subtotal ? subtotal - discount : null

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        lead_id: body.lead_id || null,
        contact_id: body.contact_id || null,
        property_id: body.property_id || null,
        title: body.title,
        check_in_date: body.check_in_date || null,
        check_out_date: body.check_out_date || null,
        guests_count: body.guests_count || null,
        nightly_rate: body.nightly_rate || null,
        total_nights: totalNights,
        subtotal,
        discount,
        total_value: total,
        includes: body.includes || [],
        observations: body.observations || null,
        status: 'draft',
        valid_until: body.valid_until || null,
      })
      .select(`*, contact:contacts(id,name,phone), property:properties(id,name,city)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
