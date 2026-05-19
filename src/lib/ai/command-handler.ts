import { createAdminClient } from '@/lib/supabase/admin'
import { generateResponse, type ChatMessage } from './gemini-client'
import { buildCommandPrompt } from './prompt-builder'
import { sendText } from '@/lib/whatsapp/evolution-api'
import { formatBRL } from '@/lib/utils/currency'

export async function handleLucasCommand(message: string, messageId: string) {
  const supabase = createAdminClient()
  const lucasPhone = process.env.LUCAS_WHATSAPP_NUMBER!

  // Save the command message for audit
  await supabase.from('audit_log').insert({
    action: 'lucas_command',
    actor: 'lucas',
    entity_type: 'command',
    details: { message, message_id: messageId },
  })

  // Build context with current data summary
  const dataContext = await buildDataContext()
  const systemPrompt = buildCommandPrompt() + '\n\n' + dataContext

  const messages: ChatMessage[] = [
    { role: 'user', content: message },
  ]

  const tools = [
    {
      functionDeclarations: [
        {
          name: 'initiate_conversation',
          description: 'Iniciar uma conversa com um contato específico buscando um objetivo',
          parameters: {
            type: 'object',
            properties: {
              contact_name: { type: 'string', description: 'Nome ou parte do nome do contato' },
              goal: { type: 'string', description: 'O objetivo da conversa' },
            },
            required: ['contact_name', 'goal'],
          },
        },
        {
          name: 'query_financials',
          description: 'Consultar dados financeiros (receita/despesa) de um período',
          parameters: {
            type: 'object',
            properties: {
              period: { type: 'string', description: 'Período: "month", "week", "today", "last_month"' },
              type: { type: 'string', description: 'Tipo: "revenue", "expense", "both"' },
            },
            required: ['period'],
          },
        },
        {
          name: 'list_conversations',
          description: 'Listar conversas de um dia específico',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'Data no formato YYYY-MM-DD ou "today", "yesterday"' },
            },
            required: ['date'],
          },
        },
        {
          name: 'create_task',
          description: 'Criar uma tarefa',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título da tarefa' },
              property_name: { type: 'string', description: 'Nome do imóvel relacionado (opcional)' },
              contact_name: { type: 'string', description: 'Nome do contato responsável (opcional)' },
              priority: { type: 'string', description: 'Prioridade: low, medium, high, urgent' },
              due_date: { type: 'string', description: 'Prazo no formato YYYY-MM-DD (opcional)' },
            },
            required: ['title'],
          },
        },
      ],
    },
  ]

  const result = await generateResponse(systemPrompt, messages, tools)

  // Handle function calls if any
  if (result.functionCalls && result.functionCalls.length > 0) {
    for (const fc of result.functionCalls) {
      const call = fc as { name: string; args: Record<string, string> }
      const response = await executeFunctionCall(call.name, call.args)

      // Send follow-up to Gemini with function result
      const followUp: ChatMessage[] = [
        { role: 'user', content: message },
        { role: 'model', content: `Executei a função ${call.name}. Resultado: ${response}` },
        { role: 'user', content: 'Resuma o resultado de forma curta para me responder no WhatsApp.' },
      ]

      const finalResult = await generateResponse(buildCommandPrompt(), followUp)
      await sendText({ to: lucasPhone, text: finalResult.text })
      return
    }
  }

  // Direct text response (no function call needed)
  await sendText({ to: lucasPhone, text: result.text })
}

async function buildDataContext(): Promise<string> {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const [contacts, conversations, tasks] = await Promise.all([
    supabase.from('contacts').select('id, name, category, phone').eq('is_active', true).limit(50),
    supabase.from('conversations').select('id, contact_id, status, last_message_at, contacts(name)').eq('status', 'active').order('last_message_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('id, title, status, priority, due_date').in('status', ['pending', 'in_progress']).limit(10),
  ])

  let context = '\n## DADOS ATUAIS\n'

  if (contacts.data && contacts.data.length > 0) {
    context += '\n### Contatos cadastrados (amostra):\n'
    contacts.data.slice(0, 20).forEach((c: Record<string, unknown>) => {
      context += `- ${c.name} (${c.category})${c.phone ? ` - ${c.phone}` : ''}\n`
    })
  }

  if (conversations.data && conversations.data.length > 0) {
    context += '\n### Conversas ativas recentes:\n'
    conversations.data.forEach((c: Record<string, unknown>) => {
      const contact = c.contacts as { name: string } | null
      context += `- ${contact?.name || 'N/A'} (${c.status}) - última msg: ${c.last_message_at || 'N/A'}\n`
    })
  }

  if (tasks.data && tasks.data.length > 0) {
    context += '\n### Tarefas pendentes:\n'
    tasks.data.forEach((t: Record<string, unknown>) => {
      context += `- ${t.title} (${t.priority}) — prazo: ${t.due_date || 'sem prazo'}\n`
    })
  }

  context += `\nData de hoje: ${today}\n`
  return context
}

async function executeFunctionCall(name: string, args: Record<string, string>): Promise<string> {
  const supabase = createAdminClient()

  switch (name) {
    case 'initiate_conversation': {
      const { contact_name, goal } = args
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .ilike('name', `%${contact_name}%`)
        .limit(1)

      if (!contacts || contacts.length === 0) {
        return `Contato "${contact_name}" não encontrado no sistema.`
      }

      const contact = contacts[0]
      if (!contact.phone) {
        return `Contato ${contact.name} não tem telefone cadastrado.`
      }

      // Reuse the most recent active conversation (or create one if none exists).
      // Creating a new conversation on every initiate splits the history — when
      // the contact replies, the webhook may match the older conversation and
      // the AI re-greets, losing the new context.
      const { data: existingConvs } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('channel', 'whatsapp')
        .in('status', ['active', 'escalated'])
        .order('created_at', { ascending: false })
        .limit(1)

      let conv = existingConvs?.[0]
      if (!conv) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({ contact_id: contact.id, channel: 'whatsapp', status: 'active' })
          .select()
          .single()
        conv = newConv!
      }

      const systemPrompt = `Você é Ana, assistente do Lucas. Inicie uma conversa com ${contact.name} com o seguinte objetivo: ${goal}. Seja educada e direta.`
      const result = await generateResponse(systemPrompt, [
        { role: 'user', content: `Gere a primeira mensagem para ${contact.name} com objetivo: ${goal}` },
      ])

      const nowIso = new Date().toISOString()
      await supabase.from('messages').insert({
        conversation_id: conv.id,
        direction: 'outbound',
        sender: 'ai',
        content: result.text,
        content_type: 'text',
        ai_model: process.env.AI_MODEL || 'gemini-2.5-flash',
      })

      // Bump last_message_at so the webhook can find this conversation when the contact replies
      await supabase
        .from('conversations')
        .update({ last_message_at: nowIso })
        .eq('id', conv.id)

      await sendText({ to: contact.phone, text: result.text })
      return `Mensagem enviada para ${contact.name}: "${result.text}"`
    }

    case 'query_financials': {
      const { period, type } = args
      const now = new Date()
      let startDate: string

      switch (period) {
        case 'today':
          startDate = now.toISOString().split('T')[0]
          break
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          startDate = weekAgo.toISOString().split('T')[0]
          break
        case 'last_month': {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          startDate = lastMonth.toISOString().split('T')[0]
          break
        }
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      }

      let query = supabase
        .from('financial_transactions')
        .select('type, amount')
        .gte('transaction_date', startDate)
        .eq('status', 'completed')

      if (type && type !== 'both') {
        query = query.eq('type', type)
      }

      const { data: transactions } = await query

      const revenue = (transactions || [])
        .filter((t: { type: string }) => t.type === 'revenue')
        .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0)
      const expenses = (transactions || [])
        .filter((t: { type: string }) => t.type === 'expense')
        .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0)

      return `Período desde ${startDate}: Receita ${formatBRL(revenue)} | Despesas ${formatBRL(expenses)} | Resultado ${formatBRL(revenue - expenses)}`
    }

    case 'list_conversations': {
      let targetDate = args.date
      const now = new Date()
      if (targetDate === 'today') targetDate = now.toISOString().split('T')[0]
      if (targetDate === 'yesterday') {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        targetDate = yesterday.toISOString().split('T')[0]
      }

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, conversations(contact_id, contacts(name))')
        .gte('created_at', `${targetDate}T00:00:00`)
        .lt('created_at', `${targetDate}T23:59:59`)
        .eq('direction', 'inbound')

      const uniqueContacts = new Map<string, string>()
      for (const msg of msgs || []) {
        const conv = (msg as Record<string, unknown>).conversations as Record<string, unknown>
        const contact = conv?.contacts as { name: string }
        if (contact) {
          uniqueContacts.set(msg.conversation_id, contact.name)
        }
      }

      if (uniqueContacts.size === 0) return `Nenhuma conversa em ${targetDate}.`
      return `${uniqueContacts.size} conversas em ${targetDate}: ${Array.from(uniqueContacts.values()).join(', ')}`
    }

    case 'create_task': {
      const { title, property_name, contact_name, priority, due_date } = args

      let propertyId: string | null = null
      let contactId: string | null = null

      if (property_name) {
        const { data } = await supabase
          .from('properties')
          .select('id')
          .ilike('name', `%${property_name}%`)
          .limit(1)
        if (data && data.length > 0) propertyId = data[0].id
      }

      if (contact_name) {
        const { data } = await supabase
          .from('contacts')
          .select('id')
          .ilike('name', `%${contact_name}%`)
          .limit(1)
        if (data && data.length > 0) contactId = data[0].id
      }

      await supabase.from('tasks').insert({
        title,
        property_id: propertyId,
        assigned_contact_id: contactId,
        priority: priority || 'medium',
        due_date: due_date || null,
        status: 'pending',
        category: 'maintenance',
      })

      return `Tarefa criada: "${title}"${property_name ? ` (${property_name})` : ''}${due_date ? ` — prazo: ${due_date}` : ''}`
    }

    default:
      return `Função ${name} não implementada.`
  }
}
