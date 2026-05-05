import { Badge } from '@/components/ui/badge'
import { CONTACT_CATEGORY_LABELS } from '@/lib/utils/constants'
import type { ContactCategory } from '@/types/database'

const categoryVariants: Record<ContactCategory, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
  collaborator: 'info',
  partner: 'default',
  maintenance: 'warning',
  accounting: 'secondary',
  tenant: 'success',
  guest: 'success',
  rental_company: 'default',
  supplier: 'secondary',
  unknown: 'outline',
}

export function ContactCategoryBadge({ category }: { category: ContactCategory }) {
  return (
    <Badge variant={categoryVariants[category]}>
      {CONTACT_CATEGORY_LABELS[category]}
    </Badge>
  )
}
