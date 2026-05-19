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
    const isExistingConv = !!conversation

    // Load existing history so the AI knows whether to introduce herself
    let history: ChatMessage[] = []
    if (isExistingConv) {
      const { data: prevMsgs } = await supabase
        .from('messages')
        .select('direction, content')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(20)
      history = (prevMsgs || []).map((m) => ({
        role: (m.direction === 'inbound' ? 'user' : 'model') as 'user' | 'model',
        content: m.content as string,
      }))
    }
    const hasPriorAiMsg = history.some((m) => m.role === 'model')

    // Generate message
    const personaName = process.env.AI_PERSONA_NAME || 'Ana'
    const relCtx = contact.relationship_description ? `Contexto do relacionamento: ${contact.relationship_description}` : ''

    const systemPrompt = hasPriorAiMsg
      ? `Você é ${personaName}, assistente do Lucas (locação de imóveis por temporada).

Esta conversa JÁ EXISTE — você já interagiu com ${contact.name} antes (veja o histórico).

Agora o Lucas pediu para você mandar uma nova mensagem com este objetivo: ${goal}.
${relCtx}

REGRAS:
- NÃO se apresente novamente, NÃO diga "sou a Ana", "assistente do Lucas", "meu nome é Ana".
- NÃO comece com "Olá ${contact.name}" como se fosse a primeira interação.
- Vá DIRETO ao assunto do objetivo.
- Tom de continuidade, máximo 3 frases curtas, sem markdown.`
      : `Você é ${personaName}, assistente do Lucas que administra uma empresa de locação de imóveis por temporada.

Esta é a PRIMEIRA vez que você fala com ${contact.name} (${contact.category}). Apresente-se brevemente e vá ao objetivo: ${goal}.
${relCtx}

Seja educada, profissional e direta. Máximo 3 frases, sem markdown.`

    const messages: ChatMessage[] = [
      ...history,
      {
        role: 'user',
        content: hasPriorAiMsg
          ? `[Instrução interna do Lucas — não é mensagem do contato] Mande uma nova mensagem para ${contact.name} agora com este objetivo: ${goal}. Sem reapresentação, vá ao ponto.`
          : `Gere a primeira mensagem para ${contact.name}. Objetivo: ${goal}`,
      },
    ]

    const result = await generateResponse(systemPrompt, messages)
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
