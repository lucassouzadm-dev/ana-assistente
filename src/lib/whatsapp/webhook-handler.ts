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
import { phonesMatch } from '@/lib/utils/phone'

const FALLBACK_RESPONSE = 'Olá! Recebi sua mensagem, mas estou com uma instabilidade momentânea. Por favor, tente novamente em alguns minutos. 🙏'

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

  // Check if sender is Lucas (handles BR mobile 9-digit vs 12-digit legacy format)
  if (phonesMatch(lucasPhone, parsed.from)) {
    console.log('[WH] Lucas command detected')
    try {
      await handleLucasCommand(parsed.content, parsed.messageId)
    } catch (lucasErr) {
      console.error('[WH] Lucas command error:', lucasErr)
      const errMsg = lucasErr instanceof Error ? lucasErr.message : String(lucasErr)
      await notifyLucasError(`Erro ao processar seu comando: ${errMsg}`)
    }
    return
  }

  // ── Non-Lucas message flow ────────────────────────────────────────────────
  // Contact + conversation lookup
  const { data: candidatesList } = await supabase
    .from('contacts')
    .select('*')
    .not('phone', 'is', null)
    .eq('is_active', true)
  const matchingContacts = (candidatesList || []).filter((c) => phonesMatch(c.phone, parsed.from))

  let contact = null as null | typeof matchingContacts[number]
  type ConversationRow = { id: string; contact_id: string; channel: string; status: string; [k: string]: unknown }
  let conversation = null as ConversationRow | null

  if (matchingContacts.length > 0) {
    const ids = matchingContacts.map((c) => c.id)
    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('*')
      .in('contact_id', ids)
      .eq('channel', 'whatsapp')
      .in('status', ['active', 'escalated'])
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
    if (existingConvs && existingConvs.length > 0) {
      conversation = existingConvs[0]
      contact = matchingContacts.find((c) => c.id === conversation!.contact_id) || matchingContacts[0]
    } else {
      contact = matchingContacts.sort((a, b) =>
        (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
      )[0]
    }
  }
  console.log('[WH] contact lookup:', contact?.id || 'NOT FOUND', 'from:', parsed.from,
    'matches:', matchingContacts.length, 'reused conv:', conversation?.id || 'no')

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
  if (!conversation) {
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('channel', 'whatsapp')
      .in('status', ['active', 'escalated'])
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
    conversation = existingConv?.[0] || null
  }
  console.log('[WH] conversation lookup:', conversation?.id || 'NOT FOUND')

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
  if (!conversation) throw new Error('Failed to create conversation')
  const conv = conversation

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
        conversationId: conv.id,
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
        conversationId: conv.id,
        originalCaption: parsed.content !== '[Imagem]' ? parsed.content : undefined,
      })
    }
  } else if (parsed.contentType === 'document' && parsed.mediaUrl) {
    await forwardMediaToLucasWithContext({
      mediaUrl: parsed.mediaUrl,
      mediaType: 'document',
      contactName: contact.name,
      contactCategory: contact.category,
      conversationId: conv.id,
      originalCaption: parsed.content,
    })
  }

  // Save inbound message
  console.log('[WH] saving inbound message...')
  const { error: msgErr } = await supabase.from('messages').insert({
    conversation_id: conv.id,
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
    .eq('id', conv.id)

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
      conversationId: conv.id,
    })
    return
  }

  if (escalation.shouldEscalate && escalation.action === 'escalate') {
    const response = escalation.responseTemplate ||
      'Vou pedir para o Lucas entrar em contato com você sobre isso. Ele retornará em breve!'

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      sender: 'ai',
      content: response,
      content_type: 'text',
      ai_model: 'rule-based',
    })
    await supabase.from('conversations').update({ status: 'escalated' }).eq('id', conv.id)
    await sendText({ to: parsed.from, text: response })
    await notifyLucasEscalation({
      contactName: contact.name,
      contactCategory: contact.category,
      triggeringMessage: processedContent,
      ruleName: escalation.ruleName!,
      conversationId: conv.id,
    })
    await logAudit('escalation', 'ai', 'conversation', conv.id, {
      rule: escalation.ruleName,
      contact_name: contact.name,
    })
    return
  }

  // Load context and generate AI response
  console.log('[WH] loading context...')
  const context = await loadConversationContext(contact.id, conv.id)
  console.log('[WH] context loaded, building prompt...')
  const systemPrompt = buildSystemPrompt(context)

  const messages: ChatMessage[] = [
    ...context.recentMessages,
    { role: 'user', content: processedContent },
  ]

  // Generate AI response — with fallback if the model call fails
  console.log('[WH] generating AI response...')
  let aiText: string
  let aiTokensIn = 0
  let aiTokensOut = 0
  let aiHasDoubt = false
  let aiModelUsed = process.env.AI_MODEL || 'gemini-2.5-flash'

  try {
    const aiResult = await generateResponse(systemPrompt, messages)
    aiText = aiResult.text
    aiTokensIn = aiResult.tokensIn
    aiTokensOut = aiResult.tokensOut
    aiHasDoubt = aiResult.hasDoubt || false
    console.log('[WH] AI response:', aiText?.slice(0, 80), 'tokens:', aiTokensIn, aiTokensOut)
  } catch (aiErr) {
    // AI call failed — log the error, notify Lucas, send fallback to user
    const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr)
    console.error('[WH] AI generation failed:', errMsg)

    // Notify Lucas about the AI failure
    await notifyLucasError(
      `⚠️ Falha na IA ao responder ${contact.name}:\n"${processedContent.slice(0, 100)}"\n\nErro: ${errMsg.slice(0, 200)}`
    )

    // Save the error to audit log
    await logAudit('ai_error', 'ai', 'conversation', conv.id, {
      contact_name: contact.name,
      error: errMsg,
      message: processedContent.slice(0, 500),
    })

    // Send fallback message to user so they're not ignored
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      sender: 'ai',
      content: FALLBACK_RESPONSE,
      content_type: 'text',
      ai_model: 'fallback',
    })
    await sendText({ to: parsed.from, text: FALLBACK_RESPONSE })
    return
  }

  // Save AI response
  const { error: saveErr } = await supabase.from('messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    sender: 'ai',
    content: aiText,
    content_type: 'text',
    ai_model: aiModelUsed,
    ai_tokens_in: aiTokensIn,
    ai_tokens_out: aiTokensOut,
  })
  console.log('[WH] AI response saved:', saveErr?.message || 'OK')

  // Send response via WhatsApp
  try {
    await sendText({ to: parsed.from, text: aiText })
    console.log('[WH] WhatsApp reply sent')
  } catch (sendErr) {
    const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr)
    console.error('[WH] sendText failed:', errMsg)
    await notifyLucasError(
      `⚠️ Falha ao enviar resposta para ${contact.name} (${parsed.from}):\nErro Evolution API: ${errMsg.slice(0, 200)}`
    )
    return
  }

  // Notifications and audit — non-critical
  try {
    const aiEscalated = checkAIResponseForEscalation(aiText)
    if (aiEscalated || (escalation.shouldEscalate && escalation.action === 'notify')) {
      await notifyLucasEscalation({
        contactName: contact.name,
        contactCategory: contact.category,
        triggeringMessage: processedContent,
        ruleName: escalation.ruleName || 'AI self-escalation',
        conversationId: conv.id,
      })
    }

    if (aiHasDoubt) {
      await notifyLucasDoubt({
        contactName: contact.name,
        contactCategory: contact.category,
        conversationId: conv.id,
        aiResponse: aiText,
        triggeringMessage: processedContent,
      })
    }

    await logAudit('ai_response', 'ai', 'conversation', conv.id, {
      contact_name: contact.name,
      tokens_in: aiTokensIn,
      tokens_out: aiTokensOut,
      media_processed: mediaProcessed ? parsed.contentType : null,
      had_doubt: aiHasDoubt,
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

/**
 * Send a critical error alert directly to Lucas via WhatsApp.
 * Fails silently — we don't want an error in error-handling to cause a loop.
 */
async function notifyLucasError(message: string) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return
  try {
    await sendText({ to: lucasPhone, text: `🚨 *ERRO ANA*\n\n${message}` })
  } catch {
    console.error('[WH] Failed to notify Lucas about error (Evolution API unreachable)')
  }
}
