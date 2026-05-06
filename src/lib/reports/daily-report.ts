import { createAdminClient } from '@/lib/supabase/admin'
import { generateResponse, type ChatMessage } from '@/lib/ai/gemini-client'
import { formatBRL } from '@/lib/utils/currency'
import { sendDailyReportToLucas } from '@/lib/notifications/notify-lucas'

function getBRTDate(date = new Date()): string {
  const tz = process.env.TIMEZONE || 'America/Bahia'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
  return parts
}

export async function generateDailyReport(reportDate?: string) {
  const supabase = createAdminClient()
  const today = reportDate || getBRTDate()
  const startOfDay = `${today}T03:00:00.000Z`
  const nextDay = new Date(`${today}T03:00:00.000Z`)
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  const endOfDay = nextDay.toISOString()

  // Gather data
  const [messagesRes, newContactsRes, escalationsRes, revenueRes, expensesRes, tasksCreatedRes, tasksCompletedRes] =
    await Promise.all([
      supabase
        .from('messages')
        .select('id, conversation_id, direction, sender, content, conversations(contact_id, contacts(name, category))')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('contacts')
        .select('id, name, category, phone')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('audit_log')
        .select('id, details')
        .eq('action', 'escalation')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('financial_transactions')
        .select('amount')
        .eq('type', 'revenue')
        .eq('transaction_date', today)
        .eq('status', 'completed'),
      supabase
        .from('financial_transactions')
        .select('amount')
        .eq('type', 'expense')
        .eq('transaction_date', today)
        .eq('status', 'completed'),
      supabase
        .from('tasks')
        .select('id, title')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay),
      supabase
        .from('tasks')
        .select('id, title')
        .eq('status', 'completed')
        .gte('completed_at', startOfDay)
        .lte('completed_at', endOfDay),
    ])

  const totalMessages = messagesRes.data?.length || 0
  const inboundMessages = messagesRes.data?.filter((m) => m.direction === 'inbound').length || 0
  const uniqueConversations = new Set(messagesRes.data?.map((m) => m.conversation_id)).size
  const newContacts = newContactsRes.data || []
  const escalationsCount = escalationsRes.data?.length || 0
  const revenueTotal = (revenueRes.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
  const expenseTotal = (expensesRes.data || []).reduce((sum, t) => sum + Number(t.amount), 0)
  const tasksCreated = tasksCreatedRes.data?.length || 0
  const tasksCompleted = tasksCompletedRes.data?.length || 0

  // Get unique contacts who sent messages
  const contactsWhoMessaged = new Map<string, string>()
  for (const msg of messagesRes.data || []) {
    if (msg.direction === 'inbound') {
      const conv = msg.conversations as unknown as Record<string, unknown>
      const contact = conv?.contacts as unknown as { name: string; category: string }
      if (contact) {
        contactsWhoMessaged.set(msg.conversation_id, `${contact.name} (${contact.category})`)
      }
    }
  }

  // Build summary data for Gemini
  const dataForAI = `
Dados do dia ${today}:
- Total de mensagens: ${totalMessages} (${inboundMessages} recebidas)
- Conversas ativas: ${uniqueConversations}
- Contatos que mandaram mensagem: ${Array.from(contactsWhoMessaged.values()).join(', ') || 'nenhum'}
- Novos contatos: ${newContacts.length}${newContacts.length > 0 ? ` (${newContacts.map((c) => c.name).join(', ')})` : ''}
- Escalações: ${escalationsCount}
- Receita do dia: ${formatBRL(revenueTotal)}
- Despesas do dia: ${formatBRL(expenseTotal)}
- Resultado: ${formatBRL(revenueTotal - expenseTotal)}
- Tarefas criadas: ${tasksCreated}
- Tarefas concluídas: ${tasksCompleted}
`

  const systemPrompt = `Você é Ana. Gere um resumo diário conciso para o Lucas (seu chefe) sobre a operação do dia.
O resumo será enviado via WhatsApp, então mantenha-o curto e formatado de forma legível.
Use emojis para separar seções. Destaque o que é importante.
Formato sugerido:
📋 Resumo do dia DD/MM
📨 Conversas: ...
👥 Novos contatos: ...
⚠️ Escalações: ...
💰 Financeiro: ...
✅ Tarefas: ...
🔥 Destaques: ...

Seja direto e informativo.`

  const messages: ChatMessage[] = [
    { role: 'user', content: dataForAI },
  ]

  const result = await generateResponse(systemPrompt, messages)

  // Save to database
  await supabase.from('daily_reports').insert({
    report_date: today,
    summary: result.text,
    conversations_count: uniqueConversations,
    new_contacts_count: newContacts.length,
    escalations_count: escalationsCount,
    revenue_total: revenueTotal,
    expense_total: expenseTotal,
    highlights: Array.from(contactsWhoMessaged.values()),
    sent_at: new Date().toISOString(),
  })

  // Send to Lucas via WhatsApp
  await sendDailyReportToLucas(result.text)

  return result.text
}
