'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const baseInputClass = `
  w-full rounded-xl px-4 py-2.5 text-sm text-[#F5F5F0]
  bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]
  placeholder:text-[#4A4A48] outline-none
  transition-all duration-200
  focus:border-[rgba(255,107,0,0.5)] focus:bg-[rgba(255,255,255,0.06)]
  focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)]
  hover:border-[rgba(255,255,255,0.14)]
  disabled:opacity-50 disabled:cursor-not-allowed
`;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#8A8A85]">{label}</label>
        )}
        <input
          ref={ref}
          className={`${baseInputClass} ${error ? 'border-red-500/50 focus:border-red-500/70' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#4A4A48]">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-[#8A8A85]">{label}</label>
        )}
        <textarea
          ref={ref}
          className={`
            ${baseInputClass} resize-none leading-relaxed
            ${error ? 'border-red-500/50 focus:border-red-500/70' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[#4A4A48]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
