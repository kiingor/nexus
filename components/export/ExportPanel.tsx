'use client'

import { useState, useEffect } from 'react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types'

type ExportFormat = 'json' | 'markdown'

interface ExportInstruction {
  modulo: string
  titulo: string
  palavras_chave?: string[]
  passos: {
    passo: number
    acao: string
    orientacao?: string | null
    atalho?: string | null
  }[]
}

interface ExportError {
  modulo: string
  titulo: string
  palavras_chave?: string[]
  codigo?: string | null
  descricao: string
  causa: string
  solucao: string
  orientacao?: string | null
}

interface ExportResult {
  produto: string
  exportado_em: string
  instrucoes: ExportInstruction[]
  erros: ExportError[]
}

function generateMarkdown(results: ExportResult[]): string {
  const lines: string[] = []

  for (const result of results) {
    lines.push(`# ${result.produto}`)
    lines.push('')

    if (result.instrucoes.length > 0) {
      for (const instr of result.instrucoes) {
        lines.push(`## ${instr.titulo}`)
        lines.push(`**Produto:** ${result.produto}`)
        lines.push(`**Módulo:** ${instr.modulo}`)
        if (instr.palavras_chave && instr.palavras_chave.length > 0) {
          lines.push(`**Palavras-chave:** ${instr.palavras_chave.map(k => `"${k}"`).join(', ')}`)
        }
        lines.push('')

        lines.push('### Passos')
        for (const step of instr.passos) {
          let line = `${step.passo}. **${step.acao}**`
          if (step.orientacao) {
            line += ` — ${step.orientacao}`
          }
          if (step.atalho) {
            line += ` \`${step.atalho}\``
          }
          lines.push(line)
        }
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }

    if (result.erros.length > 0) {
      for (const err of result.erros) {
        lines.push(`## ${err.titulo}`)
        lines.push(`**Produto:** ${result.produto}`)
        lines.push(`**Módulo:** ${err.modulo}`)
        if (err.codigo) {
          lines.push(`**Código:** ${err.codigo}`)
        }
        if (err.palavras_chave && err.palavras_chave.length > 0) {
          lines.push(`**Palavras-chave:** ${err.palavras_chave.map(k => `"${k}"`).join(', ')}`)
        }
        lines.push('')
        lines.push(`**Descrição:** ${err.descricao}`)
        lines.push('')
        lines.push(`**Causa:** ${err.causa}`)
        lines.push('')
        lines.push(`**Solução:** ${err.solucao}`)
        if (err.orientacao) {
          lines.push('')
          lines.push(`**Orientação visual:** ${err.orientacao}`)
        }
        lines.push('')
        lines.push('---')
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

export function ExportPanel() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
  const [exportData, setExportData] = useState<ExportResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [format, setFormat] = useState<ExportFormat>('json')
  const [outputString, setOutputString] = useState('')

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [])

  function toggleProduct(slug: string) {
    const next = new Set(selectedSlugs)
    if (next.has(slug)) {
      next.delete(slug)
    } else {
      next.add(slug)
    }
    setSelectedSlugs(next)
  }

  function toggleAll() {
    if (selectedSlugs.size === products.length) {
      setSelectedSlugs(new Set())
    } else {
      setSelectedSlugs(new Set(products.map((p) => p.slug)))
    }
  }

  function buildOutput(results: ExportResult[], fmt: ExportFormat) {
    if (fmt === 'markdown') {
      return generateMarkdown(results)
    }
    if (results.length === 1) {
      return JSON.stringify(results[0], null, 2)
    }
    const merged = {
      exportado_em: new Date().toISOString(),
      produtos: results.map((r) => ({
        produto: r.produto,
        instrucoes: r.instrucoes,
        erros: r.erros,
      })),
    }
    return JSON.stringify(merged, null, 2)
  }

  async function handleExport() {
    if (selectedSlugs.size === 0) return
    setLoading(true)
    setExportData(null)

    try {
      const results: ExportResult[] = await Promise.all(
        Array.from(selectedSlugs).map((slug) =>
          fetch(`/api/products/${slug}/export`).then((r) => r.json())
        )
      )

      setExportData(results)
      setOutputString(buildOutput(results, format))
    } catch {
      toast('Erro ao exportar', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Update output when format changes (if data already loaded)
  function switchFormat(fmt: ExportFormat) {
    setFormat(fmt)
    if (exportData) {
      setOutputString(buildOutput(exportData, fmt))
    }
  }

  function handleDownload() {
    if (!outputString) return
    const isJson = format === 'json'
    const blob = new Blob([outputString], {
      type: isJson ? 'application/json' : 'text/markdown',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = isJson ? 'json' : 'md'
    const name =
      selectedSlugs.size === 1
        ? `${Array.from(selectedSlugs)[0]}-knowledge.${ext}`
        : `nexus-knowledge-export.${ext}`
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    toast(`Arquivo .${ext} baixado com sucesso!`)
  }

  function handleCopy() {
    if (!outputString) return
    navigator.clipboard.writeText(outputString).then(() => {
      toast('Conteúdo copiado para clipboard!')
    })
  }

  const allSelected = products.length > 0 && selectedSlugs.size === products.length
  const totalInstrucoes = exportData?.reduce((acc, r) => acc + r.instrucoes.length, 0) || 0
  const totalErros = exportData?.reduce((acc, r) => acc + r.erros.length, 0) || 0

  return (
    <div className="space-y-6">
      {/* Product selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-secondary">Selecione os produtos</label>
          {products.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
            >
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          )}
        </div>

        {loadingProducts ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted py-4">Nenhum produto cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {products.map((product) => {
              const selected = selectedSlugs.has(product.slug)
              return (
                <button
                  key={product.id}
                  onClick={() => toggleProduct(product.slug)}
                  className={cn(
                    'glass p-3 text-left transition-all duration-200 cursor-pointer flex items-center gap-3',
                    selected && 'glow-orange bg-orange-500/5'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all',
                      selected
                        ? 'bg-orange-500 border-orange-500'
                        : 'border-glass-border'
                    )}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-muted truncate">{product.description}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Format selection */}
      {selectedSlugs.size > 0 && (
        <div>
          <label className="text-sm font-medium text-secondary mb-2 block">Formato</label>
          <div className="flex gap-2">
            <button
              onClick={() => switchFormat('json')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
                format === 'json'
                  ? 'bg-orange-500 text-white'
                  : 'glass text-secondary hover:text-primary'
              )}
            >
              JSON
            </button>
            <button
              onClick={() => switchFormat('markdown')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
                format === 'markdown'
                  ? 'bg-orange-500 text-white'
                  : 'glass text-secondary hover:text-primary'
              )}
            >
              Markdown
            </button>
          </div>
        </div>
      )}

      {/* Export button */}
      {selectedSlugs.size > 0 && !exportData && (
        <GlassButton onClick={handleExport} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" />
              Exportando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Exportar {selectedSlugs.size} {selectedSlugs.size === 1 ? 'produto' : 'produtos'}
            </>
          )}
        </GlassButton>
      )}

      {/* Results */}
      {exportData && !loading && (
        <>
          {/* Stats */}
          <div className="flex gap-4 flex-wrap">
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider">Produtos</p>
              <p className="text-2xl font-display font-bold text-primary">{exportData.length}</p>
            </GlassCard>
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider">Instruções</p>
              <p className="text-2xl font-display font-bold text-primary">{totalInstrucoes}</p>
            </GlassCard>
            <GlassCard className="px-4 py-3">
              <p className="text-xs text-muted uppercase tracking-wider">Erros</p>
              <p className="text-2xl font-display font-bold text-primary">{totalErros}</p>
            </GlassCard>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <GlassButton onClick={handleDownload}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Baixar {format === 'json' ? 'JSON' : 'Markdown'}
            </GlassButton>
            <GlassButton variant="glass" onClick={handleCopy}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Copiar {format === 'json' ? 'JSON' : 'Markdown'}
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => {
                setExportData(null)
                setOutputString('')
              }}
            >
              Nova exportação
            </GlassButton>
          </div>

          {/* Preview */}
          <div className="glass p-1">
            <pre className="bg-surface rounded-xl p-4 text-xs font-mono text-secondary overflow-auto max-h-[50vh] leading-relaxed whitespace-pre-wrap">
              {outputString}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
