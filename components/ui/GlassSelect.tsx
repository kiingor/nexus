'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary',
            'focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30',
            'transition-all duration-200 appearance-none cursor-pointer',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="bg-surface text-muted">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface text-primary">
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

GlassSelect.displayName = 'GlassSelect'
