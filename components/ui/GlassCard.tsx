'use client'

import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  onClick?: () => void
}

export function GlassCard({ children, className, hover = false, glow = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass transition-all duration-200',
        hover && 'glass-hover cursor-pointer',
        glow && 'glow-orange',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}
