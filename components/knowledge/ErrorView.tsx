import type { ErrorContent } from '@/lib/types'

interface ErrorViewProps {
  content: ErrorContent
}

export function ErrorView({ content }: ErrorViewProps) {
  return (
    <div className="space-y-3 text-sm">
      {content.error_code && (
        <div>
          <span className="text-muted text-xs uppercase tracking-wider">Código</span>
          <p className="text-red-400 font-mono mt-0.5">{content.error_code}</p>
        </div>
      )}
      <div>
        <span className="text-muted text-xs uppercase tracking-wider">Descrição</span>
        <p className="text-primary mt-0.5">{content.description}</p>
      </div>
      <div>
        <span className="text-muted text-xs uppercase tracking-wider">Causa</span>
        <p className="text-secondary mt-0.5">{content.cause}</p>
      </div>
      <div>
        <span className="text-muted text-xs uppercase tracking-wider">Solução</span>
        <p className="text-primary mt-0.5">{content.solution}</p>
      </div>
      {content.orientation && (
        <div>
          <span className="text-muted text-xs uppercase tracking-wider">Orientação visual</span>
          <p className="text-secondary mt-0.5">{content.orientation}</p>
        </div>
      )}
    </div>
  )
}
