import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')

  let query = supabase
    .from('leads')
    .select(`
      *,
      contact:contacts(id, name, phone, email, category),
      property:properties(id, name, city)
    `)
    .order('stage_updated_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { data, error } = await supabase
      .from('leads')
      .insert({
        title: body.title,
        contact_id: body.contact_id || null,
        property_id: body.property_id || null,
        stage: body.stage || 'new',
        origin: body.origin || 'other',
        estimated_value: body.estimated_value || null,
        probability: body.probability || null,
        check_in_date: body.check_in_date || null,
        check_out_date: body.check_out_date || null,
        guests_count: body.guests_count || null,
        notes: body.notes || null,
      })
      .select(`*, contact:contacts(id,name,phone,email,category), property:properties(id,name,city)`)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
