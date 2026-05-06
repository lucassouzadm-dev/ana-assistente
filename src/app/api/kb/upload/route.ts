import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getModel } from '@/lib/ai/gemini-client'

const BUCKET = 'kb-documents'
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

const SUPPORTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'text/plain',
  'text/markdown',
]

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8')
  }

  const model = getModel()
  const base64 = buffer.toString('base64')

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    },
    'Extraia todo o texto deste documento de forma estruturada e fiel ao original. Mantenha cabeçalhos, listas e tabelas em texto markdown. Não adicione comentários nem resumo — apenas o conteúdo extraído.',
  ])

  return result.response.text()
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kbEntryId = formData.get('kb_entry_id') as string | null

    if (!file || !kbEntryId) {
      return NextResponse.json({ error: 'file e kb_entry_id são obrigatórios' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo maior que 20MB' }, { status: 400 })
    }

    if (!SUPPORTED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Tipo não suportado: ${file.type}` }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: kbEntry } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('id', kbEntryId)
      .single()

    if (!kbEntry) {
      return NextResponse.json({ error: 'Entrada KB não encontrada' }, { status: 404 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${kbEntryId}/${timestamp}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Falha no upload: ${uploadError.message}` }, { status: 500 })
    }

    let extractedText = ''
    try {
      extractedText = await extractText(buffer, file.type)
    } catch (err) {
      console.error('Text extraction failed:', err)
      extractedText = '[Falha na extração automática de texto]'
    }

    const { data: doc, error: insertError } = await supabase
      .from('knowledge_base_documents')
      .insert({
        kb_entry_id: kbEntryId,
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
        extracted_text: extractedText,
      })
      .select()
      .single()

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ document: doc })
  } catch (error) {
    console.error('KB upload error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
