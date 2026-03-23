'use client'

import { useState, useEffect } from 'react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import type { Product } from '@/lib/types'

interface ExportResult {
  produto: string
  exportado_em: string
  instrucoes: unknown[]
  erros: unknown[]
}

export function ExportPanel() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())
  const [exportData, setExportData] = useState<ExportResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [jsonString, setJsonString] = useState('')

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

  async function handleExport() {
    if (selectedSlugs.size === 0) return
    setLoading(true)
    setExportData(null)

    try {
      const results = await Promise.all(
        Array.from(selectedSlugs).map((slug) =>
          fetch(`/api/products/${slug}/export`).then((r) => r.json())
        )
      )

      setExportData(results)

      if (results.length === 1) {
        setJsonString(JSON.stringify(results[0], null, 2))
      } else {
        // Merge all products into a single export
        const merged = {
          exportado_em: new Date().toISOString(),
          produtos: results.map((r: ExportResult) => ({
            produto: r.produto,
            instrucoes: r.instrucoes,
            erros: r.erros,
          })),
        }
        setJsonString(JSON.stringify(merged, null, 2))
      }
    } catch {
      toast('Erro ao exportar', 'error')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (!jsonString) return
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const name = selectedSlugs.size === 1
      ? `${Array.from(selectedSlugs)[0]}-knowledge.json`
      : 'nexus-knowledge-export.json'
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    toast('JSON baixado com sucesso!')
  }

  function handleCopy() {
    if (!jsonString) return
    navigator.clipboard.writeText(jsonString).then(() => {
      toast('JSON copiado para clipboard!')
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
                  {/* Checkbox */}
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
          <div className="flex gap-3">
            <GlassButton onClick={handleDownload}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Baixar JSON
            </GlassButton>
            <GlassButton variant="glass" onClick={handleCopy}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Copiar JSON
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => {
                setExportData(null)
                setJsonString('')
              }}
            >
              Nova exportação
            </GlassButton>
          </div>

          {/* JSON Preview */}
          <div className="glass p-1">
            <pre className="bg-surface rounded-xl p-4 text-xs font-mono text-secondary overflow-auto max-h-[50vh] leading-relaxed">
              {jsonString}
            </pre>
          </div>
        </>
      )}
    </div>
  )
}
