import { NextResponse } from 'next/server'
import { handleWhatsAppWebhook } from '@/lib/whatsapp/webhook-handler'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Log EVERY incoming POST to audit_log immediately — before any parsing or auth.
  // This lets us confirm whether Evolution API is reaching Vercel at all.
  const rawBody = await request.text()
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      action: 'webhook_hit',
      actor: 'evolution',
      entity_type: 'webhook',
      entity_id: 'whatsapp',
      details: {
        ts: new Date().toISOString(),
        body_preview: rawBody.slice(0, 500),
        headers: {
          'content-type': request.headers.get('content-type'),
          apikey: request.headers.get('apikey') ? '***' : null,
        },
      },
    })
  } catch (logErr) {
    console.error('[WEBHOOK] Failed to log hit:', logErr)
  }

  try {
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = request.headers.get('apikey') || request.headers.get('authorization')
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.error('[WEBHOOK] Invalid JSON body:', rawBody.slice(0, 200))
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
    console.log('[WEBHOOK] Received event:', payload.event)

    try {
      await handleWhatsAppWebhook(payload)
      console.log('[WEBHOOK] Handler completed')
    } catch (error) {
      console.error('[WEBHOOK] Handler error:', error)
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WEBHOOK] Parse error:', error)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
