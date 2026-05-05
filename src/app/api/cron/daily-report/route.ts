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
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
