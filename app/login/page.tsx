import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-primary">
            Nexus<span className="text-orange-500">.</span>
          </h1>
          <p className="text-sm text-secondary mt-2">
            Base de Conhecimento para Agentes de IA
          </p>
        </div>

        {/* Login form */}
        <div className="glass p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
