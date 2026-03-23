'use client'

import { cn } from '@/lib/utils'

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export function GlassButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'primary' && 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20',
        variant === 'glass' && 'glass glass-hover text-primary',
        variant === 'ghost' && 'bg-transparent hover:bg-glass-hover text-secondary hover:text-primary',
        variant === 'danger' && 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
