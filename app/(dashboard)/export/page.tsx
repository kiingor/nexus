import { ExportPanel } from '@/components/export/ExportPanel'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function ExportPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Exportar' }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">Exportar</h1>
        <p className="text-secondary mt-1">
          Exporte a base de conhecimento como JSON limpo para agentes de IA
        </p>
      </div>
      <ExportPanel />
    </div>
  )
}
