import { createAdminClient } from '@/lib/supabase/admin'

export async function loadEmailContext(senderEmail: string): Promise<{
  contactInfo?: string
  knowledgeBase: string[]
}> {
  const supabase = createAdminClient()

  const [contactRes, kbRes] = await Promise.all([
    supabase.from('contacts').select('name, category, relationship_description').eq('email', senderEmail).single(),
    supabase.from('knowledge_base').select('title, content').eq('is_active', true).order('priority', { ascending: false }).limit(5),
  ])

  let contactInfo: string | undefined
  if (contactRes.data) {
    const c = contactRes.data
    contactInfo = `Nome: ${c.name}\nCategoria: ${c.category}\n${c.relationship_description ? `Relacionamento: ${c.relationship_description}` : ''}`
  }

  const knowledgeBase = (kbRes.data || []).map((kb: { title: string; content: string }) =>
    `### ${kb.title}\n${kb.content}`
  )

  return { contactInfo, knowledgeBase }
}
