import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const updates: Record<string, unknown> = { ...body }

    if (body.status === 'sent' && !body.sent_at) updates.sent_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .select(`*, contact:contacts(id,name,phone), property:properties(id,name,city)`)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from('proposals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
