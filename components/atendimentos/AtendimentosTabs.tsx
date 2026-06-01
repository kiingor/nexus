'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, List } from 'lucide-react'

// Barra de abas compartilhada entre /atendimentos (Lista) e
// /atendimentos/dashboard (Dashboard de Monitoramento).
//
// Usa o pathname pra destacar a aba ativa. As duas opções renderizam como
// <Link> pra preservar URL bookmarkável e estado de filtros independentes.
export function AtendimentosTabs() {
  const pathname = usePathname()

  const tabs = [
    { href: '/atendimentos',           label: 'Lista',     icon: List },
    { href: '/atendimentos/dashboard', label: 'Dashboard', icon: BarChart3 },
  ] as const

  return (
    <div className="inline-flex rounded-xl border border-glass-border bg-glass p-1 gap-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-orange-500/15 border border-orange-500/40 text-orange-300'
                : 'text-muted hover:text-primary hover:bg-white/5'
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
