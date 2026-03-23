'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-display font-bold text-red-400 mb-4">Erro</h1>
        <p className="text-secondary mb-8">
          {error.message || 'Algo deu errado. Tente novamente.'}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-medium transition-colors cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
