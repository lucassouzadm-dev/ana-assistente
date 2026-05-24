/**
 * GET /api/test/db
 * Returns the 5 most recent contacts and messages from the admin client.
 * Useful to verify webhook pipeline is writing to the database.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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

  const supabase = createAdminClient()

  const [contacts, messages, conversations] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, phone, category, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('messages')
      .select('id, direction, sender, content, content_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('conversations')
      .select('id, contact_id, channel, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    contacts: { data: contacts.data, error: contacts.error?.message },
    conversations: { data: conversations.data, error: conversations.error?.message },
    messages: { data: messages.data, error: messages.error?.message },
  })
}
