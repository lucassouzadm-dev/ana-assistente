import { GoogleGenerativeAI, type GenerativeModel, type Content } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export function getModel(modelName?: string): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelName || process.env.AI_MODEL || 'gemini-2.5-flash',
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
  const model = getModel()

  const history: Content[] = messages.slice(0, -1).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }))

  const lastMessage = messages[messages.length - 1]

  const chat = model.startChat({
    history,
    systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    ...(tools && tools.length > 0 ? { tools: tools as never[] } : {}),
  })

  const result = await chat.sendMessage(lastMessage.content)
  const response = result.response

  const text = response.text()
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
