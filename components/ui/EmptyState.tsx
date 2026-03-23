import { GlassButton } from './GlassButton'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && (
        <div className="text-muted mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-display font-semibold text-primary mb-2">{title}</h3>
      <p className="text-sm text-secondary text-center max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <GlassButton onClick={onAction}>{actionLabel}</GlassButton>
      )}
    </div>
  )
}
