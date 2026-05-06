import { createAdminClient } from '@/lib/supabase/admin'

export interface ConversationContext {
  contact: {
    id: string
    name: string
    phone: string | null
    category: string
    relationship_description: string | null
    qualification_status: string
  }
  conversationSummary: string | null
  keyFacts: unknown[]
  recentMessages: { role: 'user' | 'model'; content: string }[]
  knowledgeBase: { title: string; content: string }[]
  activeReservations: { property: string; check_in: string; check_out: string; guest: string; status: string }[]
  pendingTasks: { title: string; property: string | null; status: string; due_date: string | null }[]
  properties: { name: string; description: string | null; amenities: unknown[]; rules: string | null }[]
}

export async function loadConversationContext(
  contactId: string,
  conversationId?: string
): Promise<ConversationContext> {
  const supabase = createAdminClient()

  const [contactRes, summaryRes, messagesRes, kbRes, reservationsRes, tasksRes, propertiesRes] =
    await Promise.all([
      supabase.from('contacts').select('*').eq('id', contactId).single(),
      supabase.from('conversation_summaries').select('*').eq('contact_id', contactId).single(),
      conversationId
        ? supabase
            .from('messages')
            .select('direction, sender, content')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      supabase
        .from('knowledge_base')
        .select('title, content, priority, knowledge_base_documents(file_name, extracted_text)')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(10),
      supabase
        .from('reservations')
        .select('*, properties:property_id(name)')
        .or(`guest_contact_id.eq.${contactId}`)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .limit(5),
      supabase
        .from('tasks')
        .select('title, status, due_date, properties:property_id(name)')
        .eq('assigned_contact_id', contactId)
        .in('status', ['pending', 'in_progress', 'waiting'])
        .limit(5),
      supabase.from('properties').select('name, description, amenities, rules').eq('status', 'active'),
    ])

  const contact = contactRes.data!
  const messages = ((messagesRes as { data: unknown[] | null }).data || []).reverse()

  const recentMessages = (messages as { direction: string; sender: string; content: string }[]).map((m) => ({
    role: (m.direction === 'inbound' ? 'user' : 'model') as 'user' | 'model',
    content: m.content,
  }))

  const knowledgeBase = (kbRes.data || []).map((kb: Record<string, unknown>) => {
    const docs = (kb.knowledge_base_documents as { file_name: string; extracted_text: string | null }[] | null) || []
    const docsText = docs
      .filter((d) => d.extracted_text)
      .map((d) => `[Anexo: ${d.file_name}]\n${d.extracted_text}`)
      .join('\n\n')
    return {
      title: kb.title as string,
      content: docsText ? `${kb.content}\n\n${docsText}` : (kb.content as string),
    }
  })

  const activeReservations = (reservationsRes.data || []).map((r: Record<string, unknown>) => ({
    property: ((r.properties as { name: string }) || { name: 'N/A' }).name,
    check_in: r.check_in as string,
    check_out: r.check_out as string,
    guest: r.guest_name as string,
    status: r.status as string,
  }))

  const pendingTasks = (tasksRes.data || []).map((t: Record<string, unknown>) => ({
    title: t.title as string,
    property: ((t.properties as { name: string }) || null)?.name || null,
    status: t.status as string,
    due_date: t.due_date as string | null,
  }))

  const properties = (propertiesRes.data || []).map((p: Record<string, unknown>) => ({
    name: p.name as string,
    description: p.description as string | null,
    amenities: p.amenities as unknown[],
    rules: p.rules as string | null,
  }))

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      category: contact.category,
      relationship_description: contact.relationship_description,
      qualification_status: contact.qualification_status,
    },
    conversationSummary: summaryRes.data?.summary || null,
    keyFacts: summaryRes.data?.key_facts || [],
    recentMessages,
    knowledgeBase,
    activeReservations,
    pendingTasks,
    properties,
  }
}
