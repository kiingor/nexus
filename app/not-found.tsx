import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="text-center">
        <h1 className="text-6xl font-display font-bold text-orange-500 mb-4">404</h1>
        <p className="text-lg text-secondary mb-8">Página não encontrada</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-medium transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  )
}
