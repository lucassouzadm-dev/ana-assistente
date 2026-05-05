import { NextResponse, after } from 'next/server'
import { handleWhatsAppWebhook } from '@/lib/whatsapp/webhook-handler'

export const maxDuration = 60

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

    after(async () => {
      try {
        await handleWhatsAppWebhook(payload)
        console.log('[WEBHOOK] Handler completed')
      } catch (error) {
        console.error('[WEBHOOK] Handler error:', error)
      }
    })

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[WEBHOOK] Parse error:', error)
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}
