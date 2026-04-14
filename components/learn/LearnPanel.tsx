'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Download, RefreshCw, CheckCircle, AlertCircle, Brain, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'

type Phase = 'idle' | 'fetching' | 'building' | 'uploading' | 'training' | 'done' | 'error'

interface LearnStats {
  examples?: number
  items?: number
  jobId?: string
  fineTunedModel?: string
  error?: string
  lastEvent?: { message: string } | null
}

export function LearnPanel() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [stats, setStats] = useState<LearnStats>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef<number>(0)

  // Poll for job status
  const startPolling = useCallback((jobId: string) => {
    setPhase('training')

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/learn-status?jobId=${encodeURIComponent(jobId)}`)
        const data = await res.json()

        if (!res.ok) {
          console.error('Status error:', data.error)
          return
        }

        setStats((prev) => ({
          ...prev,
          lastEvent: data.lastEvent,
          fineTunedModel: data.fineTunedModel,
        }))

        if (data.status === 'succeeded') {
          setPhase('done')
          stopPolling()
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          setPhase('error')
          setStats((prev) => ({ ...prev, error: `Job ${data.status}` }))
          stopPolling()
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 15000) // Poll every 15s
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return stopPolling
  }, [stopPolling])

  async function handleStart() {
    startRef.current = Date.now()
    setPhase('fetching')
    setStats({})

    try {
      // Simulate phases for UX (the actual API call takes time)
      setPhase('building')
      await sleep(1500)

      setPhase('uploading')
      await sleep(1000)

      const res = await fetch('/api/ai/learn', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setPhase('error')
        setStats({ error: data.error || 'Erro desconhecido' })
        return
      }

      setStats({
        examples: data.examples,
        items: data.items,
        jobId: data.jobId,
      })

      // Start polling for training status
      startPolling(data.jobId)
    } catch (err) {
      setPhase('error')
      setStats({ error: err instanceof Error ? err.message : 'Erro ao iniciar aprendizagem' })
    }
  }

  function handleReset() {
    stopPolling()
    setPhase('idle')
    setStats({})
  }

  const elapsed = Math.floor((Date.now() - startRef.current) / 60000)

  const phases = [
    { key: 'fetching', label: 'Buscando conhecimento' },
    { key: 'building', label: 'Gerando dataset' },
    { key: 'uploading', label: 'Enviando para OpenAI' },
    { key: 'training', label: 'Treinando modelo' },
  ]

  const currentPhaseIndex = phases.findIndex((p) => p.key === phase)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FF6B00, #FF9A3C)',
              boxShadow: '0 0 20px rgba(255,107,0,0.3)',
            }}
          >
            <Brain size={20} className="text-white" />
          </div>
          <h1
            className="text-2xl font-bold text-[#F5F5F0]"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Aprender
          </h1>
        </div>
        <p className="text-sm text-[#8A8A85]">
          Melhore a IA do Nexus gerando novos dados de treino e fazendo fine-tuning automaticamente.
        </p>
      </div>

      {/* Main Card */}
      <GlassCard>
        <div className="p-6">
          {/* IDLE State */}
          {phase === 'idle' && (
            <div className="text-center py-8">
              <Sparkles size={48} className="mx-auto mb-4 text-[#FF6B00]" />
              <h2 className="text-lg font-semibold text-[#F5F5F0] mb-2">
                Melhorar IA do Nexus
              </h2>
              <p className="text-sm text-[#8A8A85] mb-6 max-w-md mx-auto">
                Este processo irá:
              </p>
              <div className="text-left space-y-2 mb-6 max-w-sm mx-auto">
                {[
                  'Buscar todos os itens de conhecimento ativos',
                  'Gerar dataset com variações de perguntas',
                  'Fazer upload para OpenAI',
                  'Iniciar fine-tuning do modelo gpt-4o-mini',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[#8A8A85]">
                    <CheckCircle size={14} className="text-[#FF6B00] mt-0.5 flex-shrink-0" />
                    {step}
                  </div>
                ))}
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleStart}
                icon={<Sparkles size={16} />}
              >
                Melhorar IA
              </Button>
            </div>
          )}

          {/* PROCESSING State */}
          {(phase === 'fetching' || phase === 'building' || phase === 'uploading') && (
            <div className="py-8">
              <div className="flex items-center justify-center mb-6">
                <Loader2 size={32} className="text-[#FF6B00] animate-spin" />
              </div>

              {/* Phase Progress */}
              <div className="space-y-3 mb-6">
                {phases.slice(0, 3).map((p, i) => {
                  const isActive = i === currentPhaseIndex
                  const isDone = i < currentPhaseIndex
                  return (
                    <div
                      key={p.key}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-[rgba(255,107,0,0.1)] border border-[#FF6B00]/30'
                          : isDone
                            ? 'bg-[rgba(255,107,0,0.05)] border border-[#FF6B00]/10'
                            : 'bg-white/5 border border-transparent'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle size={16} className="text-[#FF6B00]" />
                      ) : isActive ? (
                        <Loader2 size={16} className="text-[#FF6B00] animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[#4A4A48]" />
                      )}
                      <span
                        className={`text-sm ${
                          isActive ? 'text-[#FF6B00]' : isDone ? 'text-[#F5F5F0]' : 'text-[#4A4A48]'
                        }`}
                      >
                        {p.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-xs text-[#4A4A48]">
                Isso pode levar alguns minutos...
              </p>
            </div>
          )}

          {/* TRAINING State */}
          {phase === 'training' && (
            <div className="py-8">
              <div className="flex items-center justify-center mb-6">
                <Loader2 size={32} className="text-[#FF6B00] animate-spin" />
              </div>

              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-[#F5F5F0] mb-1">
                  Treinando modelo...
                </h2>
                <p className="text-sm text-[#8A8A85]">
                  {stats.jobId ? `Job: ${stats.jobId}` : ''}
                </p>
                {stats.examples && (
                  <p className="text-sm text-[#8A8A85] mt-1">
                    {stats.examples} exemplos gerados a partir de {stats.items} itens
                  </p>
                )}
              </div>

              {/* Last Event */}
              {stats.lastEvent && (
                <GlassCard>
                  <div className="px-4 py-3 text-sm text-[#8A8A85]">
                    <RefreshCw size={12} className="inline mr-2 text-[#FF6B00]" />
                    {stats.lastEvent.message}
                  </div>
                </GlassCard>
              )}

              <div className="mt-6 text-center">
                <p className="text-xs text-[#4A4A48]">
                  Fine-tuning leva de 15 a 60 minutos. Você pode fechar esta página e voltar depois.
                </p>
              </div>

              <div className="mt-6 flex justify-center">
                <Button variant="secondary" size="sm" onClick={handleReset}>
                  Voltar ao início
                </Button>
              </div>
            </div>
          )}

          {/* DONE State */}
          {phase === 'done' && (
            <div className="text-center py-8">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)' }}
              >
                <CheckCircle size={32} className="text-green-400" />
              </div>

              <h2 className="text-lg font-semibold text-[#F5F5F0] mb-1">
                Fine-tuning concluído!
              </h2>

              {stats.fineTunedModel && (
                <div className="mt-4 mb-6">
                  <GlassCard>
                    <div className="px-4 py-3">
                      <p className="text-xs text-[#4A4A48] mb-1">Modelo gerado:</p>
                      <code
                        className="text-sm text-[#FF6B00] font-mono"
                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                      >
                        {stats.fineTunedModel}
                      </code>
                    </div>
                  </GlassCard>
                </div>
              )}

              {stats.examples && (
                <div className="flex justify-center gap-6 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#FF6B00]">{stats.examples}</p>
                    <p className="text-xs text-[#4A4A48]">Exemplos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#FF6B00]">{stats.items}</p>
                    <p className="text-xs text-[#4A4A48]">Itens base</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-[#8A8A85]">
                  Para usar o novo modelo, adicione ao <code className="text-[#FF6B00]">.env.local</code>:
                </p>
                <code
                  className="block text-xs text-[#8A8A85] bg-white/5 px-4 py-2 rounded-lg font-mono"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  NEXT_PUBLIC_OPENAI_FINETUNED_MODEL={stats.fineTunedModel}
                </code>
                <p className="text-xs text-[#4A4A48] mt-2">
                  Depois reinicie o servidor Next.js
                </p>
              </div>

              <div className="mt-6 flex justify-center gap-3">
                <Button variant="primary" size="sm" onClick={handleReset}>
                  Treinar novamente
                </Button>
              </div>
            </div>
          )}

          {/* ERROR State */}
          {phase === 'error' && (
            <div className="text-center py-8">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.15)' }}
              >
                <AlertCircle size={32} className="text-red-400" />
              </div>

              <h2 className="text-lg font-semibold text-[#F5F5F0] mb-2">
                Erro no processo
              </h2>
              <p className="text-sm text-[#8A8A85] mb-6">
                {stats.error || 'Ocorreu um erro inesperado'}
              </p>

              <div className="flex justify-center gap-3">
                <Button variant="primary" size="sm" onClick={handleStart}>
                  Tentar novamente
                </Button>
                <Button variant="secondary" size="sm" onClick={handleReset}>
                  Voltar ao início
                </Button>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Info Card */}
      <GlassCard className="mt-4">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold text-[#F5F5F0] mb-2">Sobre o Fine-Tuning</h3>
          <ul className="text-xs text-[#8A8A85] space-y-1">
            <li>• O fine-tuning usa o modelo base <code className="text-[#FF6B00]">gpt-4o-mini</code></li>
            <li>• O processo leva de 15 a 60 minutos</li>
            <li>• O custo é baseado no número de tokens do dataset</li>
            <li>• Para distillation avançada com GPT-4o, use: <code className="text-[#FF6B00]">npx tsx scripts/distill-training-data.ts</code></li>
          </ul>
        </div>
      </GlassCard>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
