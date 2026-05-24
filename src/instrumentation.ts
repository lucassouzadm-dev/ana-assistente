/**
 * instrumentation.ts — runs once when the Next.js server starts (cold start).
 *
 * Automatically registers the Evolution API webhook on every deployment,
 * so the webhook never silently goes missing after Evolution API restarts.
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge middleware)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Skip if Evolution API is not configured (local dev without env vars)
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    console.log('[INIT] Evolution API not configured, skipping webhook registration')
    return
  }

  try {
    const { setWebhook } = await import('./lib/whatsapp/evolution-api')

    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
      : 'https://ana-assistente.vercel.app/api/webhooks/whatsapp'

    const result = await setWebhook(webhookUrl)

    if (result.ok) {
      console.log('[INIT] Webhook registered successfully:', webhookUrl)
    } else {
      console.error('[INIT] Failed to register webhook:', result.error)
    }
  } catch (err) {
    // Never crash the server if webhook registration fails
    console.error('[INIT] Webhook registration error:', err)
  }
}
