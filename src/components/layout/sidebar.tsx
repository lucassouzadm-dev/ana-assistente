'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Users,
  MessageSquare,
  Mail,
  Building2,
  CalendarDays,
  BookOpen,
  DollarSign,
  ClipboardList,
  FileText,
  Settings,
  ScrollText,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/contacts', label: 'Contatos', icon: Users },
  { href: '/conversations', label: 'Conversas', icon: MessageSquare },
  { href: '/emails', label: 'E-mails', icon: Mail },
  { href: '/properties', label: 'Imóveis', icon: Building2 },
  { href: '/reservations', label: 'Reservas', icon: CalendarDays },
  { href: '/knowledge-base', label: 'Base de Conhecimento', icon: BookOpen },
  { href: '/financial', label: 'Financeiro', icon: DollarSign },
  { href: '/tasks', label: 'Tarefas', icon: ClipboardList },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/settings', label: 'Configurações', icon: Settings },
  { href: '/audit', label: 'Auditoria', icon: ScrollText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar border-r transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              A
            </div>
            <span className="text-lg font-bold text-foreground">Ana</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            Ana Assistente v0.1
          </p>
        </div>
      </aside>
    </>
  )
}
