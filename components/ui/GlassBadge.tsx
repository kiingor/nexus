import { cn } from '@/lib/utils'

interface GlassBadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'instruction' | 'error' | 'success'
  className?: string
}

export function GlassBadge({ children, variant = 'default', className }: GlassBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variant === 'default' && 'bg-glass border border-glass-border text-secondary',
        variant === 'instruction' && 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
        variant === 'error' && 'bg-red-500/10 border border-red-500/20 text-red-400',
        variant === 'success' && 'bg-green-500/10 border border-green-500/20 text-green-400',
        className
      )}
    >
      {children}
    </span>
  )
}
