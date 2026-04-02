import { ReactNode } from 'react';

type BadgeVariant = 'instruction' | 'error' | 'orange' | 'default' | 'success';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const styles: Record<BadgeVariant, string> = {
  instruction: 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
  error:       'bg-red-500/10 text-red-300 border border-red-500/20',
  orange:      'bg-orange-500/10 text-orange-300 border border-orange-500/20',
  success:     'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
  default:     'bg-white/5 text-[#8A8A85] border border-white/8',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
