export interface ParsedWhatsAppMessage {
  messageId: string
  from: string
  pushName: string | null
  content: string
  contentType: 'text' | 'image' | 'document' | 'audio' | 'location'
  mediaUrl: string | null
  timestamp: number
}

export function parseWebhookPayload(payload: Record<string, unknown>): ParsedWhatsAppMessage | null {
  const data = payload.data as Record<string, unknown> | undefined
  if (!data) return null

  const key = data.key as Record<string, unknown> | undefined
  if (!key || key.fromMe) return null

  const remoteJid = key.remoteJid as string
  if (!remoteJid || remoteJid.endsWith('@g.us')) return null

  const phone = remoteJid.replace('@s.whatsapp.net', '')
  const messageId = key.id as string
  const pushName = (data.pushName as string) || null
  const message = data.message as Record<string, unknown> | undefined

  if (!message) return null

  let content = ''
  let contentType: ParsedWhatsAppMessage['contentType'] = 'text'
  let mediaUrl: string | null = null

  if (message.conversation) {
    content = message.conversation as string
  } else if (message.extendedTextMessage) {
    content = (message.extendedTextMessage as Record<string, unknown>).text as string
  } else if (message.imageMessage) {
    contentType = 'image'
    content = (message.imageMessage as Record<string, unknown>).caption as string || '[Imagem]'
    mediaUrl = (message.imageMessage as Record<string, unknown>).url as string || null
  } else if (message.documentMessage) {
    contentType = 'document'
    content = (message.documentMessage as Record<string, unknown>).fileName as string || '[Documento]'
    mediaUrl = (message.documentMessage as Record<string, unknown>).url as string || null
  } else if (message.audioMessage) {
    contentType = 'audio'
    content = '[Áudio]'
    mediaUrl = (message.audioMessage as Record<string, unknown>).url as string || null
  } else if (message.locationMessage) {
    contentType = 'location'
    const loc = message.locationMessage as Record<string, unknown>
    content = `[Localização: ${loc.degreesLatitude}, ${loc.degreesLongitude}]`
  } else {
    return null
  }

  return {
    messageId,
    from: phone.startsWith('55') ? `+${phone}` : `+55${phone}`,
    pushName,
    content,
    contentType,
    mediaUrl,
    timestamp: (data.messageTimestamp as number) || Math.floor(Date.now() / 1000),
  }
}
