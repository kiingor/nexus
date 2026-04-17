import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { McpConfigPanel } from '@/components/mcp/McpConfigPanel'

export default function McpPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'MCP' }]} />
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">MCP Server</h1>
        <p className="text-secondary mt-1">
          Exponha a base de conhecimento do Nexus para agentes externos (n8n, Claude, outros).
        </p>
      </div>

      <McpConfigPanel />
    </div>
  )
}
