'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Brain, Database, Play, BarChart3, Upload, RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, FileText, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Conversation {
  id: number
  assunto: string
  conv: string
  motivo: string
  cnpj: string
}

interface SimResult {
  id: number
  assunto: string
  motivo: string
  verdict: 'sim' | 'nao' | 'erro'
  reason: string
  turns: number
  transcript: Array<{ role: 'agent' | 'client'; text: string }>
  ticketOpened: boolean
  keywords?: Array<{ numero: number; descricao: string; palavras_chave: string[]; sugestao_kb: string }>
  feedback?: 'positive' | 'negative'
  feedbackNote?: string
}

type Panel = 'config' | 'dados' | 'simular' | 'resultados'

interface TrainingEntry {
  id: number
  assunto: string
  motivo: string
  feedback: 'positive' | 'negative'
  feedbackNote: string
  transcript: Array<{ role: 'agent' | 'client'; text: string }>
  savedAt: string
}

// ---------------------------------------------------------------------------
// Default agent rules
// ---------------------------------------------------------------------------
const DEFAULT_AGENT_RULES = `REGRA ABSOLUTA — BASE DE CONHECIMENTO:
Antes de cada resposta você DEVE consultar a BASE DE CONHECIMENTO fornecida acima.
Identifique as palavras-chave do problema do cliente (ex: SPED, NF-e, boleto, relatório) e localize o procedimento correspondente.
SE O ASSUNTO ESTIVER NA KB: execute o procedimento da KB imediatamente. PROIBIDO abrir chamado quando há procedimento na KB.
SE o cliente disser "já solicitei", "já aguardo", "já tentei" mas o assunto estiver na KB: IGNORE o histórico e ofereça resolver AGORA pelo chat/telefone seguindo o procedimento da KB.
SOMENTE abra chamado se o problema genuinamente não tiver solução na KB após tentar o procedimento.

REGRAS DE ATENDIMENTO:
Foco na solução: NUNCA peça CNPJ, AnyDesk, nome ou qualquer dado do cliente. Vá DIRETO ao problema. Máximo 2 frases por mensagem.
Passe os passos UM POR VEZ aguardando confirmação a cada passo.
NUNCA passe todos os passos de uma vez — um passo, espera, próximo passo.
Pergunte "Conseguiu?" ou "Deu certo?" após cada instrução.
Quando o cliente confirmar resolução: encerre com "Que ótimo! Atendimento encerrado!"
NUNCA encerre sem ter resolvido OU aberto chamado.
PROIBIDO: NUNCA escreva tool calls, JSON ou funções. NUNCA peça CNPJ. Responda SOMENTE com fala de atendente ao telefone.`

// ---------------------------------------------------------------------------
// Chart defaults
// ---------------------------------------------------------------------------
ChartJS.defaults.color = '#8A8A85'
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.08)'

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function SimulatePage() {
  const [panel, setPanel] = useState<Panel>('config')
  const [apiKey, setApiKey] = useState('')
  const [apiModel, setApiModel] = useState('gpt-4o-mini')
  const [useCustomApi, setUseCustomApi] = useState(false)
  const [customApiUrl, setCustomApiUrl] = useState('')
  const [concurrency, setConcurrency] = useState(5)
  const [maxTurns, setMaxTurns] = useState(8)
  const [agentPrompt, setAgentPrompt] = useState('')
  const [clientPrompt, setClientPrompt] = useState('')
  const [kbContent, setKbContent] = useState('')
  const [kbFileName, setKbFileName] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [convFileName, setConvFileName] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [simResults, setSimResults] = useState<Record<number, SimResult>>({})
  const [simRunning, setSimRunning] = useState(false)
  const [simProgress, setSimProgress] = useState({ current: 0, total: 0 })
  const [sampleFilter, setSampleFilter] = useState<'all' | 'sim' | 'nao'>('all')
  const [kwMenuOpen, setKwMenuOpen] = useState<Record<number, boolean>>({})
  const [liveTranscripts, setLiveTranscripts] = useState<Record<number, Array<{ role: 'agent' | 'client'; text: string }>>>({})
  const [watchingId, setWatchingId] = useState<number | null>(null)
  const [products, setProducts] = useState<Array<{ name: string; slug: string }>>([])
  const [selectedProductSlug, setSelectedProductSlug] = useState('')
  const [simFeedbackNotes, setSimFeedbackNotes] = useState<Record<number, string>>({})
  const [simFeedbackOpen, setSimFeedbackOpen] = useState<Record<number, boolean>>({})
  const [simFeedbackSending, setSimFeedbackSending] = useState<Record<number, boolean>>({})
  const [trainingCount, setTrainingCount] = useState(0)
  const [positiveCount, setPositiveCount] = useState(0)
  const [negativeCount, setNegativeCount] = useState(0)
  const [finetuneSending, setFinetuneSending] = useState(false)
  const [finetuneJobId, setFinetuneJobId] = useState<string | null>(null)
  const [finetuneStatus, setFinetuneStatus] = useState<'idle' | 'pending' | 'succeeded' | 'failed'>('idle')
  const [finetuneNotif, setFinetuneNotif] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const liveChatRef = useRef<HTMLDivElement>(null)

  // Load from localStorage
  useEffect(() => {
    if (liveChatRef.current) {
      liveChatRef.current.scrollTop = liveChatRef.current.scrollHeight
    }
  }, [liveTranscripts, watchingId])

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((data: Array<{ name: string; slug: string }>) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    // Load conversations imported from Chats page
    const imported = sessionStorage.getItem('nexus_sim_import')
    if (imported) {
      try {
        const convs = JSON.parse(imported)
        if (Array.isArray(convs) && convs.length > 0) {
          setConversations(convs)
          setSelectedIds(new Set(convs.map((c: { id: number }) => c.id)))
          setPanel('simular')
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('nexus_sim_import')
    }

    const savedKey = localStorage.getItem('nexus_sim_api_key')
    if (savedKey) setApiKey(savedKey)
    const savedModel = localStorage.getItem('nexus_sim_api_model')
    if (savedModel) setApiModel(savedModel)
    const savedPrompt = localStorage.getItem('nexus_sim_agent_prompt')
    if (savedPrompt) setAgentPrompt(savedPrompt)
    const savedClientPrompt = localStorage.getItem('nexus_sim_client_prompt')
    if (savedClientPrompt) setClientPrompt(savedClientPrompt)
    const savedResults = localStorage.getItem('nexus_sim_results')
    if (savedResults) {
      try { setSimResults(JSON.parse(savedResults)) } catch { /* ignore */ }
    }
    try {
      const training: TrainingEntry[] = JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
      if (Array.isArray(training)) {
        setTrainingCount(training.length)
        setPositiveCount(training.filter(e => e.feedback === 'positive').length)
        setNegativeCount(training.filter(e => e.feedback === 'negative').length)
      }
    } catch { /* ignore */ }

    // Restore pending fine-tune job from previous session
    const pendingJob = localStorage.getItem('nexus_finetune_pending')
    if (pendingJob) {
      setFinetuneJobId(pendingJob)
      setFinetuneStatus('pending')
    }
  }, [])

  // Poll fine-tuning job status every 30s until succeeded or failed
  useEffect(() => {
    if (!finetuneJobId || finetuneStatus === 'succeeded' || finetuneStatus === 'failed') return

    const poll = async () => {
      try {
        const resp = await fetch('/api/ai/finetune')
        if (!resp.ok) return
        const data = await resp.json() as { jobs: Array<{ id: string; status: string; fine_tuned_model: string | null }> }
        const job = data.jobs?.find(j => j.id === finetuneJobId)
        if (!job) return

        if (job.status === 'succeeded' && job.fine_tuned_model) {
          setFinetuneStatus('succeeded')
          setApiModel(job.fine_tuned_model)
          localStorage.setItem('nexus_sim_api_model', job.fine_tuned_model)
          localStorage.removeItem('nexus_finetune_pending')
          setFinetuneNotif(`Modelo atualizado: ${job.fine_tuned_model.slice(0, 40)}…`)
          // Auto-dismiss notification after 10s
          setTimeout(() => setFinetuneNotif(null), 10000)
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          setFinetuneStatus('failed')
          localStorage.removeItem('nexus_finetune_pending')
          setFinetuneNotif('Fine-tuning falhou. O modelo anterior será mantido.')
          setTimeout(() => setFinetuneNotif(null), 8000)
        }
      } catch { /* ignore */ }
    }

    poll() // immediate first check
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [finetuneJobId, finetuneStatus])

  const saveResults = useCallback((newResults: Record<number, SimResult>) => {
    setSimResults(prev => {
      const merged = { ...prev }
      for (const [idStr, result] of Object.entries(newResults)) {
        const id = Number(idStr)
        const existing = merged[id]
        // Preserve feedback/feedbackNote the user already set — never overwrite them
        merged[id] = existing?.feedback
          ? { ...result, feedback: existing.feedback, feedbackNote: existing.feedbackNote }
          : result
      }
      try { localStorage.setItem('nexus_sim_results', JSON.stringify(merged)) } catch { /* ignore */ }
      return merged
    })
  }, [])

  function selectSimFeedback(id: number, type: 'positive' | 'negative') {
    setSimResults(prev => {
      const updated = { ...prev, [id]: { ...prev[id], feedback: type } }
      try { localStorage.setItem('nexus_sim_results', JSON.stringify(updated)) } catch { /* ignore */ }
      return updated
    })
    setSimFeedbackOpen(prev => ({ ...prev, [id]: true }))
  }

  async function saveSimFeedback(id: number) {
    setSimFeedbackSending(prev => ({ ...prev, [id]: true }))
    try {
      const note = simFeedbackNotes[id] ?? ''
      const type = simResults[id]?.feedback
      if (!type) return
      const result = simResults[id]

      setSimResults(prev => {
        const updated = { ...prev, [id]: { ...prev[id], feedbackNote: note } }
        try { localStorage.setItem('nexus_sim_results', JSON.stringify(updated)) } catch { /* ignore */ }
        return updated
      })

      // Persist to localStorage training data
      if (result?.transcript?.length > 0) {
        try {
          const existing: TrainingEntry[] = JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
          const entry: TrainingEntry = {
            id,
            assunto: result.assunto,
            motivo: result.motivo,
            feedback: type,
            feedbackNote: note,
            transcript: result.transcript,
            savedAt: new Date().toISOString(),
          }
          const filtered = existing.filter(e => e.id !== id)
          const updated = [...filtered, entry]
          localStorage.setItem('nexus_sim_training', JSON.stringify(updated))
          setTrainingCount(updated.length)
        } catch { /* ignore */ }

        // Update positive/negative counters after saving
        try {
          const updated: TrainingEntry[] = JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
          setPositiveCount(updated.filter(e => e.feedback === 'positive').length)
          setNegativeCount(updated.filter(e => e.feedback === 'negative').length)
        } catch { /* ignore */ }
      }

      setSimFeedbackOpen(prev => ({ ...prev, [id]: false }))
      setSimFeedbackNotes(prev => { const next = { ...prev }; delete next[id]; return next })
    } finally {
      setSimFeedbackSending(prev => ({ ...prev, [id]: false }))
    }
  }

  async function runFinetune() {
    setFinetuneSending(true)
    try {
      const training: TrainingEntry[] = JSON.parse(localStorage.getItem('nexus_sim_training') ?? '[]')
      const positives = training.filter(e => e.feedback === 'positive' && e.transcript.length >= 4)
      if (positives.length < 10) {
        alert(`A OpenAI exige mínimo de 10 exemplos positivos para treino. Você tem ${positives.length} — avalie mais ${10 - positives.length} simulações com 👍.`)
        return
      }

      // Collect negative notes grouped by motivo — used to enrich positive examples
      // of the same motivo so the model learns "do this (positive)" + "avoid this (negative note)"
      const negativeNotesByMotivo: Record<string, string[]> = {}
      for (const e of training) {
        if (e.feedback === 'negative' && e.feedbackNote?.trim()) {
          const key = (e.motivo ?? '').toLowerCase().trim()
          if (!negativeNotesByMotivo[key]) negativeNotesByMotivo[key] = []
          negativeNotesByMotivo[key].push(e.feedbackNote.trim())
        }
      }

      const sysPrompt = localStorage.getItem('nexus_sim_agent_prompt') || ''
      const resp = await fetch('/api/ai/finetune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examples: positives.map(e => ({
            transcript: e.transcript,
            motivo: e.motivo,
            feedbackNote: e.feedbackNote,
            // Attach any negative notes for the same motivo as corrections to learn from
            correctionNotes: negativeNotesByMotivo[(e.motivo ?? '').toLowerCase().trim()] ?? [],
          })),
          systemPrompt: sysPrompt,
        }),
      })
      const data = await resp.json() as { jobId?: string; examplesCount?: number; error?: string; skipped?: boolean; reason?: string }
      if (data.jobId) {
        setFinetuneJobId(data.jobId)
        setFinetuneStatus('pending')
        localStorage.setItem('nexus_finetune_pending', data.jobId)
        setFinetuneNotif(`Fine-tuning iniciado · ${data.examplesCount ?? positives.length} exemplos · Job: ${data.jobId.slice(0, 20)}…`)
      } else if (data.error) {
        alert('Erro ao iniciar fine-tuning: ' + data.error)
      } else if (data.skipped) {
        alert('Nenhum exemplo válido para treino: ' + (data.reason ?? 'transcrições muito curtas'))
      }
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setFinetuneSending(false)
    }
  }

  const navItems: Array<{ key: Panel; label: string; icon: React.ReactNode }> = [
    { key: 'config', label: 'Configurar', icon: <Brain size={17} /> },
    { key: 'dados', label: 'Dados', icon: <Database size={17} /> },
    { key: 'simular', label: 'Simular', icon: <Play size={17} /> },
    { key: 'resultados', label: 'Resultados', icon: <BarChart3 size={17} /> },
  ]

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------
  async function handleKBUpload(file: File) {
    const text = await file.text()
    let content = text
    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          content = parsed.map(x => typeof x === 'string' ? x : (x.content || x.text || JSON.stringify(x))).join('\n\n---\n\n')
        }
      } catch { /* keep raw */ }
    }
    setKbContent(content)
    setKbFileName(file.name)
  }

  async function handleConvUpload(file: File, mode: 'replace' | 'add') {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return alert('JSON precisa ser um array.')

      const norm: Conversation[] = parsed.map((r: Record<string, unknown>, i: number) => {
        const rawConv = (r.conv || r.transcricao || '') as string
        let assunto = (r.assunto || r.assunto_principal || '') as string
        let cnpj = ''
        let conv = rawConv

        // Try parsing JSON conv
        if (rawConv) {
          try {
            const inner = JSON.parse(rawConv.replace(/^```json\n?/, '').replace(/\n?```$/, ''))
            const turns = inner.transcricao || inner
            if (Array.isArray(turns)) {
              conv = turns.map((t: Record<string, string>) =>
                `${t.papel === 'cliente' ? '[CLIENTE]' : '[ATENDENTE]'}: ${t.fala || ''}`
              ).join('\n')
              const allText = turns.map((t: Record<string, string>) => t.fala || '').join(' ')
              const cnpjM = allText.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
              if (cnpjM) cnpj = cnpjM[0]
              if (!assunto) {
                const clientFalas = turns.filter((t: Record<string, string>) => t.papel === 'cliente' && t.fala && t.fala.length > 20).map((t: Record<string, string>) => t.fala)
                assunto = (clientFalas.slice(1, 4).join(' ') || clientFalas[0] || '').slice(0, 300)
              }
            }
          } catch { /* fallback */ }
        }

        const motivo = (r.motivo as string) || getMotivo(assunto, rawConv)
        return { id: (r.id as number) || i + 1, assunto: assunto as string, conv, motivo, cnpj }
      })

      if (mode === 'replace') {
        setConversations(norm)
        setSelectedIds(new Set())
      } else {
        const existingIds = new Set(conversations.map(c => c.id))
        const added = norm.filter(c => !existingIds.has(c.id))
        setConversations([...conversations, ...added])
      }
      setConvFileName(file.name)
    } catch (e: unknown) {
      alert('Erro ao ler JSON: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function getMotivo(a: string, c: string): string {
    const t = ((a || '') + (c || '')).toLowerCase()
    if (/nota fiscal rejeitada|rejeição/.test(t)) return 'NF-e Rejeitada'
    if (/erro na emissão|série da nota/.test(t)) return 'Erro NF-e'
    if (/cancelamento de nota/.test(t)) return 'Cancelamento NF-e'
    if (/emissão de nota|emitir nota|nota fiscal|nfe|nf-e/.test(t)) return 'Emissão de NF-e'
    if (/sped|e-sped/.test(t)) return 'SPED'
    if (/boleto|pagamento|mensalidade|fatura|liberação|desbloqueio|bloqueado|pix/.test(t)) return 'Pagamento'
    if (/instalação|reinstalação|formatação/.test(t)) return 'Instalação'
    if (/atualização|versão|update/.test(t)) return 'Atualização'
    if (/lentidão|lento|banco de dados/.test(t)) return 'Lentidão'
    if (/impressora|etiqueta|driver|pin pad/.test(t)) return 'Hardware'
    if (/servidor|rede|conexão/.test(t)) return 'Servidor'
    if (/senha|login|usuário|permissão/.test(t)) return 'Acesso'
    if (/configurar|configuração|parâmetro/.test(t)) return 'Configuração'
    if (/treinamento|como fazer|como usar/.test(t)) return 'Treinamento'
    if (/relatório|consulta/.test(t)) return 'Relatório'
    return 'Suporte geral'
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  // Agent AI: uses the configured API (Nexus or OpenAI) with KB context
  async function callAI(messages: Array<{ role: string; content: string }>, system: string | null, maxTokens: number, kbOverride?: string): Promise<string> {
    const url = useCustomApi && customApiUrl ? customApiUrl : 'https://api.openai.com/v1/chat/completions'
    const model = apiModel

    let body: Record<string, unknown>
    if (useCustomApi && customApiUrl) {
      const nonSystem = messages.filter(m => m.role !== 'system')
      const lastMsg = nonSystem.length > 0 ? nonSystem[nonSystem.length - 1].content : ''
      const history = nonSystem.slice(0, -1).map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))
      body = { message: lastMsg, systemPrompt: system || '', productSlug: selectedProductSlug, model, history }
    } else {
      const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages
      body = { model, max_tokens: maxTokens, messages: msgs }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (!useCustomApi && apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!resp.ok) { const text = await resp.text().catch(() => ''); throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`) }
    const data = await resp.json()
    return (data.choices?.[0]?.message?.content || data.response || data.content || data.message || '').toString().trim()
  }

  // Client AI: always uses direct OpenAI with a neutral model — NO KB access.
  // This prevents the simulated client from "knowing" the support procedures.
  async function callClientAI(messages: Array<{ role: string; content: string }>, system: string | null, maxTokens: number): Promise<string> {
    const clientModel = 'gpt-4o-mini'
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages
    const body = { model: clientModel, max_tokens: maxTokens, messages: msgs }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // Use provided API key, or fall back to server-side proxy (Nexus local) for key-less setups
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    const url = apiKey ? 'https://api.openai.com/v1/chat/completions' : `${window.location.origin}/api/ai/client-sim`
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!resp.ok) { const text = await resp.text().catch(() => ''); throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`) }
    const data = await resp.json()
    return (data.choices?.[0]?.message?.content || data.response || '').toString().trim()
  }

  // Parse KB into keyword-indexed entries for real-time lookup
  function parseKBEntries(kb: string): Array<{ title: string; keywords: string[]; content: string }> {
    if (!kb.trim()) return []
    const sections = kb.split(/\n(?=#{1,3}\s)/).filter(s => s.trim().length > 30)
    if (sections.length === 0) {
      // No headers — split by double newline blocks
      return kb.split(/\n{2,}/).filter(s => s.trim().length > 30).map(s => {
        const words = s.toLowerCase().split(/[\s,;:.()\/\-]+/).filter(w => w.length > 3)
        return { title: s.slice(0, 60), keywords: [...new Set(words)], content: s }
      })
    }
    return sections.map(section => {
      const firstLine = section.split('\n')[0].replace(/^#+\s*/, '').trim()
      const kwLineMatch = section.match(/palavras.chave[:\s]+([^\n]+)/i)
      const kwFromLine = kwLineMatch ? kwLineMatch[1].split(/[,;]/).map(k => k.trim().toLowerCase().replace(/^["'*]+|["'*]+$/g, '')).filter(Boolean) : []
      const titleWords = firstLine.toLowerCase().split(/[\s,;:.()\/\-]+/).filter(w => w.length > 3)
      return { title: firstLine, keywords: [...new Set([...kwFromLine, ...titleWords])], content: section.trim() }
    })
  }

  // Find the most relevant KB entry for a given text.
  // Scoring: keyword frequency in text + title bonus (entry title found in text, or text found in entry title).
  // Title match gets a large bonus so entries whose title directly names the topic always win
  // over entries that merely share some incidental keywords.
  function matchKBEntry(text: string, entries: Array<{ title: string; keywords: string[]; content: string }>): { title: string; content: string } | null {
    const t = text.toLowerCase()
    let best: { title: string; content: string } | null = null
    let bestScore = 0
    for (const entry of entries) {
      const kwScore = entry.keywords.reduce((s, kw) => s + (t.includes(kw) ? (t.split(kw).length - 1) : 0), 0)
      if (kwScore === 0) continue
      // Title bonus: +5 if the entry title appears in the query, +3 if the query contains the title
      const titleLower = entry.title.toLowerCase()
      const titleBonus = t.includes(titleLower) ? 5 : (titleLower.split(/\s+/).filter(w => w.length > 3).every(w => t.includes(w)) ? 3 : 0)
      const score = kwScore + titleBonus
      if (score > bestScore) { bestScore = score; best = entry }
    }
    return bestScore > 0 ? best : null
  }

  function retrieveKB(query: string, kb: string, maxChars = 4000): string {
    if (!kb.trim()) return ''
    // Split into chunks by markdown headers, --- separators, or double newlines
    const chunks = kb.split(/\n(?=#{1,3}\s|\n---+\n|\n===+\n)/).flatMap(c =>
      c.length > 800 ? c.split(/\n\n+/).filter(s => s.trim().length > 40) : [c]
    ).filter(c => c.trim().length > 40)
    if (chunks.length <= 1) return kb.slice(0, maxChars)

    // Build keyword set from query (words > 3 chars + motivo words)
    const keywords = query.toLowerCase().split(/[\s,;:.()\-\/]+/).filter(w => w.length > 3)

    const scored = chunks.map(chunk => {
      const cl = chunk.toLowerCase()
      const score = keywords.reduce((s, w) => s + (cl.includes(w) ? (cl.split(w).length - 1) : 0), 0)
      return { chunk, score }
    }).sort((a, b) => b.score - a.score)

    // Collect top chunks up to maxChars
    let result = ''
    for (const { chunk } of scored) {
      if (result.length >= maxChars) break
      result += chunk.trim() + '\n\n'
    }
    return result.trim() || kb.slice(0, maxChars)
  }

  async function simulateOne(conv: Conversation, onTurn?: (msg: { role: 'agent' | 'client'; text: string }) => void): Promise<SimResult> {
    // kbTrunc is only used for full-KB injection into the system prompt (token budget)
    // All parsing and matching uses the full kbContent so sections at the end of the file are included
    const KB_PROMPT_MAX = 100000
    const kbTrunc = kbContent.length > KB_PROMPT_MAX ? kbContent.slice(0, KB_PROMPT_MAX) + '\n...[truncada]' : kbContent

    // Parse KB entries early so we can use the best match for kbSection too
    const kbEntriesEarly = kbContent.trim().length > 10 ? parseKBEntries(kbContent) : []

    // Try to match the conversation motivo/assunto against KB entries
    // If a specific entry is found, use ONLY that entry as kbSection to avoid mixing similar procedures
    const motivoQuery = `${conv.motivo} ${conv.assunto}`
    const preMatchedEntry = kbEntriesEarly.length > 0 ? matchKBEntry(motivoQuery, kbEntriesEarly) : null

    const relevantKb = preMatchedEntry
      ? preMatchedEntry.content
      : (kbContent.trim().length > 10 ? retrieveKB(`${conv.assunto} ${conv.motivo} ${conv.conv.slice(0, 400)}`, kbContent) : '')

    const kbSection = relevantKb
      ? `\n\nPROCEDIMENTO DA BASE DE CONHECIMENTO para "${conv.motivo}":\n${relevantKb}`
      : '\n\nAVISO: Nenhuma base de conhecimento foi carregada. Abra chamado técnico para qualquer problema que não consiga resolver com certeza.'

    const agentPromptText = agentPrompt
      ? agentPrompt.replace('{{KB}}', relevantKb || kbTrunc).replace('{{ASSUNTO}}', conv.assunto).replace('{{MOTIVO}}', conv.motivo) + '\n\n' + DEFAULT_AGENT_RULES
      : 'Você é um atendente de suporte técnico.' + '\n\n' + DEFAULT_AGENT_RULES

    // Immediate learning via prompt injection was removed — any extra text beyond the KB
    // procedure creates competing directives and causes hallucination.
    // Learning happens exclusively through batch fine-tuning (see runFinetune / Dados tab).
    const sysAgentBase = agentPromptText
    const sysAgent = agentPromptText + kbSection

    // Reuse already-parsed entries for per-turn lookup
    const kbEntries = kbEntriesEarly

    // Original context for client
    const origLines = conv.conv.split('\n').map(l => l.trim()).filter(Boolean)
    const origClient = origLines.filter(l => l.startsWith('[CLIENTE]:')).map(l => l.replace('[CLIENTE]:', '').trim())
    const origClientStr = origClient.slice(0, 10).map((l, i) => `${i + 1}. ${l}`).join('\n')

    const defaultClientContext = `Você é um cliente leigo ligando para suporte técnico com o seguinte problema:
${conv.assunto}

REGRAS ABSOLUTAS:
- Você NÃO tem acesso a nenhuma base de conhecimento, solução ou resposta da IA atendente
- Você NÃO sabe como resolver o problema — está ligando justamente porque não sabe
- Responda em 1-2 frases simples, como um leigo falaria ao telefone
- Quando o atendente der uma instrução: tente executar e relate o que aconteceu ("cliquei, apareceu X")
- Só confirme resolução APÓS o atendente perguntar "deu certo?" e você ter executado o último passo
- Se um passo der erro ou não funcionar: descreva o erro que apareceu na tela
- Forneça dados solicitados (CNPJ, nome, número de versão) de forma verossímil baseada no problema
- NUNCA peça para abrir chamado — deixe o atendente tomar essa decisão
- NUNCA antecipe a solução nem confirme resolução antes do momento certo
- Se o atendente der informações da base de conhecimento: reaja como um leigo que está tentando seguir as instruções, sem demonstrar que já sabe a resposta`

    const clientContext = clientPrompt.trim()
      ? clientPrompt.replace('{{ASSUNTO}}', conv.assunto).replace('{{FALAS_ORIGINAIS}}', origClientStr)
      : defaultClientContext

    const tx: Array<{ role: 'agent' | 'client'; text: string }> = []
    const aHist: Array<{ role: string; content: string }> = []
    const clientHist: Array<{ role: string; content: string }> = []
    let ticketOpened = false
    let resolved = false
    let agentStepCount = 0
    let agentAskedResult = false

    const stepRx = /clique|acesse|abra|selecione|marque|entre\s+no|vá\s+at|pressione|digite|informe|gere|execute|feche|reinicie|desative|ative|confirme|salve/i
    const askedResultRx = /deu\s+certo|conseguiu|funcionou|resolveu|apareceu|consegue\s+ver|está\s+(funcionando|aparecendo|abrindo)|ficou\s+(certo|ok)\?/i
    const agentClosedRx = /que\s+[oó]timo|fico\s+feliz|fico\s+contente|problema\s+resolvido|ficou\s+resolvido|foi\s+resolvido|atendimento\s+encerrado/i
    const ticketRx = /abrir(ei)?\s+(um\s+)?(chamado|ocorr[eê]ncia|ticket)|vou\s+(acionar|escalar|encaminhar)|t[eé]cnico|fora\s+do\s+(meu|nosso)\s+(alcance|escopo)/i
    const resolvedRx = /funcionou|deu\s+certo|resolveu|gerou|abriu\s+(certinho|certo)|foi\s+gerado|salvou|imprimiu|emitiu|t[áa]\s+funcionando|voltou\s+a\s+funcionar|consegui|deu\s+(sim|certo|!)|apareceu|t[áa]\s+(ok|certo|bom)|tudo\s+(ok|certo|bem|resolvido)|perfeito|resolvido/i

    const emit = (msg: { role: 'agent' | 'client'; text: string }) => {
      tx.push(msg)
      onTurn?.(msg)
    }

    // Track the active KB procedure across all turns — once identified, keep using it
    // even when the client stops mentioning the keyword (e.g. "Sim, estou com o Softshop aberto")
    let currentProcedure: { title: string; content: string } | null = preMatchedEntry

    // Agent greeting
    const greeting = await callAI([{ role: 'user', content: 'Inicie o atendimento. Cumprimente em UMA frase curta e pergunte diretamente qual é o problema.' }], sysAgent, 60, kbTrunc || undefined)
    emit({ role: 'agent', text: greeting })
    aHist.push({ role: 'user', content: greeting }, { role: 'assistant', content: greeting })
    clientHist.push({ role: 'user', content: `Atendente disse: "${greeting.slice(0, 100)}"\nApresente-se e descreva seu problema.` })

    for (let turn = 0; turn < maxTurns; turn++) {
      // Client turn
      let cr = await callClientAI(clientHist, clientContext, 90)
      cr = cr.replace(/\{[\s\S]*?["']name["']\s*:/g, '').replace(/\b\w+\s*\([^)]{0,200}\)/g, '').replace(/\n{3,}/g, '\n').trim()
      if (!cr) cr = 'Sim.'
      emit({ role: 'client', text: cr })
      clientHist.push({ role: 'assistant', content: cr })
      aHist.push({ role: 'user', content: cr })

      // Check resolution
      if (turn >= 2 && agentStepCount >= 1 && agentAskedResult && cr.trim().length < 120 && resolvedRx.test(cr.trim())) {
        resolved = true
        break
      }

      // Agent turn — only update currentProcedure from client messages when no procedure
      // was pre-matched from the motivo/assunto. If preMatchedEntry was found before the
      // simulation started, lock it for the entire conversation — prevents mid-turn switches
      // caused by the client accidentally mentioning a keyword from a different scenario
      // (e.g. "adquirente" triggering "Troca de Adquirente" during a SPED simulation).
      const aHistSlice = aHist.slice(-8)
      if (!preMatchedEntry) {
        const turnMatch = kbEntries.length > 0 ? matchKBEntry(cr, kbEntries) : null
        if (turnMatch) currentProcedure = turnMatch
      }
      const clientWaiting = /já solicit|já aguard|já tentei|ninguém ligou|não ligaram|semana|dias atrás|faz tempo/i.test(cr)
      const dynamicSys = currentProcedure
        ? sysAgentBase + `\n\nPROCEDIMENTO ÚNICO PARA ESTE ATENDIMENTO — "${currentProcedure.title}":\n${currentProcedure.content}\n\n=== INSTRUÇÃO OBRIGATÓRIA ===
Use APENAS o procedimento acima. PROIBIDO: usar qualquer outro procedimento, verificar chamados, inventar ações.
${clientWaiting
  ? `O cliente mencionou espera/solicitação anterior. IGNORE esse histórico.
Responda: "Entendo! Para resolver agora mesmo, posso te orientar pelo sistema. Você está com o [sistema] aberto?"`
  : `Continue o procedimento acima, UM PASSO POR VEZ. Aguarde confirmação antes do próximo passo.`}
=== FIM DA INSTRUÇÃO ===`
        : sysAgent
      let ar = await callAI(aHistSlice, dynamicSys, 280, currentProcedure?.content || kbTrunc || undefined)
      ar = ar.replace(/\{[\s\S]*?["']name["']\s*:/g, '').replace(/\b\w+\s*\([^)]{0,200}\)/g, '').replace(/\n{3,}/g, '\n').trim()
      if (!ar) ar = 'Certo, um momento.'
      emit({ role: 'agent', text: ar })
      aHist.push({ role: 'assistant', content: ar })

      if (stepRx.test(ar)) agentStepCount++
      if (askedResultRx.test(ar)) agentAskedResult = true

      if (ticketRx.test(ar)) {
        ticketOpened = true
        clientHist.push({ role: 'user', content: `Atendente disse: "${ar.slice(0, 200)}"\nEle vai abrir chamado. Responda resignado.` })
        const fr = await callClientAI(clientHist, clientContext, 50)
        emit({ role: 'client', text: fr })
        break
      }

      if (agentClosedRx.test(ar) && agentStepCount >= 1) {
        clientHist.push({ role: 'user', content: `Atendente disse: "${ar}"\nO problema foi resolvido? Confirme brevemente.` })
        const fc = await callClientAI(clientHist, clientContext, 80)
        emit({ role: 'client', text: fc })
        if (resolvedRx.test(fc)) resolved = true
        break
      }

      clientHist.push({ role: 'user', content: `Atendente disse: "${ar}"\nReaja: se deu instrução, tente e relate. Não confirme resolução antes de perguntarem.` })
    }

    let verdict: 'sim' | 'nao'
    let reason = ''
    if (resolved) {
      verdict = 'sim'
      reason = 'Cliente confirmou resolução após seguir os passos'
    } else if (ticketOpened) {
      verdict = 'nao'
      reason = 'Chamado aberto — problema não resolvido pela KB'
    } else {
      const txStr = tx.map(t => `[${t.role === 'agent' ? 'IA' : 'CLIENTE'}]: ${t.text}`).join('\n')
      const judgeQ = `Analise esta conversa. Problema: ${conv.assunto}\n\nCONVERSA:\n${txStr.slice(0, 4000)}\n\nResponda JSON: {"resolvivel":"sim"|"nao","motivo":"1 frase"}`
      const jRaw = await callAI([{ role: 'user', content: judgeQ }], null, 90)
      try {
        const p = JSON.parse(jRaw.replace(/```json|```/g, '').trim())
        verdict = p.resolvivel === 'sim' ? 'sim' : 'nao'
        reason = p.motivo || ''
      } catch {
        verdict = 'nao'
        reason = 'Erro ao avaliar'
      }
    }

    return { id: conv.id, assunto: conv.assunto, motivo: conv.motivo, verdict, reason, turns: tx.length, transcript: tx, ticketOpened }
  }

  async function runSimulations() {
    if (!apiKey && !useCustomApi) return alert('Configure a chave de API')
    if (conversations.length === 0) return alert('Carregue conversas primeiro')
    if (selectedIds.size === 0) return alert('Selecione conversas')

    setSimRunning(true)
    const toSim = conversations.filter(c => selectedIds.has(c.id))
    setSimProgress({ current: 0, total: toSim.length })
    setLiveTranscripts({})
    if (toSim.length > 0) setWatchingId(toSim[0].id)

    const results = { ...simResults }
    let current = 0

    let completed = 0

    const workers = Array.from({ length: Math.min(concurrency, toSim.length) }, async () => {
      while (current < toSim.length) {
        const idx = current++
        if (idx >= toSim.length) break
        const conv = toSim[idx]
        try {
          const res = await simulateOne(conv, (msg) => {
            setLiveTranscripts(prev => ({
              ...prev,
              [conv.id]: [...(prev[conv.id] || []), msg],
            }))
            setWatchingId(id => id ?? conv.id)
          })
          results[conv.id] = res
          completed++
          setSimProgress({ current: completed, total: toSim.length })
          saveResults(results)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Erro desconhecido'
          results[conv.id] = { id: conv.id, assunto: conv.assunto, motivo: conv.motivo, verdict: 'erro', reason: msg, turns: 0, transcript: [], ticketOpened: false }
          completed++
          setSimProgress({ current: completed, total: toSim.length })
          saveResults(results)
          if (/credit|balance|quota|invalid.*key|unauthorized|forbidden/i.test(msg)) {
            setSimRunning(false)
            return alert('Erro de API: ' + msg.slice(0, 100))
          }
        }
      }
    })

    await Promise.all(workers)
    setSimRunning(false)
  }

  // ---------------------------------------------------------------------------
  // Charts
  // ---------------------------------------------------------------------------
  const allResults = Object.values(simResults).filter(r => r.verdict !== 'erro')
  const simCount = allResults.filter(r => r.verdict === 'sim').length
  const naoCount = allResults.filter(r => r.verdict === 'nao').length
  const totalCount = allResults.length

  const byMotive: Record<string, { s: number; n: number; t: number }> = {}
  allResults.forEach(r => {
    const m = r.motivo || 'Outros'
    if (!byMotive[m]) byMotive[m] = { s: 0, n: 0, t: 0 }
    byMotive[m][r.verdict === 'sim' ? 's' : 'n']++
    byMotive[m].t++
  })
  const sorted = Object.entries(byMotive).sort((a, b) => b[1].t - a[1].t)

  const donutData = {
    labels: ['Resolvível pela KB', 'Não resolvido'],
    datasets: [{ data: [simCount, naoCount], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, hoverOffset: 6 }],
  }

  const barData = {
    labels: sorted.map(([m]) => m),
    datasets: [{
      label: '% Resolvível',
      data: sorted.map(([, v]) => v.t > 0 ? Math.round(v.s / v.t * 100) : 0),
      backgroundColor: sorted.map(([, v]) => v.t > 0 && v.s / v.t >= 0.5 ? '#22c55e' : '#ef4444'),
      borderRadius: 4,
    }],
  }

  const stackedData = {
    labels: sorted.map(([m]) => m),
    datasets: [
      { label: 'Resolvível pela KB', data: sorted.map(([, v]) => v.s), backgroundColor: '#22c55e' },
      { label: 'Não resolvido', data: sorted.map(([, v]) => v.n), backgroundColor: '#ef4444' },
    ],
  }

  // ---------------------------------------------------------------------------
  // Panel content
  // ---------------------------------------------------------------------------
  const panelContent: Record<Panel, React.ReactNode> = {
    config: (
      <div className="space-y-6">
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Brain size={16} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Configuração de API</h2>
                <p className="text-xs text-muted">Compatível com qualquer endpoint OpenAI</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
                  <input type="checkbox" checked={useCustomApi} onChange={e => {
                    setUseCustomApi(e.target.checked)
                    if (e.target.checked) {
                      setCustomApiUrl(`${window.location.origin}/api/ai/chat`)
                      const v1 = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL
                      if (v1) { setApiModel(v1); localStorage.setItem('nexus_sim_api_model', v1) }
                    }
                  }} className="rounded border-glass-border" />
                  Usar API customizada (Nexus local)
                </label>
              </div>
              {!useCustomApi && (
                <>
                  <div>
                    <label className="block text-xs text-secondary mb-1">Chave de API</label>
                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('nexus_sim_api_key', e.target.value) }}
                      className="w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50"
                      placeholder="sk-..." />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">
                      Modelo
                      {apiModel !== 'gpt-4o-mini' && (
                        <span className="ml-2 text-[10px] text-orange-400">(fine-tunado)</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input type="text" value={apiModel} onChange={e => { setApiModel(e.target.value); localStorage.setItem('nexus_sim_api_model', e.target.value) }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50"
                        placeholder="gpt-4o-mini" />
                      {apiModel !== 'gpt-4o-mini' && (
                        <button
                          onClick={() => { setApiModel('gpt-4o-mini'); localStorage.setItem('nexus_sim_api_model', 'gpt-4o-mini') }}
                          className="px-3 py-2 rounded-xl text-xs border border-glass-border text-secondary hover:text-primary hover:bg-glass-hover transition-all whitespace-nowrap"
                          title="Voltar para o modelo base">
                          ↺ Base
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
              {useCustomApi && (
                <>
                  <div>
                    <label className="block text-xs text-secondary mb-1">URL do endpoint Nexus</label>
                    <input type="text" value={customApiUrl} onChange={e => setCustomApiUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50"
                      placeholder={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3008'}/api/ai/chat`} />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">Modelo</label>
                    <select value={apiModel} onChange={e => { setApiModel(e.target.value); localStorage.setItem('nexus_sim_api_model', e.target.value) }}
                      className="w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50">
                      {process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL && (
                        <option value={process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL}>Nexus AI</option>
                      )}
                      <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">Produto <span className="text-muted">(opcional — filtra a base de conhecimento)</span></label>
                    <select value={selectedProductSlug} onChange={e => setSelectedProductSlug(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-glass border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50">
                      <option value="">Todos os produtos</option>
                      {products.map(p => (
                        <option key={p.slug} value={p.slug}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {apiKey.length > 10 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
                  <CheckCircle size={12} /> Chave configurada — pronto para simular
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Prompt do Agente</h2>
                <p className="text-xs text-muted">Como a IA de atendimento deve se comportar</p>
              </div>
            </div>
            <textarea value={agentPrompt} onChange={e => { setAgentPrompt(e.target.value); localStorage.setItem('nexus_sim_agent_prompt', e.target.value) }}
              className="w-full px-4 py-3 rounded-xl bg-glass border border-glass-border text-primary text-xs focus:outline-none focus:border-orange-500/50 resize-none"
              rows={6} placeholder="Cole o system prompt da sua IA de atendimento..." />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['{{KB}}', '{{ASSUNTO}}', '{{MOTIVO}}'].map(tag => (
                <button key={tag} onClick={() => {
                  const ta = document.querySelector('textarea[placeholder*="system prompt"]') as HTMLTextAreaElement
                  if (ta) { const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + tag + ta.value.slice(ta.selectionEnd); ta.focus() }
                }}
                  className="px-2 py-1 rounded text-[10px] font-mono bg-glass border border-glass-border text-secondary hover:border-orange-500/30 hover:text-orange-400 transition-all">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <MessageSquare size={16} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Prompt do Cliente</h2>
                <p className="text-xs text-muted">Como o cliente simulado deve se comportar</p>
              </div>
            </div>
            <textarea value={clientPrompt} onChange={e => { setClientPrompt(e.target.value); localStorage.setItem('nexus_sim_client_prompt', e.target.value) }}
              className="w-full px-4 py-3 rounded-xl bg-glass border border-glass-border text-primary text-xs focus:outline-none focus:border-blue-500/50 resize-none"
              rows={6} placeholder="Deixe em branco para usar o comportamento padrão do cliente (recomendado).&#10;&#10;Variáveis disponíveis: {{ASSUNTO}}, {{FALAS_ORIGINAIS}}" />
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['{{ASSUNTO}}', '{{FALAS_ORIGINAIS}}'].map(tag => (
                <button key={tag} onClick={() => {
                  const newVal = clientPrompt + tag
                  setClientPrompt(newVal)
                  localStorage.setItem('nexus_sim_client_prompt', newVal)
                }}
                  className="px-2 py-1 rounded text-[10px] font-mono bg-glass border border-glass-border text-secondary hover:border-blue-500/30 hover:text-blue-400 transition-all">
                  {tag}
                </button>
              ))}
              {clientPrompt && (
                <button onClick={() => { setClientPrompt(''); localStorage.removeItem('nexus_sim_client_prompt') }}
                  className="px-2 py-1 rounded text-[10px] bg-glass border border-glass-border text-red-400 hover:border-red-500/40 transition-all ml-auto">
                  ↺ Restaurar padrão
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Play size={16} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-primary">Parâmetros</h2>
                <p className="text-xs text-muted">Velocidade e comportamento das simulações</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-secondary mb-2">Simulações simultâneas: <span className="text-orange-400">{concurrency}</span></label>
                <input type="range" min="1" max="20" value={concurrency} onChange={e => setConcurrency(parseInt(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-2">Máx. turnos por conversa: <span className="text-orange-400">{maxTurns}</span></label>
                <input type="range" min="3" max="16" value={maxTurns} onChange={e => setMaxTurns(parseInt(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    ),

    dados: (
      <div className="space-y-6">
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <FileText size={16} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary">Base de Conhecimento</h2>
                  <p className="text-xs text-muted">KB usada pela IA nas respostas simuladas (opcional)</p>
                </div>
              </div>
              {kbFileName && <Button variant="danger" size="sm" onClick={() => { setKbContent(''); setKbFileName('') }}>↺ Restaurar</Button>}
            </div>
            <div className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${kbFileName ? 'border-green-500/40 bg-green-500/5' : 'border-glass-border hover:border-orange-500/30 hover:bg-orange-500/5'}`}>
              <input type="file" accept=".txt,.md,.json" onChange={e => e.target.files?.[0] && handleKBUpload(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload size={24} className={`mx-auto mb-2 ${kbFileName ? 'text-green-400' : 'text-muted'}`} />
              {kbFileName ? (
                <div className="text-sm text-green-400 font-medium">✓ {kbFileName}</div>
              ) : (
                <>
                  <div className="text-sm text-secondary font-medium mb-1">Arrastar ou clicar para carregar a KB</div>
                  <div className="text-xs text-muted">.txt · .md · .json — Opcional, a IA usará conhecimento interno</div>
                </>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-orange-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary">Conversas</h2>
                  <p className="text-xs text-muted">{conversations.length} conversas carregadas</p>
                </div>
              </div>
              {(conversations.length > 0 || Object.keys(simResults).length > 0) && (
                <Button variant="danger" size="sm" onClick={() => {
                  setConversations([])
                  setConvFileName('')
                  setSelectedIds(new Set())
                  setSimResults({})
                  setLiveTranscripts({})
                  setWatchingId(null)
                  setSimProgress({ current: 0, total: 0 })
                  try { localStorage.removeItem('nexus_sim_results') } catch { /* ignore */ }
                }}>↺ Limpar tudo</Button>
              )}
            </div>
            <div className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${convFileName ? 'border-green-500/40 bg-green-500/5' : 'border-glass-border hover:border-orange-500/30 hover:bg-orange-500/5'}`}>
              <input type="file" accept=".json" onChange={e => e.target.files?.[0] && handleConvUpload(e.target.files[0], 'replace')}
                className="absolute inset-0 opacity-0 cursor-pointer" />
              <Upload size={24} className={`mx-auto mb-2 ${convFileName ? 'text-green-400' : 'text-muted'}`} />
              {convFileName ? (
                <div className="text-sm text-green-400 font-medium">✓ {convFileName} · {conversations.length} conversas</div>
              ) : (
                <>
                  <div className="text-sm text-secondary font-medium mb-1">Arrastar ou clicar para carregar conversas</div>
                  <div className="text-xs text-muted">.json — Array de atendimentos</div>
                </>
              )}
            </div>
          </div>
        </GlassCard>

        {/* Reinforcement Learning card */}
        <GlassCard>
          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Brain size={16} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-primary">Aprendizado Reforçado</h2>
                  <p className="text-xs text-muted">Fine-tuning acumulado com suas avaliações</p>
                </div>
              </div>
              {trainingCount > 0 && (
                <button onClick={() => {
                  localStorage.removeItem('nexus_sim_training')
                  localStorage.removeItem('nexus_sim_hints')
                  setTrainingCount(0)
                  setPositiveCount(0)
                  setNegativeCount(0)
                }} className="px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-all">
                  Limpar tudo
                </button>
              )}
            </div>

            {trainingCount === 0 ? (
              <p className="text-xs text-muted">Avalie simulações com 👍/👎 para acumular exemplos de treinamento.</p>
            ) : (
              <>
                {/* Counters */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs text-secondary"><span className="text-green-400 font-semibold">{positiveCount}</span> positivos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs text-secondary"><span className="text-red-400 font-semibold">{negativeCount}</span> negativos</span>
                  </div>
                </div>

                {/* Progress toward threshold — based on positive examples (OpenAI requires min 10) */}
                {positiveCount < 10 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">Positivos para treino (mínimo exigido pela OpenAI)</span>
                      <span className="text-[11px] text-purple-400 font-medium">{positiveCount}/10</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-purple-500/60 transition-all duration-500"
                        style={{ width: `${Math.min(positiveCount / 10 * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted">
                      {10 - positiveCount} avaliação{10 - positiveCount !== 1 ? 'ões' : ''} positiva{10 - positiveCount !== 1 ? 's' : ''} para atingir o mínimo · avaliações negativas ensinam o que evitar
                    </p>
                  </div>
                )}

                {/* Fine-tune button */}
                <div className="flex items-center gap-3">
                  <button
                    disabled={finetuneSending || finetuneStatus === 'pending' || positiveCount < 10}
                    onClick={runFinetune}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      positiveCount >= 10
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                        : 'bg-glass border-glass-border text-secondary hover:bg-glass-hover'
                    }`}
                  >
                    <Brain size={13} />
                    {finetuneSending ? 'Enviando para treino...' :
                      finetuneStatus === 'pending' ? 'Treino em andamento...' :
                      positiveCount >= 10 ? `Treinar modelo (${positiveCount} positivos + ${negativeCount} correções)` :
                      `Aguardando mínimo (${positiveCount}/10 positivos)`}
                  </button>
                  {positiveCount >= 10 && (
                    <span className="text-[10px] text-purple-400/70">Mínimo atingido ✓</span>
                  )}
                </div>

                {/* Job status */}
                {finetuneStatus === 'pending' && finetuneJobId && (
                  <div className="flex items-center gap-2 text-[11px] text-orange-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    Fine-tuning em andamento · {finetuneJobId.slice(0, 28)}…
                  </div>
                )}
                {finetuneStatus === 'succeeded' && (
                  <div className="flex items-center gap-2 text-[11px] text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Modelo atualizado com sucesso
                  </div>
                )}
              </>
            )}
          </div>
        </GlassCard>
      </div>
    ),

    simular: (
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{selectedIds.size} selecionadas de {conversations.length}</span>
            {(conversations.length > 0 || Object.keys(simResults).length > 0) && (
              <Button variant="danger" size="sm" disabled={simRunning} onClick={() => {
                setConversations([])
                setConvFileName('')
                setSelectedIds(new Set())
                setSimResults({})
                setLiveTranscripts({})
                setWatchingId(null)
                setSimProgress({ current: 0, total: 0 })
                try { localStorage.removeItem('nexus_sim_results') } catch { /* ignore */ }
              }}>↺ Limpar histórico</Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => {
              if (selectedIds.size === conversations.length) setSelectedIds(new Set())
              else setSelectedIds(new Set(conversations.map(c => c.id)))
            }}>
              {selectedIds.size === conversations.length ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
            <Button variant="primary" size="sm" disabled={simRunning || selectedIds.size === 0} onClick={runSimulations}>
              {simRunning ? <><Spinner size="sm" /> Simulando... ({simProgress.current}/{simProgress.total})</> : <><Play size={14} /> Simular</>}
            </Button>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Database size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold text-secondary mb-1">Nenhuma conversa carregada</p>
            <p className="text-sm">Carregue conversas na aba Dados para começar</p>
          </div>
        ) : (
          <div className="grid grid-cols-[280px_1fr] gap-4" style={{ height: 'calc(100vh - 260px)' }}>
            {/* Lista de conversas */}
            <GlassCard className="h-full overflow-hidden">
              <div className="h-full overflow-y-auto">
                {conversations.map(conv => {
                  const isSelected = selectedIds.has(conv.id)
                  const result = simResults[conv.id]
                  const isWatching = watchingId === conv.id
                  const isLive = liveTranscripts[conv.id] && !result
                  return (
                    <div key={conv.id}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-glass-border transition-all ${isWatching ? 'bg-orange-500/10 border-l-2 border-l-orange-500' : 'cursor-pointer hover:bg-glass-hover'}`}
                      onClick={() => {
                        setWatchingId(conv.id)
                        if (!simRunning) {
                          const next = new Set(selectedIds)
                          next.has(conv.id) ? next.delete(conv.id) : next.add(conv.id)
                          setSelectedIds(next)
                        }
                      }}>
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-orange-500/70 border-orange-500' : 'border-glass-border'}`}>
                        {isSelected && <CheckCircle size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted">#{conv.id}</span>
                          {isLive && <span className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
                          {result && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${result.verdict === 'sim' ? 'bg-green-400' : result.verdict === 'erro' ? 'bg-amber-400' : 'bg-red-400'}`} />}
                        </div>
                        <p className="text-xs text-primary truncate">{conv.assunto.slice(0, 60)}</p>
                        <p className="text-[10px] text-muted">{conv.motivo}</p>
                      </div>
                      {result && <Badge variant={result.verdict === 'sim' ? 'instruction' : 'error'} className="text-[9px] flex-shrink-0">{result.verdict === 'sim' ? '✓' : result.verdict === 'erro' ? '!' : '✗'}</Badge>}
                    </div>
                  )
                })}
              </div>
            </GlassCard>

            {/* Chat ao vivo */}
            <GlassCard className="h-full overflow-hidden">
              <div className="h-full flex flex-col">
                {watchingId == null ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted">
                    <MessageSquare size={40} className="opacity-20 mb-3" />
                    <p className="text-sm">Selecione uma conversa para visualizar</p>
                  </div>
                ) : (() => {
                  const conv = conversations.find(c => c.id === watchingId)
                  const result = simResults[watchingId]
                  const msgs = liveTranscripts[watchingId] || result?.transcript || []
                  return (
                    <>
                      {/* Header do chat */}
                      <div className="px-5 py-3 border-b border-glass-border flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-[11px]">🤖</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary truncate">{conv?.assunto?.slice(0, 80) || `Conversa #${watchingId}`}</p>
                            <p className="text-[10px] text-muted">{conv?.motivo || ''}</p>
                          </div>
                          {result && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${result.verdict === 'sim' ? 'bg-green-500/15 text-green-400' : result.verdict === 'erro' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                              {result.verdict === 'sim' ? 'Resolvido' : result.verdict === 'erro' ? 'Erro' : 'Não resolvido'}
                            </span>
                          )}
                          {!result && liveTranscripts[watchingId] && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> Ao vivo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mensagens */}
                      <div ref={liveChatRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                        {msgs.length === 0 && (
                          <div className="flex items-center justify-center h-full text-muted text-sm">
                            {simRunning ? <><Spinner size="sm" /><span className="ml-2">Aguardando início...</span></> : 'Nenhuma mensagem'}
                          </div>
                        )}
                        {msgs.map((m, i) => (
                          <div key={i} className={`flex gap-2.5 ${m.role === 'client' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] mt-0.5 ${m.role === 'agent' ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                              {m.role === 'agent' ? '🤖' : '👤'}
                            </div>
                            <div className={`max-w-[75%] ${m.role === 'client' ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                              <span className={`text-[9px] uppercase tracking-wider font-medium ${m.role === 'agent' ? 'text-orange-400/70' : 'text-blue-400/70'}`}>
                                {m.role === 'agent' ? 'IA Atendente' : 'Cliente'}
                              </span>
                              <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${m.role === 'agent' ? 'bg-white/5 border border-white/8 text-primary rounded-tl-sm' : 'bg-blue-500/10 border border-blue-500/20 text-blue-100 rounded-tr-sm'}`}>
                                {m.text}
                              </div>
                            </div>
                          </div>
                        ))}
                        {simRunning && liveTranscripts[watchingId] && !result && (
                          <div className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0 flex items-center justify-center text-[11px]">🤖</div>
                            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-white/5 border border-white/8 flex items-center gap-1.5">
                              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />)}
                            </div>
                          </div>
                        )}

                        {/* Feedback — aparece assim que o resultado desta conversa estiver disponível */}
                        {result && (
                          <div className="border border-glass-border rounded-xl p-3 bg-black/10 mt-2">
                            {result.reason && (
                              <p className="text-[11px] text-muted mb-3"><span className="text-secondary font-medium">Avaliação: </span>{result.reason}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] text-muted">Esta simulação foi útil para treinar a IA?</p>
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={simFeedbackSending[watchingId]}
                                  onClick={() => selectSimFeedback(watchingId, 'positive')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${result.feedback === 'positive' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-glass border-glass-border text-secondary hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}>
                                  <ThumbsUp size={13} /> Boa
                                </button>
                                <button
                                  disabled={simFeedbackSending[watchingId]}
                                  onClick={() => selectSimFeedback(watchingId, 'negative')}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${result.feedback === 'negative' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-glass border-glass-border text-secondary hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'}`}>
                                  <ThumbsDown size={13} /> Ruim
                                </button>
                              </div>
                            </div>

                            {simFeedbackOpen[watchingId] && (
                              <div className="mt-3 space-y-2">
                                <label className="text-[11px] text-secondary">
                                  {result.feedback === 'negative'
                                    ? <>Instrução / Observação <span className="text-muted">(descreva o erro OU o passo a passo correto)</span></>
                                    : <>Justificativa <span className="text-muted">(opcional)</span></>}
                                </label>
                                <textarea
                                  rows={2}
                                  value={simFeedbackNotes[watchingId] ?? ''}
                                  onChange={e => setSimFeedbackNotes(prev => ({ ...prev, [watchingId]: e.target.value }))}
                                  placeholder={result.feedback === 'negative'
                                    ? 'Ex: Para SPED fiscal: 1. Solicitar CNPJ, 2. Abrir o módulo X, 3. Gerar o arquivo... — ou descreva o que foi errado'
                                    : 'Ex: A IA resolveu corretamente sem precisar abrir chamado...'}
                                  className="w-full px-3 py-2 rounded-xl bg-glass border border-glass-border text-primary text-xs focus:outline-none focus:border-orange-500/50 resize-none placeholder:text-muted"
                                />
                                <div className="flex items-center justify-between">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border ${result.feedback === 'positive' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    {result.feedback === 'positive' ? '👍 Positivo' : '👎 Negativo'}
                                  </span>
                                  <button
                                    disabled={simFeedbackSending[watchingId]}
                                    onClick={() => saveSimFeedback(watchingId)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 transition-all disabled:opacity-50">
                                    {simFeedbackSending[watchingId]
                                      ? (result.feedback === 'positive' ? 'Enviando para fine-tuning...' : 'Salvando...')
                                      : 'Salvar avaliação'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {!simFeedbackOpen[watchingId] && result.feedback && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-muted">
                                  {result.feedbackNote
                                    ? `Avaliação salva · "${result.feedbackNote.slice(0, 60)}${result.feedbackNote.length > 60 ? '…' : ''}"`
                                    : 'Avaliação salva — adicione uma justificativa para enriquecer o treinamento'}
                                </p>
                                {result.feedback === 'positive' && finetuneJobId && (
                                  <p className="text-[10px] text-purple-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
                                    Fine-tuning enviado · Job: {finetuneJobId.slice(0, 24)}…
                                  </p>
                                )}
                                {result.feedback === 'positive' && !finetuneJobId && (
                                  <p className="text-[10px] text-green-400/70">Salvo para aprendizado em contexto</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    ),

    resultados: (
      <div className="space-y-6">
        {totalCount === 0 && (
          <div className="text-center py-16 text-muted">
            <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold text-secondary mb-1">Sem resultados ainda</p>
            <p className="text-sm">Execute simulações na aba Simular para ver os gráficos</p>
          </div>
        )}

        {totalCount > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4">
              <GlassCard>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Resolvível KB</p>
                  <p className="text-3xl font-bold text-green-400">{totalCount > 0 ? Math.round(simCount / totalCount * 100) : 0}%</p>
                  <p className="text-xs text-muted">{simCount} de {totalCount}</p>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Não resolvido</p>
                  <p className="text-3xl font-bold text-red-400">{totalCount > 0 ? Math.round(naoCount / totalCount * 100) : 0}%</p>
                  <p className="text-xs text-muted">{naoCount} de {totalCount}</p>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Total simulado</p>
                  <p className="text-3xl font-bold text-orange-400">{totalCount}</p>
                  <p className="text-xs text-muted">conversas</p>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted uppercase tracking-wider mb-1">Erros</p>
                  <p className="text-3xl font-bold text-amber-400">{Object.values(simResults).filter(r => r.verdict === 'erro').length}</p>
                  <p className="text-xs text-muted">falhas de API</p>
                </div>
              </GlassCard>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <GlassCard>
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-primary mb-4">Distribuição geral</h3>
                  <div className="h-64">
                    <Doughnut data={donutData} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { color: '#8A8A85', padding: 12, boxWidth: 10 } } },
                    }} />
                  </div>
                </div>
              </GlassCard>
              <GlassCard>
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-primary mb-4">% Resolvível por motivo</h3>
                  <div className="h-64">
                    <Bar data={barData} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { ticks: { color: '#8A8A85', font: { size: 9 }, maxRotation: 50 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        y: { min: 0, max: 100, ticks: { callback: (v: string | number) => v + '%', color: '#8A8A85', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      },
                    }} />
                  </div>
                </div>
              </GlassCard>
            </div>

            <GlassCard>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-primary mb-4">Volume por motivo</h3>
                <div className="h-64">
                  <Bar data={stackedData} options={{
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { position: 'bottom', labels: { color: '#8A8A85', padding: 12, boxWidth: 10 } } },
                    scales: {
                      x: { stacked: true, ticks: { color: '#8A8A85' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                      y: { stacked: true, ticks: { color: '#8A8A85', font: { size: 10 } }, grid: { display: false } },
                    },
                  }} />
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-primary mb-4">Detalhamento por motivo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-glass-border">
                        <th className="text-left py-2 text-xs text-muted uppercase tracking-wider font-normal">Motivo</th>
                        <th className="text-center py-2 text-xs text-muted uppercase tracking-wider font-normal">Total</th>
                        <th className="text-center py-2 text-xs text-muted uppercase tracking-wider font-normal">Resolvível</th>
                        <th className="text-center py-2 text-xs text-muted uppercase tracking-wider font-normal">Não resolvido</th>
                        <th className="text-center py-2 text-xs text-muted uppercase tracking-wider font-normal">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(([m, v]) => {
                        const pct = v.t > 0 ? Math.round(v.s / v.t * 100) : 0
                        const col = pct >= 50 ? '#22c55e' : '#ef4444'
                        return (
                          <tr key={m} className="border-b border-glass-border/50">
                            <td className="py-2 text-primary font-medium">{m}</td>
                            <td className="py-2 text-center font-mono text-secondary">{v.t}</td>
                            <td className="py-2 text-center"><Badge variant="instruction">{v.s}</Badge></td>
                            <td className="py-2 text-center"><Badge variant="error">{v.n}</Badge></td>
                            <td className="py-2 text-center font-mono font-bold" style={{ color: col }}>{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-primary">Amostra de simulações</h3>
                  <div className="flex gap-1.5">
                    {(['all', 'sim', 'nao'] as const).map(f => (
                      <button key={f} onClick={() => setSampleFilter(f)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${sampleFilter === f ? 'bg-orange-500 text-white' : 'bg-glass text-secondary hover:text-primary border border-glass-border'}`}>
                        {f === 'all' ? 'Todos' : f === 'sim' ? 'Resolvido' : 'Não resolvido'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {Object.values(simResults)
                    .filter(r => sampleFilter === 'all' || r.verdict === sampleFilter)
                    .slice(-60).reverse()
                    .map(r => (
                      <div key={r.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-glass">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-muted">#{r.id}</span>
                            <Badge variant={r.verdict === 'sim' ? 'instruction' : r.verdict === 'erro' ? 'error' : 'error'}>
                              {r.verdict === 'sim' ? 'Resolvível' : r.verdict === 'erro' ? 'Erro API' : 'Não resolvido'}
                            </Badge>
                            <span className="text-[10px] text-muted">{r.motivo}</span>
                          </div>
                          <p className="text-xs text-primary truncate">{r.assunto.slice(0, 100)}</p>
                          <p className="text-[10px] text-muted mt-0.5">{r.reason.slice(0, 120)}</p>
                        </div>
                        {r.transcript.length > 0 && (
                          <button onClick={() => setKwMenuOpen(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-purple-400 hover:bg-purple-500/10 transition-all">
                            {kwMenuOpen[r.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            Conversa
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </GlassCard>

            {/* Conversation detail panels */}
            {Object.entries(kwMenuOpen).filter(([, open]) => open).map(([idStr]) => {
              const id = parseInt(idStr)
              const result = simResults[id]
              if (!result) return null
              return (
                <GlassCard key={id}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-primary">Conversa #{result.id} — {result.assunto.slice(0, 60)}</h3>
                      <button onClick={() => setKwMenuOpen(prev => ({ ...prev, [id]: false }))} className="text-muted hover:text-primary text-xs">Fechar</button>
                    </div>
                    <div className="space-y-2 h-[60vh] overflow-y-auto pr-1">
                      {result.transcript.map((t, i) => (
                        <div key={i} className={`flex ${t.role === 'agent' ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[70%] px-3 py-2 rounded-lg text-xs ${t.role === 'agent' ? 'bg-glass text-primary border border-glass-border' : 'bg-orange-500/10 text-orange-200 border border-orange-500/20'}`}>
                            <p className="text-[9px] uppercase tracking-wider text-muted mb-0.5">{t.role === 'agent' ? 'IA' : 'Cliente'}</p>
                            {t.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )
            })}

            <div className="flex justify-end gap-3">
              <Button variant="danger" size="sm" onClick={() => {
                if (confirm('Limpar todo o histórico de simulações?')) {
                  saveResults({})
                  localStorage.removeItem('nexus_sim_results')
                  setKwMenuOpen({})
                }
              }}>Limpar histórico</Button>
              <Button variant="secondary" size="sm" onClick={() => {
                const blob = new Blob([JSON.stringify(Object.values(simResults).map(r => ({ ...r, transcript: undefined })), null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'simulacoes.json'; a.click()
                URL.revokeObjectURL(url)
              }}>Exportar JSON</Button>
            </div>
          </>
        )}
      </div>
    ),
  }

  const panelTitles: Record<Panel, [string, string]> = {
    config: ['Configurar', 'Configure a chave de API e parâmetros da simulação'],
    dados: ['Gerenciar Dados', 'Substitua a base de conhecimento e os arquivos de conversas'],
    simular: ['Simular Atendimentos', 'Selecione conversas, configure o prompt e simule com sua IA'],
    resultados: ['Resultados Gerais', 'Gráficos e análise de todas as simulações realizadas'],
  }

  return (
    <div>
      {/* Fine-tuning notification toast */}
      {finetuneNotif && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium transition-all ${finetuneStatus === 'succeeded' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-red-500/20 border-red-500/40 text-red-300'}`}>
          {finetuneStatus === 'succeeded'
            ? <><span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />{finetuneNotif}</>
            : <><span className="w-2 h-2 rounded-full bg-red-400" />{finetuneNotif}</>}
          <button onClick={() => setFinetuneNotif(null)} className="ml-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Fine-tuning pending indicator */}
      {finetuneStatus === 'pending' && finetuneJobId && !finetuneNotif && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl border bg-orange-500/10 border-orange-500/25 text-orange-300 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Fine-tuning em andamento…
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-primary">{panelTitles[panel][0]}</h1>
        <p className="text-secondary mt-1 text-sm">{panelTitles[panel][1]}</p>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Side nav */}
        <div className="space-y-1">
          {navItems.map(item => (
            <button key={item.key} onClick={() => setPanel(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${panel === item.key ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20' : 'text-secondary hover:text-primary hover:bg-glass border border-transparent'}`}>
              {item.icon}
              {item.label}
              {item.key === 'resultados' && totalCount > 0 && (
                <span className="ml-auto text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">{totalCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div>{panelContent[panel]}</div>
      </div>
    </div>
  )
}
