import { createAdminClient } from '@/lib/supabase/admin'

export interface EscalationResult {
  shouldEscalate: boolean
  action: 'escalate' | 'notify' | 'block' | null
  ruleName: string | null
  responseTemplate: string | null
}

export async function checkEscalationRules(
  message: string,
  contactCategory: string
): Promise<EscalationResult> {
  const supabase = createAdminClient()
  const { data: rules } = await supabase
    .from('escalation_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!rules || rules.length === 0) {
    return { shouldEscalate: false, action: null, ruleName: null, responseTemplate: null }
  }

  const messageLower = message.toLowerCase()

  for (const rule of rules) {
    let triggered = false

    switch (rule.condition_type) {
      case 'financial_above': {
        const threshold = (rule.condition_value as { amount: number }).amount || 500
        const amounts = messageLower.match(/r\$\s*([\d.,]+)/g)
        if (amounts) {
          for (const match of amounts) {
            const value = parseFloat(match.replace(/r\$\s*/i, '').replace(/\./g, '').replace(',', '.'))
            if (value >= threshold) {
              triggered = true
              break
            }
          }
        }
        const numberMatch = messageLower.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:reais|real)/i)
        if (numberMatch) {
          const value = parseFloat(numberMatch[1].replace(/\./g, '').replace(',', '.'))
          if (value >= threshold) triggered = true
        }
        break
      }

      case 'keyword': {
        const keywords = (rule.condition_value as { keywords: string[] }).keywords || []
        triggered = keywords.some((kw) => messageLower.includes(kw.toLowerCase()))
        break
      }

      case 'category': {
        const categories = (rule.condition_value as { categories: string[] }).categories || []
        triggered = categories.includes(contactCategory)
        break
      }

      case 'complaint': {
        const complaintKeywords = ['reclamação', 'insatisfeito', 'péssimo', 'horrível', 'absurdo', 'inaceitável']
        triggered = complaintKeywords.some((kw) => messageLower.includes(kw))
        break
      }

      case 'legal': {
        const legalKeywords = ['advogado', 'processo', 'justiça', 'procon', 'indenização', 'notificação extrajudicial']
        triggered = legalKeywords.some((kw) => messageLower.includes(kw))
        break
      }

      case 'custom': {
        break
      }
    }

    if (triggered) {
      return {
        shouldEscalate: true,
        action: rule.action as 'escalate' | 'notify' | 'block',
        ruleName: rule.name,
        responseTemplate: rule.response_template,
      }
    }
  }

  return { shouldEscalate: false, action: null, ruleName: null, responseTemplate: null }
}

export function checkAIResponseForEscalation(aiResponse: string): boolean {
  const escalationMarkers = [
    'vou pedir para o lucas',
    'lucas entrará em contato',
    'preciso verificar com o lucas',
    'vou encaminhar para o lucas',
  ]
  const responseLower = aiResponse.toLowerCase()
  return escalationMarkers.some((marker) => responseLower.includes(marker))
}
