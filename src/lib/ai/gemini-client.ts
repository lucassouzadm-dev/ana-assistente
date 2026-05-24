import { GoogleGenerativeAI, type GenerativeModel, type Content } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// Primary model — controlled via AI_MODEL env var.
// Google frequently renames/versions models; update this env var on Vercel
// when the active model name changes (e.g. gemini-2.5-flash-preview-05-20).
const DEFAULT_MODEL = 'gemini-2.5-flash'

export function getModel(modelName?: string): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelName || process.env.AI_MODEL || DEFAULT_MODEL,
  })
}

export interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export async function generateResponse(
  systemPrompt: string,
  messages: ChatMessage[],
  tools?: unknown[]
): Promise<{ text: string; tokensIn: number; tokensOut: number; functionCalls?: unknown[]; hasDoubt?: boolean }> {
  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY is not configured — set this env var on Vercel.')
  }

  const model = getModel()

  // Gemini requires history to start with role 'user'. If the first messages are
  // 'model' (e.g., AI initiated the conversation), prepend a synthetic user turn
  // that preserves the AI's opening message in the history — otherwise the model
  // forgets it spoke first and re-greets the contact.
  const normalized: ChatMessage[] = messages.slice()
  if (normalized.length > 0 && normalized[0].role === 'model') {
    normalized.unshift({
      role: 'user',
      content: '[Sistema: Você iniciou esta conversa enviando a próxima mensagem por instrução do Lucas. Continue de onde parou — não se reapresente.]',
    })
  }

  const history: Content[] = normalized.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }))

  const lastMessage = normalized[normalized.length - 1]

  const chat = model.startChat({
    history,
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    ...(tools && tools.length > 0 ? { tools: tools as never[] } : {}),
  })

  let result
  try {
    result = await chat.sendMessage(lastMessage.content)
  } catch (err: unknown) {
    // Provide richer error context for common Gemini failure modes
    const errMsg = err instanceof Error ? err.message : String(err)
    const model_name = process.env.AI_MODEL || DEFAULT_MODEL
    if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.toLowerCase().includes('model')) {
      throw new Error(
        `Gemini model "${model_name}" not found or deprecated. ` +
        `Update the AI_MODEL env var on Vercel to a valid model name ` +
        `(e.g. gemini-2.0-flash or gemini-2.5-flash-latest). Original: ${errMsg}`
      )
    }
    if (errMsg.includes('401') || errMsg.includes('403') || errMsg.toLowerCase().includes('api key')) {
      throw new Error(
        `Gemini API authentication failed — check GOOGLE_AI_API_KEY on Vercel. Original: ${errMsg}`
      )
    }
    if (errMsg.includes('429') || errMsg.toLowerCase().includes('quota')) {
      throw new Error(
        `Gemini API quota/rate limit exceeded. Original: ${errMsg}`
      )
    }
    throw err
  }

  const response = result.response

  let text: string
  try {
    text = response.text()
  } catch (textErr) {
    // response.text() throws when the response was blocked by safety filters
    const finishReason = response.candidates?.[0]?.finishReason
    throw new Error(
      `Gemini response blocked (finishReason: ${finishReason}). ` +
      `Safety filters may have been triggered by the message content.`
    )
  }

  const usage = response.usageMetadata

  const functionCalls = response.candidates?.[0]?.content?.parts
    ?.filter((p) => 'functionCall' in p)
    ?.map((p) => (p as { functionCall: unknown }).functionCall)

  const hasDoubt = detectDoubt(text)

  return {
    text,
    tokensIn: usage?.promptTokenCount || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
    functionCalls: functionCalls?.length ? functionCalls : undefined,
    hasDoubt,
  }
}

function detectDoubt(text: string): boolean {
  const doubtMarkers = [
    'vou verificar com o lucas',
    'preciso verificar com o lucas',
    'vou confirmar com o lucas',
    'preciso confirmar com o lucas',
    'lucas entrará em contato',
    'lucas vai entrar em contato',
    'vou pedir para o lucas',
    'não tenho certeza',
    'não tenho essa informação',
    'não sei informar',
    'não posso confirmar',
    'vou encaminhar para o lucas',
    'preciso consultar',
  ]
  const lower = text.toLowerCase()
  return doubtMarkers.some((marker) => lower.includes(marker))
}
