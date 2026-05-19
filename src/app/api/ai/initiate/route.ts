import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateResponse, type ChatMessage } from '@/lib/ai/gemini-client'
import { sendText } from '@/lib/whatsapp/evolution-api'

export async function POST(request: Request) {
  try {
    const { contact_id, goal, channel = 'whatsapp' } = await request.json()

    if (!contact_id || !goal) {
      return NextResponse.json(
        { error: 'contact_id and goal are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Load contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .single()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (channel === 'whatsapp' && !contact.phone) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 }
      )
    }

    // Generate message
    const personaName = process.env.AI_PERSONA_NAME || 'Ana'
    const systemPrompt = `Você é ${personaName}, assistente do Lucas que administra uma empresa de locação de imóveis por temporada.
Inicie uma conversa com ${contact.name} (${contact.category}) com o seguinte objetivo: ${goal}.
${contact.relationship_description ? `Contexto do relacionamento: ${contact.relationship_description}` : ''}
Seja educada, profissional e direta. A mensagem será enviada via WhatsApp, então mantenha-a curta (máximo 3 frases).
NÃO use markdown. Use português brasileiro natural.`

    const messages: ChatMessage[] = [
      { role: 'user', content: `Gere a primeira mensagem para ${contact.name}. Objetivo: ${goal}` },
    ]

    const result = await generateResponse(systemPrompt, messages)

    // Reuse the most recent active conversation if one exists — avoid splitting
    // the history. Otherwise create a new one.
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('channel', channel)
      .in('status', ['active', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(1)

    let conversation = existing?.[0]
    if (!conversation) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          contact_id: contact.id,
          channel,
          status: 'active',
          summary: `Conversa iniciada com objetivo: ${goal}`,
        })
        .select()
        .single()
      conversation = newConv!
    }

    const nowIso = new Date().toISOString()

    // Save message
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      sender: 'ai',
      content: result.text,
      content_type: 'text',
      ai_model: process.env.AI_MODEL || 'gemini-2.5-flash',
      ai_tokens_in: result.tokensIn,
      ai_tokens_out: result.tokensOut,
    })

    // Bump last_message_at so the webhook routes the contact's reply to this conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: nowIso })
      .eq('id', conversation.id)

    // Send via WhatsApp
    if (channel === 'whatsapp' && contact.phone) {
      await sendText({ to: contact.phone, text: result.text })
    }

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'ai_initiate_conversation',
      actor: 'user',
      entity_type: 'conversation',
      entity_id: conversation.id,
      details: { contact_name: contact.name, goal, message_sent: result.text },
    })

    return NextResponse.json({
      conversation_id: conversation.id,
      message: result.text,
    })
  } catch (error) {
    console.error('AI initiate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
