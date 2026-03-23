import { ChatInterface } from '@/components/chat/ChatInterface'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function TestPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Testar' }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">Testar Base</h1>
        <p className="text-secondary mt-1">
          Valide o conhecimento cadastrado conversando com a IA
        </p>
      </div>
      <ChatInterface />
    </div>
  )
}
