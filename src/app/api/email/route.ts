import { NextRequest, NextResponse } from 'next/server'
import { listEmails, getUnreadCount } from '@/lib/email/gmail-client'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''
  const pageToken = request.nextUrl.searchParams.get('pageToken') || undefined
  const label = request.nextUrl.searchParams.get('label') || undefined
  const maxResults = Number(request.nextUrl.searchParams.get('maxResults')) || 20

  try {
    const [result, unreadCount] = await Promise.all([
      listEmails({
        query,
        pageToken,
        maxResults,
        labelIds: label ? [label] : undefined,
      }),
      getUnreadCount(),
    ])

    return NextResponse.json({ ...result, unreadCount })
  } catch (error) {
    console.error('Gmail list error:', error)
    return NextResponse.json({ error: 'Failed to list emails. Check Gmail connection.' }, { status: 500 })
  }
}
