/**
 * GET /api/cron/evolution-health
 *
 * Runs every 30 minutes via Vercel Cron.
 * Detects when the Evolution API webhook dispatch process has broken
 * (which happens after Railway container restarts) and auto-recovers:
 *
 *   1. Checks if Evolution API instance is connected (state: open)
 *   2. Checks the last webhook_hit in audit_log
 *   3. If no hits in THRESHOLD hours AND instance is open → BROKEN
 *   4. Fix: re-register webhook + restart Railway container
 *   5. Notify Lucas via WhatsApp
 *   6. Log to audit_log
 *
 * Configure threshold via EVOLUTION_HEALTH_THRESHOLD_HOURS (default: 4).
 * Set RAILWAY_API_TOKEN to enable automatic Railway container restart.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInstanceStatus, setWebhook } from '@/lib/whatsapp/evolution-api'
import { restartEvolutionApi } from '@/lib/railway/railway-api'
import { sendText } from '@/lib/whatsapp/evolution-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const THRESHOLD_HOURS = parseInt(process.env.EVOLUTION_HEALTH_THRESHOLD_HOURS || '4', 10)

export async function GET(request: Request) {
  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const querySecret = searchParams.get('secret')
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const now = new Date()
  const thresholdTime = new Date(now.getTime() - THRESHOLD_HOURS * 60 * 60 * 1000)

  // ── 1. Check last webhook hit ───────────────────────────────────────────────
  const { data: recentHits } = await supabase
    .from('audit_log')
    .select('id, created_at')
    .eq('action', 'webhook_hit')
    .gte('created_at', thresholdTime.toISOString())
    .limit(1)

  const hasRecentHit = (recentHits?.length ?? 0) > 0

  if (hasRecentHit) {
    // Webhooks are flowing — nothing to do
    return NextResponse.json({
      status: 'healthy',
      message: `Webhook received within last ${THRESHOLD_HOURS}h — no action needed`,
      timestamp: now.toISOString(),
    })
  }

  // No recent webhook hits — check if this is expected (first run, no messages ever)
  const { data: anyHit } = await supabase
    .from('audit_log')
    .select('id, created_at')
    .eq('action', 'webhook_hit')
    .order('created_at', { ascending: false })
    .limit(1)

  const lastHitAt = anyHit?.[0]?.created_at ?? null

  // ── 2. Check Evolution API instance status ──────────────────────────────────
  const status = await getInstanceStatus()
  const instanceState = status.instance?.state

  if (instanceState !== 'open') {
    // WhatsApp disconnected — different problem, needs QR scan — just notify
    await notifyLucas(
      `⚠️ *Ana - WhatsApp Desconectado*\n\nInstância Evolution API está com state: ${instanceState || 'unknown'}.\n\nAcesse o painel e re-escaneie o QR code.`
    )
    await logAudit(supabase, 'evolution_health_check', {
      result: 'whatsapp_disconnected',
      instance_state: instanceState,
      last_webhook_hit: lastHitAt,
    })
    return NextResponse.json({
      status: 'whatsapp_disconnected',
      message: `Instance state: ${instanceState} — Lucas notified`,
      timestamp: now.toISOString(),
    })
  }

  // Instance is open but no webhooks in THRESHOLD hours — webhook dispatch is broken
  console.log(
    `[HEALTH] No webhook_hit in ${THRESHOLD_HOURS}h, last hit: ${lastHitAt ?? 'never'}. Triggering auto-recovery.`
  )

  const actions: string[] = []
  const errors: string[] = []

  // ── 3. Re-register webhook ──────────────────────────────────────────────────
  const expectedUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    : 'https://ana-assistente.vercel.app/api/webhooks/whatsapp'

  const webhookResult = await setWebhook(expectedUrl)
  if (webhookResult.ok) {
    actions.push('webhook re-registered')
  } else {
    errors.push(`webhook re-register failed: ${webhookResult.error}`)
  }

  // ── 4. Restart Railway container ────────────────────────────────────────────
  const railwayResult = await restartEvolutionApi()
  if (railwayResult.ok) {
    actions.push('Railway container restarted')
  } else {
    errors.push(`Railway restart failed: ${railwayResult.error}`)
  }

  // ── 5. Notify Lucas ─────────────────────────────────────────────────────────
  const lastHitFormatted = lastHitAt
    ? new Date(lastHitAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })
    : 'nunca registrado'

  const notifyMsg = errors.length === 0
    ? `🔄 *Ana - Auto-Recuperação Executada*\n\nWebhook da Evolution API estava silencioso há mais de ${THRESHOLD_HOURS}h.\n\n✅ Ações: ${actions.join(', ')}\n\nÚltimo webhook: ${lastHitFormatted}\nAna deve responder normalmente em ~30 segundos.`
    : `⚠️ *Ana - Tentativa de Auto-Recuperação*\n\nWebhook silencioso há mais de ${THRESHOLD_HOURS}h.\n\n✅ ${actions.join(', ')}\n❌ Erros: ${errors.join('; ')}\n\nVerifique manualmente se necessário.`

  await notifyLucas(notifyMsg)

  // ── 6. Audit log ────────────────────────────────────────────────────────────
  await logAudit(supabase, 'evolution_health_recovery', {
    result: errors.length === 0 ? 'recovered' : 'partial_recovery',
    actions,
    errors,
    last_webhook_hit: lastHitAt,
    threshold_hours: THRESHOLD_HOURS,
    railway_token_present: !!process.env.RAILWAY_API_TOKEN,
  })

  return NextResponse.json({
    status: errors.length === 0 ? 'recovered' : 'partial_recovery',
    actions,
    errors,
    last_webhook_hit: lastHitAt,
    timestamp: now.toISOString(),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function notifyLucas(message: string) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return
  try {
    await sendText({ to: lucasPhone, text: message })
  } catch (err) {
    console.error('[HEALTH] Failed to notify Lucas:', err)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAudit(supabase: any, action: string, details: Record<string, unknown>) {
  try {
    await supabase.from('audit_log').insert({
      action,
      actor: 'cron',
      entity_type: 'service',
      entity_id: 'evolution-api',
      details,
    })
  } catch (err) {
    console.error('[HEALTH] Failed to write audit log:', err)
  }
}
