import { NextRequest, NextResponse } from 'next/server'
import { getEmailThread, markAsRead } from '@/lib/email/gmail-client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params

  try {
    const messages = await getEmailThread(threadId)

    // Mark all as read
    for (const msg of messages) {
      if (!msg.isRead) {
        await markAsRead(msg.id).catch(() => {})
      }
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Gmail thread error:', error)
    return NextResponse.json({ error: 'Failed to get email thread' }, { status: 500 })
  }
}
