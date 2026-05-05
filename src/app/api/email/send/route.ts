import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/gmail-client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, body: emailBody, threadId, inReplyTo, references } = body

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: 'to, subject, and body are required' }, { status: 400 })
    }

    const messageId = await sendEmail({ to, subject, body: emailBody, threadId, inReplyTo, references })

    // Log to audit
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      action: 'email_sent',
      actor: 'user',
      entity_type: 'email',
      entity_id: messageId,
      details: { to, subject, thread_id: threadId || null },
    })

    return NextResponse.json({ id: messageId })
  } catch (error) {
    console.error('Gmail send error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
