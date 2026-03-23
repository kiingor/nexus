'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary placeholder:text-muted',
            'focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30',
            'transition-all duration-200',
            error && 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

GlassInput.displayName = 'GlassInput'
