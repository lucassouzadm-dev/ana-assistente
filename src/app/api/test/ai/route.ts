/**
 * GET /api/test/ai?secret=<CRON_SECRET>
 *
 * Diagnostic endpoint — tests each component of the AI pipeline and returns a
 * detailed report.  Restricted by CRON_SECRET so it is not publicly accessible.
 *
 * Returns a JSON object with a per-component status so you can see exactly
 * which piece is failing without needing to look at Vercel logs.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateResponse } from '@/lib/ai/gemini-client'
import { sendText } from '@/lib/whatsapp/evolution-api'
import { getInstanceStatus } from '@/lib/whatsapp/evolution-api'

export const dynamic = 'force-dynamic'

interface CheckResult {
  ok: boolean
  message: string
  detail?: string
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const { searchParams } = new URL(request.url)
    const authHeader = request.headers.get('authorization')
    const querySecret = searchParams.get('secret')
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const results: Record<string, CheckResult> = {}

  // 1. Environment variables
  const envCheck = checkEnvVars()
  results.env_vars = envCheck

  // 2. Supabase connectivity
  results.supabase = await checkSupabase()

  // 3. Gemini API
  results.gemini = await checkGemini()

  // 4. Evolution API (WhatsApp)
  results.evolution_api = await checkEvolutionApi()

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
  if (missing.length > 0) {
    return { ok: false, message: `Missing env vars: ${missing.join(', ')}` }
  }
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
  if (!process.env.EVOLUTION_API_URL) {
    return { ok: false, message: 'EVOLUTION_API_URL not configured' }
  }
  try {
    const status = await getInstanceStatus()
    if (status.error) return { ok: false, message: 'Evolution API error', detail: status.error }
    const state = status.instance?.state
    if (state === 'open') {
      return { ok: true, message: 'WhatsApp instance connected', detail: `state: ${state}` }
    }
    return {
      ok: false,
      message: `WhatsApp instance not connected (state: ${state || 'unknown'})`,
      detail: 'Re-scan QR code in Settings → WhatsApp to reconnect.',
    }
  } catch (err) {
    return { ok: false, message: 'Evolution API unreachable', detail: String(err) }
  }
}

/**
 * POST /api/test/ai
 * Sends a test WhatsApp message to Lucas to verify the full send pipeline.
 * Body: { secret: "<CRON_SECRET>" }
 */
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
  if (!lucasPhone) {
    return NextResponse.json({ error: 'LUCAS_WHATSAPP_NUMBER not configured' }, { status: 500 })
  }

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
