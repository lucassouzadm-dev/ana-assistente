const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || ''
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'ana-assistente'
const API_VERSION = process.env.EVOLUTION_API_VERSION || 'v2'

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: EVOLUTION_API_KEY,
  }
}

const fetchOpts: RequestInit = { cache: 'no-store' }

interface SendTextParams {
  to: string
  text: string
}

interface SendMediaParams {
  to: string
  mediaUrl: string
  caption?: string
  mediaType: 'image' | 'document' | 'audio'
}

export async function sendText({ to, text }: SendTextParams) {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  const body = API_VERSION === 'v1'
    ? { number: to, textMessage: { text } }
    : { number: to, text }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        ...fetchOpts,
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      const respBody = await response.text()
      throw new Error(`Evolution API error: ${response.status} - ${respBody}`)
    }

    return response.json()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Evolution API] sendText timed out after 15s — message may still have been sent')
      return { status: 'timeout' }
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendMedia({ to, mediaUrl, caption, mediaType }: SendMediaParams) {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  const body = API_VERSION === 'v1'
    ? { number: to, mediaMessage: { mediatype: mediaType, media: mediaUrl, caption } }
    : { number: to, mediatype: mediaType, media: mediaUrl, caption }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`,
      {
        ...fetchOpts,
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      const respBody = await response.text()
      throw new Error(`Evolution API error: ${response.status} - ${respBody}`)
    }

    return response.json()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Evolution API] sendMedia timed out after 15s — media may still have been sent')
      return { status: 'timeout' }
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

interface ForwardMediaParams {
  to: string
  mediaUrl: string
  mediaType: 'image' | 'document' | 'audio'
  caption?: string
}

export async function forwardMediaToLucas({ to, mediaUrl, mediaType, caption }: ForwardMediaParams) {
  return sendMedia({ to, mediaUrl, caption, mediaType })
}

export async function createInstance() {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL not configured')

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    : 'https://ana-assistente.vercel.app/api/webhooks/whatsapp'

  if (API_VERSION === 'v1') {
    // v1.x: init instance then set webhook separately
    const initRes = await fetch(
      `${EVOLUTION_API_URL}/instance/init`,
      {
        ...fetchOpts,
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          instanceName: INSTANCE_NAME,
          qrcode: true,
        }),
      }
    )

    if (!initRes.ok) {
      const body = await initRes.text()
      throw new Error(`Create instance error: ${initRes.status} - ${body}`)
    }

    const initData = await initRes.json()

    // Set webhook
    await fetch(
      `${EVOLUTION_API_URL}/webhook/instance/${INSTANCE_NAME}`,
      {
        ...fetchOpts,
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        }),
      }
    )

    return initData
  }

  // v2.x
  const response = await fetch(
    `${EVOLUTION_API_URL}/instance/create`,
    {
      ...fetchOpts,
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Create instance error: ${response.status} - ${body}`)
  }

  return response.json()
}

export async function getQRCode(): Promise<{ base64?: string; pairingCode?: string; code?: string }> {
  if (!EVOLUTION_API_URL) throw new Error('EVOLUTION_API_URL not configured')

  const response = await fetch(
    `${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`,
    { ...fetchOpts, headers: { apikey: EVOLUTION_API_KEY } }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`QR code error: ${response.status} - ${body}`)
  }

  return response.json()
}

export async function getInstanceStatus(): Promise<{
  instance?: { instanceName: string; state: string }
  error?: string
}> {
  if (!EVOLUTION_API_URL) {
    return { instance: { instanceName: INSTANCE_NAME, state: 'not_configured' } }
  }

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { ...fetchOpts, headers: { apikey: EVOLUTION_API_KEY } }
    )
    return response.json()
  } catch (error) {
    return { error: String(error) }
  }
}

export async function getWebhook(): Promise<{ url?: string; enabled?: boolean; error?: string }> {
  if (!EVOLUTION_API_URL) return { error: 'EVOLUTION_API_URL not configured' }
  try {
    const endpoint = API_VERSION === 'v1'
      ? `${EVOLUTION_API_URL}/webhook/instance/${INSTANCE_NAME}`
      : `${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`
    const response = await fetch(endpoint, { ...fetchOpts, headers: { apikey: EVOLUTION_API_KEY } })
    const data = await response.json()
    // v2 returns { webhook: { url, enabled } }, v1 returns { url, enabled }
    return data?.webhook ?? data
  } catch (error) {
    return { error: String(error) }
  }
}
export async function setWebhook(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!EVOLUTION_API_URL) return { ok: false, error: 'EVOLUTION_API_URL not configured' }
  try {
    const endpoint = API_VERSION === 'v1'
      ? `${EVOLUTION_API_URL}/webhook/instance/${INSTANCE_NAME}`
      : `${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`
    const body = {
      enabled: true,
      url,
      webhookByEvents: false,
      webhookBase64: true,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
    }
    const response = await fetch(endpoint, {
      ...fetchOpts,
      method: 'POST',
      headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: `HTTP ${response.status}: ${text}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}
