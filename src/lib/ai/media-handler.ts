import { GoogleGenerativeAI } from '@google/generative-ai'
import { sendText, sendMedia, forwardMediaToLucas } from '@/lib/whatsapp/evolution-api'
import { notifyLucasEscalation } from '@/lib/notifications/notify-lucas'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

async function fetchMediaAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = response.headers.get('content-type') || 'application/octet-stream'
    return { base64, mimeType }
  } catch {
    return null
  }
}

export async function transcribeAudio(mediaUrl: string): Promise<string | null> {
  const media = await fetchMediaAsBase64(mediaUrl)
  if (!media) return null

  try {
    const model = genAI.getGenerativeModel({ model: process.env.AI_MODEL || 'gemini-2.5-flash' })
    const result = await model.generateContent([
      { inlineData: { data: media.base64, mimeType: media.mimeType } },
      { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS a transcrição, sem comentários adicionais.' },
    ])
    return result.response.text().trim() || null
  } catch (error) {
    console.error('Audio transcription failed:', error)
    return null
  }
}

export async function describeImage(mediaUrl: string, caption?: string): Promise<string | null> {
  const media = await fetchMediaAsBase64(mediaUrl)
  if (!media) return null

  try {
    const model = genAI.getGenerativeModel({ model: process.env.AI_MODEL || 'gemini-2.5-flash' })
    const prompt = caption
      ? `Descreva esta imagem em português brasileiro. O remetente enviou com a legenda: "${caption}". Dê uma descrição objetiva do que a imagem mostra.`
      : 'Descreva esta imagem em português brasileiro de forma objetiva e concisa.'
    const result = await model.generateContent([
      { inlineData: { data: media.base64, mimeType: media.mimeType } },
      { text: prompt },
    ])
    return result.response.text().trim() || null
  } catch (error) {
    console.error('Image description failed:', error)
    return null
  }
}

export async function forwardMediaToLucasWithContext(params: {
  mediaUrl: string
  mediaType: 'image' | 'document' | 'audio'
  contactName: string
  contactCategory: string
  conversationId: string
  originalCaption?: string
}) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  await sendText({
    to: lucasPhone,
    text: `📎 *MÍDIA RECEBIDA*\n\nContato: ${params.contactName} (${params.contactCategory})\nTipo: ${params.mediaType === 'image' ? 'Imagem' : params.mediaType === 'audio' ? 'Áudio' : 'Documento'}${params.originalCaption ? `\nLegenda: "${params.originalCaption}"` : ''}\n\nNão consegui processar esta mídia. Encaminhando para você decidir.\n\n🔗 ${appUrl}/conversations/${params.conversationId}`,
  })

  try {
    await forwardMediaToLucas({
      to: lucasPhone,
      mediaUrl: params.mediaUrl,
      mediaType: params.mediaType,
      caption: `De: ${params.contactName}${params.originalCaption ? ` — "${params.originalCaption}"` : ''}`,
    })
  } catch (error) {
    console.error('Failed to forward media to Lucas:', error)
  }
}

export async function notifyLucasDoubt(params: {
  contactName: string
  contactCategory: string
  conversationId: string
  aiResponse: string
  triggeringMessage: string
}) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    await sendText({
      to: lucasPhone,
      text: `❓ *DÚVIDA DA ANA*\n\nContato: ${params.contactName} (${params.contactCategory})\n\nMensagem recebida:\n"${params.triggeringMessage}"\n\nAna respondeu:\n"${params.aiResponse}"\n\nAna não tem certeza desta resposta. Por favor, verifique e corrija se necessário.\n\n🔗 ${appUrl}/conversations/${params.conversationId}`,
    })
  } catch (error) {
    console.error('Failed to notify Lucas about doubt:', error)
  }
}
