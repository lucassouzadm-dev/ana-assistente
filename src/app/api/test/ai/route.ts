/**
 * GET /api/test/ai
 * Diagnostic endpoint — tests each component of the AI pipeline.
 *
 * GET /api/test/ai?fix=webhook
 * Also checks and auto-fixes the Evolution API webhook URL if wrong.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateResponse } from '@/lib/ai/gemini-client'
import { sendText, getInstanceStatus, getWebhook, setWebhook } from '@/lib/whatsapp/evolution-api'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean
  message: string
  detail?: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const { searchParams } = new URL(request.url)

  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const querySecret = searchParams.get('secret')
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const fixWebhook = searchParams.get('fix') === 'webhook'
  const results: Record<string, CheckResult> = {}

  results.env_vars = checkEnvVars()
  results.supabase = await checkSupabase()
  results.gemini = await checkGemini()
  results.evolution_api = await checkEvolutionApi()
  results.webhook = await checkWebhook(fixWebhook)

  const allOk = Object.values(results).every((r) => r.ok)

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    model: process.env.AI_MODEL || 'gemini-2.5-flash (default)',
    checks: results,
  }, { status: allOk ? 200 : 500 })
}

function checkEnvVars(): CheckResult {
  const required = [
    'GOOGLE_AI_API_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE_NAME',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LUCAS_WHATSAPP_NUMBER',
  ]
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) return { ok: false, message: `Missing env vars: ${missing.join(', ')}` }
  return { ok: true, message: 'All required env vars present' }
}

async function checkSupabase(): Promise<CheckResult> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('contacts').select('id').limit(1)
    if (error) return { ok: false, message: 'Supabase query failed', detail: error.message }
    return { ok: true, message: 'Supabase connected and responding' }
  } catch (err) {
    return { ok: false, message: 'Supabase connection error', detail: String(err) }
  }
}

async function checkGemini(): Promise<CheckResult> {
  try {
    const result = await generateResponse(
      'Você é um assistente de teste. Responda apenas "OK" e nada mais.',
      [{ role: 'user', content: 'Teste de conectividade. Responda: OK' }]
    )
    if (!result.text) return { ok: false, message: 'Gemini returned empty response' }
    return {
      ok: true,
      message: `Gemini responded (${result.tokensIn} in / ${result.tokensOut} out tokens)`,
      detail: `Response: "${result.text.slice(0, 100)}"`,
    }
  } catch (err) {
    return { ok: false, message: 'Gemini API call failed', detail: String(err) }
  }
}

async function checkEvolutionApi(): Promise<CheckResult> {
  if (!process.env.EVOLUTION_API_URL) return { ok: false, message: 'EVOLUTION_API_URL not configured' }
  try {
    const status = await getInstanceStatus()
    if (status.error) return { ok: false, message: 'Evolution API error', detail: status.error }
    const state = status.instance?.state
    if (state === 'open') return { ok: true, message: 'WhatsApp instance connected', detail: `state: ${state}` }
    return {
      ok: false,
      message: `WhatsApp instance not connected (state: ${state || 'unknown'})`,
      detail: 'Re-scan QR code in Settings to reconnect.',
    }
  } catch (err) {
    return { ok: false, message: 'Evolution API unreachable', detail: String(err) }
  }
}

async function checkWebhook(fix: boolean): Promise<CheckResult> {
  const expectedUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    : 'https://ana-assistente.vercel.app/api/webhooks/whatsapp'

  const REQUIRED_EVENT = 'MESSAGES_UPSERT'

  try {
    const current = await getWebhook()
    if (current.error) return { ok: false, message: 'Could not read webhook config', detail: current.error }

    const currentUrl = current.url || ''
    const hasRequiredEvent = Array.isArray(current.events) && current.events.includes(REQUIRED_EVENT)
    const isCorrect = currentUrl === expectedUrl && current.enabled !== false && hasRequiredEvent

    if (isCorrect && !fix) {
      return {
        ok: true,
        message: 'Webhook configured correctly',
        detail: `URL: ${currentUrl} | events: ${(current.events || []).join(', ')}`,
      }
    }

    if (!fix) {
      return {
        ok: false,
        message: `Webhook incorreto: URL=${currentUrl === expectedUrl ? 'ok' : 'errada'}, enabled=${current.enabled}, MESSAGES_UPSERT=${hasRequiredEvent}`,
        detail: `events atual: [${(current.events || []).join(', ')}] | Acesse ?fix=webhook para corrigir`,
      }
    }

    // fix=true: always rewrite to ensure events list and all settings are correct
    const result = await setWebhook(expectedUrl)
    if (!result.ok) return { ok: false, message: 'Failed to update webhook', detail: result.error }

    // Read back to confirm events were actually saved
    const after = await getWebhook()
    const savedEvents = after.events || []
    const saved = savedEvents.includes(REQUIRED_EVENT)
    return {
      ok: saved,
      message: saved
        ? `Webhook reescrito com sucesso (era: "${currentUrl}")`
        : `Webhook escrito mas MESSAGES_UPSERT não consta nos eventos salvos`,
      detail: `events salvos: [${savedEvents.join(', ')}] | URL: ${expectedUrl}`,
    }
  } catch (err) {
    return { ok: false, message: 'Webhook check error', detail: String(err) }
  }
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    try {
      const body = await request.json()
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}` && body.secret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }
  }

  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return NextResponse.json({ error: 'LUCAS_WHATSAPP_NUMBER not configured' }, { status: 500 })

  try {
    await sendText({
      to: lucasPhone,
      text: `✅ *Teste de pipeline OK*\n\nAna está funcionando corretamente.\nHorário: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}`,
    })
    return NextResponse.json({ status: 'ok', message: 'Test message sent to Lucas' })
  } catch (err) {
    return NextResponse.json({ status: 'error', detail: String(err) }, { status: 500 })
  }
}
