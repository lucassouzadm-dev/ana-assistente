import { google, gmail_v1 } from 'googleapis'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
)

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
}

export function getAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ],
  })
}

export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  return tokens
}

export function getGmail(): gmail_v1.Gmail {
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export interface EmailMessage {
  id: string
  threadId: string
  from: string
  fromName: string
  to: string
  subject: string
  snippet: string
  body: string
  bodyHtml: string
  date: string
  labels: string[]
  isRead: boolean
  hasAttachments: boolean
  attachments: { filename: string; mimeType: string; attachmentId: string }[]
}

export interface EmailThread {
  id: string
  subject: string
  snippet: string
  lastDate: string
  from: string
  messageCount: number
  isRead: boolean
  labels: string[]
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html: string } {
  let text = ''
  let html = ''

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data)
    if (payload.mimeType === 'text/html') html = decoded
    else text = decoded
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = decodeBase64Url(part.body.data)
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = decodeBase64Url(part.body.data)
      } else if (part.mimeType?.startsWith('multipart/') && part.parts) {
        const nested = extractBody(part)
        if (nested.text) text = nested.text
        if (nested.html) html = nested.html
      }
    }
  }

  return { text, html }
}

function extractAttachments(payload: gmail_v1.Schema$MessagePart): { filename: string; mimeType: string; attachmentId: string }[] {
  const attachments: { filename: string; mimeType: string; attachmentId: string }[] = []

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          attachmentId: part.body.attachmentId,
        })
      }
      if (part.parts) {
        attachments.push(...extractAttachments(part))
      }
    }
  }

  return attachments
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2] }
  return { name: raw, email: raw }
}

export async function listEmails(options?: {
  maxResults?: number
  query?: string
  labelIds?: string[]
  pageToken?: string
}): Promise<{ emails: EmailThread[]; nextPageToken?: string }> {
  const gmail = getGmail()

  const res = await gmail.users.threads.list({
    userId: 'me',
    maxResults: options?.maxResults || 20,
    q: options?.query || '',
    labelIds: options?.labelIds,
    pageToken: options?.pageToken,
  })

  const threads: EmailThread[] = []

  for (const thread of res.data.threads || []) {
    const detail = await gmail.users.threads.get({
      userId: 'me',
      id: thread.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    })

    const lastMsg = detail.data.messages?.[detail.data.messages.length - 1]
    const headers = lastMsg?.payload?.headers || []
    const from = getHeader(headers, 'From')
    const subject = getHeader(headers, 'Subject')
    const date = getHeader(headers, 'Date')
    const labels = lastMsg?.labelIds || []
    const isRead = !labels.includes('UNREAD')

    threads.push({
      id: thread.id!,
      subject: subject || '(sem assunto)',
      snippet: thread.snippet || '',
      lastDate: date,
      from: parseEmailAddress(from).name || from,
      messageCount: detail.data.messages?.length || 1,
      isRead,
      labels,
    })
  }

  return { emails: threads, nextPageToken: res.data.nextPageToken || undefined }
}

export async function getEmailThread(threadId: string): Promise<EmailMessage[]> {
  const gmail = getGmail()

  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })

  return (res.data.messages || []).map((msg) => {
    const headers = msg.payload?.headers || []
    const from = getHeader(headers, 'From')
    const parsed = parseEmailAddress(from)
    const body = extractBody(msg.payload!)
    const attachments = extractAttachments(msg.payload!)

    return {
      id: msg.id!,
      threadId: msg.threadId!,
      from: parsed.email,
      fromName: parsed.name,
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject') || '(sem assunto)',
      snippet: msg.snippet || '',
      body: body.text,
      bodyHtml: body.html,
      date: getHeader(headers, 'Date'),
      labels: msg.labelIds || [],
      isRead: !(msg.labelIds || []).includes('UNREAD'),
      hasAttachments: attachments.length > 0,
      attachments,
    }
  })
}

export async function getEmail(messageId: string): Promise<EmailMessage> {
  const gmail = getGmail()

  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  const headers = msg.data.payload?.headers || []
  const from = getHeader(headers, 'From')
  const parsed = parseEmailAddress(from)
  const body = extractBody(msg.data.payload!)
  const attachments = extractAttachments(msg.data.payload!)

  return {
    id: msg.data.id!,
    threadId: msg.data.threadId!,
    from: parsed.email,
    fromName: parsed.name,
    to: getHeader(headers, 'To'),
    subject: getHeader(headers, 'Subject') || '(sem assunto)',
    snippet: msg.data.snippet || '',
    body: body.text,
    bodyHtml: body.html,
    date: getHeader(headers, 'Date'),
    labels: msg.data.labelIds || [],
    isRead: !(msg.data.labelIds || []).includes('UNREAD'),
    hasAttachments: attachments.length > 0,
    attachments,
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  references?: string
}): Promise<string> {
  const gmail = getGmail()
  const fromEmail = process.env.EMAIL_FROM || 'tassimirimco@gmail.com'
  const fromName = process.env.EMAIL_FROM_NAME || 'Ana - Assistente do Lucas'

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
  ]

  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`)
    headers.push(`References: ${params.references || params.inReplyTo}`)
  }

  const email = [...headers, '', params.body].join('\r\n')
  const encodedMessage = Buffer.from(email).toString('base64url')

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: params.threadId,
    },
  })

  return res.data.id!
}

export async function markAsRead(messageId: string): Promise<void> {
  const gmail = getGmail()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  })
}

export async function addLabel(messageId: string, labelId: string): Promise<void> {
  const gmail = getGmail()
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds: [labelId] },
  })
}

export async function listLabels(): Promise<{ id: string; name: string }[]> {
  const gmail = getGmail()
  const res = await gmail.users.labels.list({ userId: 'me' })
  return (res.data.labels || []).map((l) => ({ id: l.id!, name: l.name! }))
}

export async function getUnreadCount(): Promise<number> {
  const gmail = getGmail()
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: 1,
  })
  return res.data.resultSizeEstimate || 0
}
