import { NextResponse } from 'next/server'
import { handleWhatsAppWebhook } from '@/lib/whatsapp/webhook-handler'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET
    if (webhookSecret) {
      const authHeader = request.headers.get('apikey') || request.headers.get('authorization')
      if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const payload = await request.json()
    console.log('[WEBHOOK] Received event:', payload.event)

    // Process synchronously within maxDuration = 60s.
    // Evolution API retries on non-2xx, so we must return 200 quickly.
    // We respond 200 first, then process — but since after() requires Vercel Pro
    // for reliable background execution, we process inline and rely on the 60s timeout.
    try {
      await handleWhatsAppWebhook(payload)
      console.log('[WEBHOOK] Handler completed')
    } catch (error) {
      console.error('[WEBHOOK] Handler error:', error)
      // Still return 200 to prevent Evolution API retry loops
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
