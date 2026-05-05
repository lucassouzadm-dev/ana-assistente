import { NextRequest, NextResponse } from 'next/server'
import { getEmailThread, sendEmail } from '@/lib/email/gmail-client'
import { generateResponse, type ChatMessage } from '@/lib/ai/gemini-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadEmailContext } from '@/lib/email/email-context'
import { notifyLucasDoubt } from '@/lib/ai/media-handler'

export async function POST(request: NextRequest) {
  try {
    const { threadId, instruction } = await request.json()

    if (!threadId) {
      return NextResponse.json({ error: 'threadId is required' }, { status: 400 })
    }

    const messages = await getEmailThread(threadId)
    if (!messages.length) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const lastMessage = messages[messages.length - 1]
    const context = await loadEmailContext(lastMessage.from)

    const systemPrompt = buildEmailSystemPrompt(context, instruction)

    const chatMessages: ChatMessage[] = messages.map((msg) => ({
      role: (msg.from === process.env.EMAIL_FROM ? 'model' : 'user') as 'user' | 'model',
      content: `De: ${msg.fromName} <${msg.from}>\nAssunto: ${msg.subject}\nData: ${msg.date}\n\n${msg.body}`,
    }))

    // Ensure last message is from user (the email we're replying to)
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'model') {
      chatMessages.push({ role: 'user', content: instruction || 'Responda este email de forma adequada.' })
    }

    const aiResult = await generateResponse(systemPrompt, chatMessages)

    // Send the reply
    const sentId = await sendEmail({
      to: lastMessage.from,
      subject: lastMessage.subject.startsWith('Re:') ? lastMessage.subject : `Re: ${lastMessage.subject}`,
      body: aiResult.text,
      threadId,
      inReplyTo: lastMessage.id,
    })

    // Doubt detection
    if (aiResult.hasDoubt) {
      await notifyLucasDoubt({
        contactName: lastMessage.fromName,
        contactCategory: 'email',
        conversationId: threadId,
        aiResponse: aiResult.text,
        triggeringMessage: lastMessage.body.substring(0, 500),
      })
    }

    // Audit log
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      action: 'email_ai_reply',
      actor: 'ai',
      entity_type: 'email',
      entity_id: sentId,
      details: {
        thread_id: threadId,
        to: lastMessage.from,
        subject: lastMessage.subject,
        tokens_in: aiResult.tokensIn,
        tokens_out: aiResult.tokensOut,
        had_doubt: aiResult.hasDoubt,
      },
    })

    return NextResponse.json({ id: sentId, text: aiResult.text })
  } catch (error) {
    console.error('AI reply error:', error)
    return NextResponse.json({ error: 'Failed to generate AI reply' }, { status: 500 })
  }
}

function buildEmailSystemPrompt(context: { contactInfo?: string; knowledgeBase: string[] }, instruction?: string): string {
  const persona = process.env.AI_PERSONA_NAME || 'Ana'
  const parts = [
    `Você é ${persona}, assistente profissional do Lucas que administra uma empresa de locação de imóveis por temporada na Bahia.`,
    `Você está respondendo um e-mail em nome do Lucas, assinando como "${persona} - Assistente do Lucas".`,
    '',
    '## REGRAS',
    '- Responda em português brasileiro, de forma profissional e cordial',
    '- Use uma linguagem mais formal que no WhatsApp (é e-mail)',
    '- NUNCA faça compromissos financeiros, promessas de disponibilidade ou acordos sem verificar com o Lucas',
    '- Se não souber a resposta, diga "Vou verificar com o Lucas e retorno em breve"',
    '- Mantenha a resposta concisa mas completa',
    `- Assine: "${persona}\\nAssistente do Lucas\\n${process.env.EMAIL_FROM_NAME || 'Ana - Assistente do Lucas'}"`,
  ]

  if (context.contactInfo) {
    parts.push('', '## CONTEXTO DO CONTATO', context.contactInfo)
  }

  if (context.knowledgeBase.length > 0) {
    parts.push('', '## BASE DE CONHECIMENTO')
    context.knowledgeBase.forEach((kb) => parts.push(kb))
  }

  if (instruction) {
    parts.push('', '## INSTRUÇÃO ESPECÍFICA', instruction)
  }

  return parts.join('\n')
}
