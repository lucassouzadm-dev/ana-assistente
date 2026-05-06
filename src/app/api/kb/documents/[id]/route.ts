import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'kb-documents'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('knowledge_base_documents')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
  }

  await supabase.storage.from(BUCKET).remove([doc.storage_path])
  await supabase.from('knowledge_base_documents').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('knowledge_base_documents')
    .select('*')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60 * 5)

  return NextResponse.json({ document: doc, url: signed?.signedUrl })
}
