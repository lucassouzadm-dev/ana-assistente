import { createAdminClient } from '@/lib/supabase/admin'
import { parseWebhookPayload } from './message-parser'
import { sendText } from './evolution-api'
import { loadConversationContext } from '@/lib/ai/context-loader'
import { buildSystemPrompt, buildCommandPrompt } from '@/lib/ai/prompt-builder'
import { generateResponse, type ChatMessage } from '@/lib/ai/gemini-client'
import { checkEscalationRules, checkAIResponseForEscalation } from '@/lib/ai/escalation-checker'
import { notifyLucasEscalation } from '@/lib/notifications/notify-lucas'
import { handleLucasCommand } from '@/lib/ai/command-handler'
import { transcribeAudio, describeImage, forwardMediaToLucasWithContext, notifyLucasDoubt } from '@/lib/ai/media-handler'

export async function handleWhatsAppWebhook(payload: Record<string, unknown>) {
  const event = (payload.event as string || '').toLowerCase().replace(/_/g, '.')
  console.log('[WH] raw event:', payload.event, '→ normalized:', event)
  console.log('[WH] payload keys:', Object.keys(payload))
  if (event !== 'messages.upsert') return

  const parsed = parseWebhookPayload(payload)
  console.log('[WH] parsed:', parsed ? { from: parsed.from, content: parsed.content?.slice(0, 50), messageId: parsed.messageId } : null)
  if (!parsed) return

  const supabase = createAdminClient()
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  console.log('[WH] lucasPhone:', lucasPhone, 'senderPhone:', parsed.from)

  // Dedup
  const { data: existing, error: dedupError } = await supabase
    .from('messages')
    .select('id')
    .eq('channel_message_id', parsed.messageId)
    .single()
  console.log('[WH] dedup:', existing ? 'DUPLICATE' : 'NEW', dedupError?.code)
  if (existing) return

  // Check if sender is Lucas
  if (lucasPhone && parsed.from === lucasPhone) {
    console.log('[WH] Lucas command detected')
    await handleLucasCommand(parsed.content, parsed.messageId)
    return
  }

  // Find or create contact
  let { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', parsed.from)
    .single()
  console.log('[WH] contact lookup:', contact?.id || 'NOT FOUND', contactErr?.code)

  if (!contact) {
    const { data: newContact, error: insertErr } = await supabase
      .from('contacts')
      .insert({
        name: parsed.pushName || 'Desconhecido',
        phone: parsed.from,
        category: 'unknown',
        qualification_status: 'pending',
      })
      .select()
      .single()
    console.log('[WH] contact created:', newContact?.id, insertErr?.message)
    contact = newContact!
  }

  // Find or create conversation
  let { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('channel', 'whatsapp')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  console.log('[WH] conversation lookup:', conversation?.id || 'NOT FOUND', convErr?.code)

  if (!conversation) {
    const { data: newConv, error: convInsertErr } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        channel: 'whatsapp',
        status: 'active',
      })
      .select()
      .single()
    console.log('[WH] conversation created:', newConv?.id, convInsertErr?.message)
    conversation = newConv!
  }

  // Process media content (audio/image) before saving
  let processedContent = parsed.content
  let mediaProcessed = false

  if (parsed.contentType === 'audio' && parsed.mediaUrl) {
    const transcription = await transcribeAudio(parsed.mediaUrl)
    if (transcription) {
      processedContent = `[Áudio transcrito]: ${transcription}`
      mediaProcessed = true
    } else {
      processedContent = '[Áudio não transcrito]'
      await forwardMediaToLucasWithContext({
        mediaUrl: parsed.mediaUrl,
        mediaType: 'audio',
        contactName: contact.name,
        contactCategory: contact.category,
        conversationId: conversation.id,
      })
    }
  } else if (parsed.contentType === 'image' && parsed.mediaUrl) {
    const description = await describeImage(parsed.mediaUrl, parsed.content !== '[Imagem]' ? parsed.content : undefined)
    if (description) {
      const caption = parsed.content !== '[Imagem]' ? parsed.content : ''
      processedContent = `[Imagem recebida${caption ? ` com legenda: "${caption}"` : ''}. Descrição: ${description}]`
      mediaProcessed = true
    } else {
      processedContent = parsed.content
      await forwardMediaToLucasWithContext({
        mediaUrl: parsed.mediaUrl,
        mediaType: 'image',
        contactName: contact.name,
        contactCategory: contact.category,
        conversationId: conversation.id,
        originalCaption: parsed.content !== '[Imagem]' ? parsed.content : undefined,
      })
    }
  } else if (parsed.contentType === 'document' && parsed.mediaUrl) {
    await forwardMediaToLucasWithContext({
      mediaUrl: parsed.mediaUrl,
      mediaType: 'document',
      contactName: contact.name,
      contactCategory: contact.category,
      conversationId: conversation.id,
      originalCaption: parsed.content,
    })
  }

  // Save inbound message
  console.log('[WH] saving inbound message...')
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    direction: 'inbound',
    sender: 'contact',
    content: processedContent,
    content_type: parsed.contentType,
    media_url: parsed.mediaUrl,
    channel_message_id: parsed.messageId,
  })
  console.log('[WH] message saved:', msgErr?.message || 'OK')

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)
  console.log('[WH] conversation updated')

  // Pre-AI escalation check
  console.log('[WH] checking escalation rules...')
  const escalation = await checkEscalationRules(processedContent, contact.category)
  console.log('[WH] escalation result:', escalation)

  if (escalation.shouldEscalate && escalation.action === 'block') {
    await notifyLucasEscalation({
      contactName: contact.name,
      contactCategory: contact.category,
      triggeringMessage: processedContent,
      ruleName: escalation.ruleName!,
      conversationId: conversation.id,
    })
    return
  }

  if (escalation.shouldEscalate && escalation.action === 'escalate') {
    const response = escalation.responseTemplate ||
      'Vou pedir para o Lucas entrar em contato com você sobre isso. Ele retornará em breve!'

    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      direction: 'outbound',
      sender: 'ai',
      content: response,
      content_type: 'text',
      ai_model: 'rule-based',
    })

    await supabase
      .from('conversations')
      .update({ status: 'escalated' })
      .eq('id', conversation.id)

    await sendText({ to: parsed.from, text: response })

    await notifyLucasEscalation({
      contactName: contact.name,
      contactCategory: contact.category,
      triggeringMessage: processedContent,
      ruleName: escalation.ruleName!,
      conversationId: conversation.id,
    })

    await logAudit('escalation', 'ai', 'conversation', conversation.id, {
      rule: escalation.ruleName,
      contact_name: contact.name,
    })
    return
  }

  // Load context and generate AI response
  console.log('[WH] loading context...')
  const context = await loadConversationContext(contact.id, conversation.id)
  console.log('[WH] context loaded, building prompt...')
  const systemPrompt = buildSystemPrompt(context)

  const messages: ChatMessage[] = [
    ...context.recentMessages,
    { role: 'user', content: processedContent },
  ]

  console.log('[WH] generating AI response...')
  const aiResult = await generateResponse(systemPrompt, messages)
  console.log('[WH] AI response:', aiResult.text?.slice(0, 80), 'tokens:', aiResult.tokensIn, aiResult.tokensOut)

  // Save AI response FIRST — this must succeed for conversation history to work
  const { error: saveErr } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    direction: 'outbound',
    sender: 'ai',
    content: aiResult.text,
    content_type: 'text',
    ai_model: process.env.AI_MODEL || 'gemini-2.5-flash',
    ai_tokens_in: aiResult.tokensIn,
    ai_tokens_out: aiResult.tokensOut,
  })
  console.log('[WH] AI response saved:', saveErr?.message || 'OK')

  // Send response via WhatsApp
  await sendText({ to: parsed.from, text: aiResult.text })
  console.log('[WH] WhatsApp reply sent')

  // Notifications and audit — non-critical, wrapped in try/catch
  try {
    const aiEscalated = checkAIResponseForEscalation(aiResult.text)
    if (aiEscalated || (escalation.shouldEscalate && escalation.action === 'notify')) {
      await notifyLucasEscalation({
        contactName: contact.name,
        contactCategory: contact.category,
        triggeringMessage: processedContent,
        ruleName: escalation.ruleName || 'AI self-escalation',
        conversationId: conversation.id,
      })
    }

    if (aiResult.hasDoubt) {
      await notifyLucasDoubt({
        contactName: contact.name,
        contactCategory: contact.category,
        conversationId: conversation.id,
        aiResponse: aiResult.text,
        triggeringMessage: processedContent,
      })
    }

    await logAudit('ai_response', 'ai', 'conversation', conversation.id, {
      contact_name: contact.name,
      tokens_in: aiResult.tokensIn,
      tokens_out: aiResult.tokensOut,
      media_processed: mediaProcessed ? parsed.contentType : null,
      had_doubt: aiResult.hasDoubt,
    })
  } catch (notifyErr) {
    console.error('[WH] notification/audit error (non-critical):', notifyErr)
  }
}

async function logAudit(
  action: string,
  actor: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown>
) {
  const supabase = createAdminClient()
  await supabase.from('audit_log').insert({
    action,
    actor,
    entity_type: entityType,
    entity_id: entityId,
    details,
  })
}
