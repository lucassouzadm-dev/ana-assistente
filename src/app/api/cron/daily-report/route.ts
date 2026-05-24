import { NextResponse } from 'next/server'
import { generateDailyReport } from '@/lib/reports/daily-report'

export async function POST(request: Request) {
  // Validate cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await request.json().catch(() => ({}))
    const reportDate = (body as { date?: string }).date || undefined

    const summary = await generateDailyReport(reportDate)
    return NextResponse.json({ status: 'ok', summary })
  } catch (error) {
    console.error('Daily report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  // Vercel Cron Jobs send Authorization: Bearer <CRON_SECRET> automatically.
  // Query-string secrets are NOT supported (env vars are not interpolated in vercel.json paths).
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    // Accept both the Vercel-injected header and a manual ?secret= for local testing
    const { searchParams } = new URL(request.url)
    const querySecret = searchParams.get('secret')
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const summary = await generateDailyReport()
    return NextResponse.json({ status: 'ok', summary })
  } catch (error) {
    console.error('Daily report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
