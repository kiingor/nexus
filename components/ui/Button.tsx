'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[#FF6B00] hover:bg-[#FF8533] text-white font-medium shadow-[0_0_20px_rgba(255,107,0,0.25)] hover:shadow-[0_0_28px_rgba(255,107,0,0.4)] active:scale-[0.98]',
  secondary:
    'bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-[#F5F5F0] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,107,0,0.3)] active:scale-[0.98]',
  ghost:
    'hover:bg-[rgba(255,255,255,0.06)] text-[#8A8A85] hover:text-[#F5F5F0] active:scale-[0.98]',
  danger:
    'bg-[rgba(239,68,68,0.12)] hover:bg-[rgba(239,68,68,0.2)] text-red-400 border border-[rgba(239,68,68,0.2)] hover:border-[rgba(239,68,68,0.4)] active:scale-[0.98]',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center rounded-xl font-medium
          transition-all duration-200 cursor-pointer select-none
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <span className="spinner" style={{ width: size === 'sm' ? 14 : 18, height: size === 'sm' ? 14 : 18 }} />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
