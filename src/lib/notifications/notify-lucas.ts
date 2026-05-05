import { sendText } from '@/lib/whatsapp/evolution-api'

interface EscalationNotification {
  contactName: string
  contactCategory: string
  triggeringMessage: string
  ruleName: string
  conversationId: string
}

export async function notifyLucasEscalation(notification: EscalationNotification) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const text = `⚠️ *ESCALAÇÃO*

Contato: ${notification.contactName} (${notification.contactCategory})
Regra: ${notification.ruleName}

Mensagem:
"${notification.triggeringMessage}"

🔗 ${appUrl}/conversations/${notification.conversationId}`

  try {
    await sendText({ to: lucasPhone, text })
  } catch (error) {
    console.error('Failed to notify Lucas via WhatsApp:', error)
  }
}

export async function sendDailyReportToLucas(reportText: string) {
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER
  if (!lucasPhone) return

  try {
    await sendText({ to: lucasPhone, text: reportText })
  } catch (error) {
    console.error('Failed to send daily report:', error)
  }
}
