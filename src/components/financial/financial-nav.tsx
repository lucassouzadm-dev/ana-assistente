'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/financial', label: 'Visão Geral', exact: true },
  { href: '/financial/payables', label: 'A Pagar' },
  { href: '/financial/receivables', label: 'A Receber' },
  { href: '/financial/cashflow', label: 'Fluxo de Caixa' },
  { href: '/financial/dre', label: 'DRE' },
]

export function FinancialNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-0 overflow-x-auto border-b mb-6">
      {tabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
