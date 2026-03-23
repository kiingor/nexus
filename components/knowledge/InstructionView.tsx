import type { InstructionContent } from '@/lib/types'

interface InstructionViewProps {
  content: InstructionContent
}

export function InstructionView({ content }: InstructionViewProps) {
  return (
    <div className="space-y-3">
      {content.steps.map((step) => (
        <div key={step.passo} className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-400">{step.passo}</span>
          </div>
          <div className="flex-1 pt-0.5">
            <p className="text-sm text-primary font-medium">{step.acao}</p>
            {step.orientacao && (
              <p className="text-xs text-secondary mt-1">{step.orientacao}</p>
            )}
            {step.atalho && (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-mono bg-surface border border-glass-border rounded text-muted">
                {step.atalho}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
