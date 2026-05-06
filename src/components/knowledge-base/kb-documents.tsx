'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface KBDocument {
  id: string
  file_name: string
  file_type: string
  extracted_text: string | null
  created_at: string
}

export function KBDocuments({ kbEntryId }: { kbEntryId: string }) {
  const [docs, setDocs] = useState<KBDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [kbEntryId])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('knowledge_base_documents')
      .select('id, file_name, file_type, extracted_text, created_at')
      .eq('kb_entry_id', kbEntryId)
      .order('created_at', { ascending: false })
    setDocs((data || []) as KBDocument[])
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('kb_entry_id', kbEntryId)

    try {
      const res = await fetch('/api/kb/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no upload')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este documento?')) return
    await fetch(`/api/kb/documents/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleOpen(id: string) {
    const res = await fetch(`/api/kb/documents/${id}`)
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documentos anexados</CardTitle>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.txt,.md"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando e extraindo texto...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Anexar documento
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum documento. Envie PDF, imagens (JPG/PNG) ou arquivos de texto. A IA extrai o conteúdo automaticamente para usar nas respostas.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="rounded-md border">
                <div className="flex items-center gap-3 p-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}>
                    {expandedId === doc.id ? 'Ocultar texto' : 'Ver texto'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleOpen(doc.id)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {expandedId === doc.id && doc.extracted_text && (
                  <div className="border-t bg-muted/30 p-3">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{doc.extracted_text}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
