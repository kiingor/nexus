'use client'

import { useEffect, useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { Building2, Phone, MessageSquare, Star, Monitor, Calendar, DollarSign, Smile, Copy, Check, ShieldCheck, X, Pin, Trash2 } from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'
import { formatCusto, formatDuracao, parseTranscricao, sentimentoBadge } from '@/lib/atendimentos'
import { getSupabaseClient } from '@/lib/supabase/client'
import { VincularCenarioModal } from '@/components/atendimentos/VincularCenarioModal'

interface Props {
  record: AtendimentoRecord | null
  open: boolean
  onClose: () => void
  avaliacoes: AvaliacaoAtendimentoRecord[]
  loadingAvaliacoes: boolean
  /**
   * Quando o atendimento veio de um grupo "unido" (mesma empresa, gap < 5min),
   * passa todos os registros do grupo aqui em ordem cronológica ascendente.
   * O modal renderiza abas "Atendimento 1..N" pra navegar entre eles.
   * Vazio ou undefined = atendimento isolado, sem abas.
   */
  group?: AtendimentoRecord[]
  /**
   * Chamado ao trocar de aba — a página usa pra recarregar avaliações do
   * registro selecionado.
   */
  onSelectRecord?: (record: AtendimentoRecord) => void
  /**
   * Chamado após uma validação ser salva, com o atendimento atualizado.
   * Permite a página refletir validado/comentário sem refetch da lista.
   */
  onValidationSaved?: (updated: AtendimentoRecord) => void
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}


export function AtendimentoDetailModal({
  record,
  open,
  onClose,
  avaliacoes,
  loadingAvaliacoes,
  group,
  onSelectRecord,
  onValidationSaved,
}: Props) {
  if (!record) return null

  const detail = record
  const problema = detail.problema_extraido
  const temProblema = problema?.tem_problema_extraivel === true
  const isChat = detail.tipo_contato === 'chat'

  // Abas só aparecem quando vieram >1 atendimentos no grupo. Mantemos a
  // ordem cronológica ascendente: "Atendimento 1" = mais antigo.
  const hasTabs = Array.isArray(group) && group.length > 1
  const activeIndex = hasTabs ? group!.findIndex((r) => r.id === record.id) : -1

  return (
    <GlassModal open={open} onClose={onClose} title="Detalhes do Atendimento" className="max-w-4xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
        {hasTabs && (
          <div className="flex items-center gap-1.5 flex-wrap border-b border-glass-border pb-3">
            <span className="text-[10px] uppercase tracking-wider text-muted mr-2">
              {group!.length} atendimentos unidos
            </span>
            {group!.map((r, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    if (!isActive && onSelectRecord) onSelectRecord(r)
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/30'
                  }`}
                  title={`ID #${r.id}${r.data_hora_chegada ? ' · ' + fmt(r.data_hora_chegada) : ''}`}
                >
                  Atendimento {idx + 1}
                </button>
              )
            })}
          </div>
        )}

        <ValidationSection record={detail} onSaved={onValidationSaved} />
        <ExamplesSection record={detail} />

        {/* Header — só faz sentido em ligação (chat não tem início/fim/duração/custo) */}
        {!isChat && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Meta icon={<Calendar size={12} />} label="Início" value={fmt(detail.data_hora_chegada)} />
            <Meta icon={<Calendar size={12} />} label="Fim" value={fmt(detail.data_hora_saida)} />
            <Meta label="Duração" value={formatDuracao(detail.duracao_segundos)} />
            <Meta icon={<DollarSign size={12} />} label="Custo" value={formatCusto(detail.custo_real)} />
          </div>
        )}

        {/* Sentimento + ID Ligação — escondido em chat */}
        {!isChat && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="glass p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
                <Smile size={12} />
                Sentimento do cliente
              </div>
              {(() => {
                const b = sentimentoBadge(detail.sentimento_cliente)
                return b ? (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${b.cls}`}
                  >
                    {b.label}
                  </span>
                ) : (
                  <p className="text-sm text-muted">—</p>
                )
              })()}
            </div>
            <IdLigacaoMeta value={detail.id_ligacao} />
          </div>
        )}

        {/* Cliente — em chat oculta AnyDesk (não se aplica) */}
        <Section title="Cliente">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Meta icon={<Building2 size={12} />} label="Empresa" value={detail.nome_empresa} />
            <Meta label="CNPJ" value={detail.cnpj} />
            <Meta label="Cliente" value={detail.cliente_nome} />
            <Meta icon={<Phone size={12} />} label="Telefone" value={detail.phone} />
            <Meta icon={<MessageSquare size={12} />} label="WhatsApp" value={detail.whatsapp_contato} />
            {!isChat && (
              <Meta icon={<Monitor size={12} />} label="AnyDesk" value={detail.numero_anydesk} />
            )}
          </div>
        </Section>

        {/* Problema */}
        <Section title="Problema">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted">Relatado pela IA</span>
              <p className="text-primary mt-1">{detail.problema_relatado || '—'}</p>
            </div>
            {detail.solucao_aplicada && (
              <div>
                <span className="text-xs uppercase tracking-wider text-muted">Solução aplicada</span>
                <p className="text-primary mt-1">{detail.solucao_aplicada}</p>
              </div>
            )}
          </div>
        </Section>

        {/* Problema extraído */}
        {problema && (
          <Section title="Análise Estruturada">
            {temProblema && problema.problema ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Meta label="Categoria" value={problema.problema.categoria} />
                <Meta label="Módulo" value={problema.problema.modulo_afetado} />
                <Meta label="Frequência" value={problema.problema.frequencia} />
                <Meta label="Confiança" value={problema.confianca as string | null} />
                {problema.problema.descricao_tecnica && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Descrição técnica</span>
                    <p className="text-primary mt-1">{problema.problema.descricao_tecnica}</p>
                  </div>
                )}
                {problema.problema.mensagem_erro && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Mensagem de erro</span>
                    <p className="text-primary mt-1">{problema.problema.mensagem_erro}</p>
                  </div>
                )}
                {problema.problema.impacto_relatado && (
                  <div className="md:col-span-2">
                    <span className="text-xs uppercase tracking-wider text-muted">Impacto</span>
                    <p className="text-primary mt-1">{problema.problema.impacto_relatado}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Sem problema extraível
                {problema.motivo_descarte ? ` — ${problema.motivo_descarte}` : ''}
              </p>
            )}
          </Section>
        )}

        {/* Transcrição */}
        <TranscricaoBlock
          formatada={detail.transcricao_formatada}
          original={detail.transcricao}
          isChat={isChat}
          atendimentoId={detail.id}
        />

        {/* Avaliações */}
        <Section title="Avaliações do Cliente">
          {loadingAvaliacoes ? (
            <div className="py-4 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : avaliacoes.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma avaliação registrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {avaliacoes.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass border border-glass-border"
                >
                  <Star size={14} className="text-yellow-400" />
                  <span className="text-sm font-semibold text-primary">{a.nota ?? '—'}/5</span>
                  <span className="text-xs text-muted">{fmt(a.criado_em)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </GlassModal>
  )
}

// Bloco de validação humana. Mostra três estados:
//  1) Não validado: checkbox + textarea + botão "Salvar validação"
//  2) Em edição (já validado, usuário clicou Editar): edição inline +
//     opção de "Remover validação"
//  3) Validado: cartão verde com quem/quando + comentário + ação Editar
//
// O PATCH é otimista: salva primeiro, repercute via onSaved pra página
// refletir sem refetch. Em falha, mostra erro inline e mantém edição.
function ValidationSection({
  record,
  onSaved,
}: {
  record: AtendimentoRecord
  onSaved?: (updated: AtendimentoRecord) => void
}) {
  const isValidated = !!record.validado
  // Modo edição: liga quando ainda não validado, ou quando clica em "Editar"
  const [editing, setEditing] = useState(!isValidated)
  const [comentario, setComentario] = useState(record.validacao_comentario ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Carrega email do usuário autenticado pra preencher `validado_por`.
  useEffect(() => {
    let canceled = false
    getSupabaseClient().auth.getSession().then(({ data }) => {
      if (!canceled) setUserEmail(data.session?.user.email ?? null)
    }).catch(() => { /* ignore */ })
    return () => { canceled = true }
  }, [])

  // Quando o record muda (troca de aba ou refresh), re-sincroniza estado.
  useEffect(() => {
    setComentario(record.validacao_comentario ?? '')
    setEditing(!record.validado)
    setError(null)
  }, [record.id, record.validado, record.validacao_comentario])

  async function save(novoValidado: boolean) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/atendimentos/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validado: novoValidado,
          validado_por: userEmail ?? undefined,
          validacao_comentario: novoValidado ? comentario.trim() || null : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error ?? 'Falha ao salvar validação')
      }
      onSaved?.(json.atendimento as AtendimentoRecord)
      setEditing(!novoValidado)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  // Card verde: já validado e não está em edição.
  if (isValidated && !editing) {
    return (
      <div className="glass border-green-500/30 bg-green-500/5 p-4 rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <ShieldCheck size={18} className="text-green-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-green-300">
                Atendimento validado
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {record.validado_por ? <>por <span className="text-secondary">{record.validado_por}</span></> : 'sem responsável registrado'}
                {record.validado_em && (
                  <>
                    {' · '}
                    <span className="text-secondary">{fmt(record.validado_em)}</span>
                  </>
                )}
              </p>
              {record.validacao_comentario && (
                <p className="mt-2 text-sm text-primary whitespace-pre-wrap">
                  {record.validacao_comentario}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-glass-border bg-glass text-muted hover:text-primary hover:border-orange-500/30 transition-colors cursor-pointer"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              title="Remover validação"
              className="text-xs px-2 py-1.5 rounded-lg border border-glass-border bg-glass text-muted hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Form de validação (ou edição). Default quando ainda não validado.
  return (
    <div className="glass p-4 rounded-2xl">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-orange-400" />
        <h3 className="text-xs uppercase tracking-wider text-muted">
          {isValidated ? 'Editando validação' : 'Validação'}
        </h3>
      </div>
      <label className="block text-[11px] text-secondary mb-1.5">
        Comentário <span className="text-muted">(opcional — observações sobre a validação)</span>
      </label>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        placeholder="Ex: Resposta da IA foi adequada, sem necessidade de retrabalho."
        className="w-full px-3 py-2 rounded-xl bg-base border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-muted resize-none"
      />
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-muted">
          {userEmail ? <>Validando como <span className="text-secondary">{userEmail}</span></> : 'Sem usuário autenticado — campo "Validado por" ficará vazio'}
        </span>
        <div className="flex items-center gap-2">
          {isValidated && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false)
                setComentario(record.validacao_comentario ?? '')
                setError(null)
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-glass-border bg-glass text-muted hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/40 text-green-300 hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <Check size={13} />}
            {saving ? 'Salvando…' : isValidated ? 'Salvar alterações' : 'Marcar como validado'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Lista as mensagens deste atendimento que já foram vinculadas a um
// cenário (knowledge_item). Recarrega quando uma nova vinculação é feita
// no modal (via custom event 'atendimento-example-linked').
interface ExampleRow {
  id: string
  chunk_text: string
  source_message_index: number | null
  source_speaker: string | null
  created_by: string | null
  created_at: string
  item_id: string
  knowledge_items?: {
    id: string
    title: string
    module_id: string
    modules?: {
      id: string
      name: string
      products?: { id: string; name: string; slug: string } | null
    } | null
  } | null
}

function ExamplesSection({ record }: { record: AtendimentoRecord }) {
  const atendimentoId = record.id
  const [examples, setExamples] = useState<ExampleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showVincularConv, setShowVincularConv] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/atendimentos/${atendimentoId}/examples`)
      const j = await r.json()
      if (r.ok) setExamples((j.examples as ExampleRow[]) ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const handler = () => void load()
    window.addEventListener('atendimento-example-linked', handler)
    return () => window.removeEventListener('atendimento-example-linked', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentoId])

  async function remove(id: string) {
    if (!confirm('Remover essa mensagem do cenário?')) return
    setRemovingId(id)
    try {
      const r = await fetch(`/api/knowledge-embeddings/${id}`, { method: 'DELETE' })
      if (r.ok) setExamples((prev) => prev.filter((e) => e.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  // Concatena APENAS falas do cliente — o que sobra é o que importa pra
  // busca semântica (intenção do usuário). Texto do bot polui o embedding.
  const wholeConversationText = (() => {
    const raw = record.transcricao
    if (!raw) return ''
    const msgs = parseTranscricao(raw)
    return msgs
      .filter((m) => m.isClient && m.text.trim())
      .map((m) => m.text.trim())
      .join('\n')
  })()

  const hasClientText = wholeConversationText.length > 10

  return (
    <div className="glass p-4 rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Pin size={14} className="text-orange-400" />
          <h3 className="text-xs uppercase tracking-wider text-muted">
            Mensagens vinculadas a cenários ({examples.length})
          </h3>
        </div>
        <button
          type="button"
          disabled={!hasClientText}
          onClick={() => setShowVincularConv(true)}
          title={hasClientText
            ? 'Vincular a conversa inteira (todas as falas do cliente) a um cenário'
            : 'Sem falas do cliente na transcrição'}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-300 hover:bg-orange-500/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Pin size={12} />
          Vincular conversa inteira
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : examples.length === 0 ? (
        <p className="text-xs text-muted py-2">
          Nenhuma vinculação ainda. Use o botão acima ou faça hover sobre as bolhas do cliente
          na transcrição pra vincular mensagens individuais.
        </p>
      ) : (
        <div className="space-y-2">
          {examples.map((e) => {
            const product = e.knowledge_items?.modules?.products?.name ?? '—'
            const moduleName = e.knowledge_items?.modules?.name ?? '—'
            const title = e.knowledge_items?.title ?? 'Cenário desconhecido'
            const isWholeConv = e.source_speaker === 'conversa-inteira'
            return (
              <div key={e.id} className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-base/40 border border-glass-border">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isWholeConv && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-purple-500/10 border-purple-500/30 text-purple-300 shrink-0">
                        Conversa
                      </span>
                    )}
                    <p className="text-sm text-primary line-clamp-2" title={e.chunk_text}>
                      &ldquo;{e.chunk_text}&rdquo;
                    </p>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    → <span className="text-orange-300">{title}</span>
                    {' · '}
                    <span className="text-secondary">{product} → {moduleName}</span>
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {e.created_by ? `por ${e.created_by}` : 'sem autor'}
                    {' · '}
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removingId === e.id}
                  onClick={() => remove(e.id)}
                  title="Desvincular"
                  className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {removingId === e.id ? <Spinner size="sm" /> : <Trash2 size={13} />}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <VincularCenarioModal
        open={showVincularConv}
        onClose={() => setShowVincularConv(false)}
        messageText={wholeConversationText}
        atendimentoId={atendimentoId}
        messageIndex={null}
        speaker="conversa-inteira"
        mode="conversation"
        onLinked={() => {
          window.dispatchEvent(new CustomEvent('atendimento-example-linked'))
        }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-muted mb-2">{title}</h3>
      {children}
    </div>
  )
}

function TranscricaoBlock({
  formatada,
  original,
  isChat,
  atendimentoId,
}: {
  formatada: string | null
  original: string | null
  isChat: boolean
  atendimentoId: number
}) {
  const hasFormatada = !!formatada && formatada.trim() !== ''
  const hasOriginal = !!original && original.trim() !== ''

  const [view, setView] = useState<'formatada' | 'original'>(
    hasFormatada ? 'formatada' : 'original'
  )
  const [copied, setCopied] = useState(false)

  if (!hasFormatada && !hasOriginal) {
    return (
      <Section title="Transcrição">
        <p className="text-sm text-muted">Transcrição indisponível.</p>
      </Section>
    )
  }

  const showing = view === 'formatada' && hasFormatada ? formatada : original
  const text = String(showing ?? '')
  // Para chat sempre renderiza a partir do texto bruto (transcricao),
  // que é onde vem a estrutura "Speaker: ...".
  const chatSource = isChat ? String(original ?? '') : text
  const messages = isChat ? parseTranscricao(chatSource) : []
  const showBubbles = isChat && messages.length > 0

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(isChat ? chatSource : text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <Section title="Transcrição">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        {!isChat && hasFormatada && hasOriginal ? (
          <div className="inline-flex rounded-xl border border-glass-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView('formatada')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                view === 'formatada'
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-muted hover:text-primary hover:bg-white/5'
              }`}
            >
              Formatada
            </button>
            <button
              type="button"
              onClick={() => setView('original')}
              className={`px-3 py-1.5 cursor-pointer transition-colors border-l border-glass-border ${
                view === 'original'
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-muted hover:text-primary hover:bg-white/5'
              }`}
            >
              Original (Supabase)
            </button>
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {isChat ? 'Conversa' : hasFormatada ? 'Formatada' : 'Original (Supabase)'}
          </span>
        )}

        <button
          type="button"
          onClick={copyAll}
          title={copied ? 'Copiado!' : 'Copiar transcrição'}
          aria-label="Copiar transcrição"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
            copied
              ? 'bg-green-500/10 border-green-500/25 text-green-400'
              : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/40'
          }`}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {showBubbles ? (
        <ChatBubbles messages={messages} atendimentoId={atendimentoId} />
      ) : (
        <pre className="text-xs text-secondary bg-glass border border-glass-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[320px]">
          {text}
        </pre>
      )}
    </Section>
  )
}

function ChatBubbles({
  messages,
  atendimentoId,
}: {
  messages: import('@/lib/atendimentos').TranscricaoMessage[]
  atendimentoId: number
}) {
  const [vincularTarget, setVincularTarget] = useState<{
    text: string
    index: number
    speaker: string
  } | null>(null)

  return (
    <>
      <div className="bg-glass border border-glass-border rounded-xl p-4 max-h-[420px] overflow-y-auto space-y-3">
        {messages.map((m, idx) => {
          const prev = idx > 0 ? messages[idx - 1] : null
          const showSpeaker = !prev || prev.speaker !== m.speaker
          // Botão "vincular" só faz sentido em mensagens do cliente (são
          // elas que viram exemplos de variação no RAG).
          const canVincular = m.isClient && (m.text || '').trim().length > 3
          return (
            <div
              key={idx}
              className={`flex group ${m.isClient ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[78%] ${m.isClient ? '' : 'items-end'} relative`}>
                {showSpeaker && m.speaker && (
                  <p
                    className={`text-[10px] uppercase tracking-wider mb-1 ${
                      m.isClient
                        ? 'text-blue-400 text-left'
                        : 'text-orange-400 text-right'
                    }`}
                  >
                    {m.speaker}
                  </p>
                )}
                <div
                  className={`px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed border ${
                    m.isClient
                      ? 'bg-blue-500/10 border-blue-500/25 text-blue-50 rounded-2xl rounded-bl-sm'
                      : 'bg-orange-500/10 border-orange-500/30 text-orange-50 rounded-2xl rounded-br-sm'
                  }`}
                >
                  {m.text || '—'}
                </div>
                {canVincular && (
                  <button
                    type="button"
                    onClick={() => setVincularTarget({ text: m.text, index: idx, speaker: m.speaker })}
                    title="Vincular essa mensagem a um cenário do Nexus IA"
                    className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-500/15 border-orange-500/40 text-orange-300 hover:bg-orange-500/30 cursor-pointer shadow-md"
                  >
                    <Pin size={10} />
                    Vincular
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <VincularCenarioModal
        open={!!vincularTarget}
        onClose={() => setVincularTarget(null)}
        messageText={vincularTarget?.text ?? ''}
        atendimentoId={atendimentoId}
        messageIndex={vincularTarget?.index ?? null}
        speaker={vincularTarget?.speaker ?? 'cliente'}
        onLinked={() => {
          // Dispara um evento global pra ExamplesSection recarregar.
          window.dispatchEvent(new CustomEvent('atendimento-example-linked'))
        }}
      />
    </>
  )
}

function Meta({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number | null | undefined
  icon?: React.ReactNode
}) {
  return (
    <div className="glass p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm text-primary truncate">
        {value != null && value !== '' ? String(value) : '—'}
      </p>
    </div>
  )
}

function IdLigacaoMeta({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)
  const has = value != null && value !== ''

  async function handleCopy() {
    if (!has) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be blocked — ignore silently
    }
  }

  return (
    <div className="glass p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted mb-1">
        ID Ligação
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm text-primary truncate flex-1 font-mono" title={has ? String(value) : undefined}>
          {has ? String(value) : '—'}
        </p>
        {has && (
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copiado!' : 'Copiar ID'}
            aria-label="Copiar ID da ligação"
            className={`shrink-0 p-1.5 rounded-lg border transition-colors cursor-pointer ${
              copied
                ? 'bg-green-500/10 border-green-500/25 text-green-400'
                : 'bg-glass border-glass-border text-muted hover:text-primary hover:border-orange-500/40'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
