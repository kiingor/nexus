'use client'

import { useEffect, useRef, useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { Building2, Phone, MessageSquare, Star, Monitor, Calendar, DollarSign, Smile, Copy, Check, ShieldCheck, X, Pin, Trash2, Tag, MessageCircle, PhoneCall, Clock, FileText, Search, User } from 'lucide-react'
import type { AtendimentoRecord, AvaliacaoAtendimentoRecord } from '@/lib/types'
import { formatCusto, formatDuracao, parseTranscricao, sentimentoBadge } from '@/lib/atendimentos'
import { formatTipoAtendimento } from '@/lib/tipos-atendimento'
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

  const sentimentoB = sentimentoBadge(detail.sentimento_cliente)
  const tipoLabel = detail.tipo_atendimento ? formatTipoAtendimento(detail.tipo_atendimento) : null

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={`Detalhes do Atendimento #${detail.id}`}
      className="max-w-6xl"
    >
      <div className="max-h-[82vh] overflow-y-auto pr-2 space-y-5">
        {hasTabs && (
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            <span className="text-[10px] uppercase tracking-wider text-secondary mr-2">
              {group!.length} atendimentos unidos
            </span>
            {group!.map((r, idx) => {
              const isActive = idx === activeIndex
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { if (!isActive && onSelectRecord) onSelectRecord(r) }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                      : 'bg-glass border-glass-border text-secondary hover:text-primary hover:border-orange-500/30'
                  }`}
                  title={`ID #${r.id}${r.data_hora_chegada ? ' · ' + fmt(r.data_hora_chegada) : ''}`}
                >
                  Atendimento {idx + 1}
                </button>
              )
            })}
          </div>
        )}

        {/* ─── Status bar (header) ─────────────────────────────────────
            Chips compactos com o status macro do atendimento. Dá ao
            usuário uma visão de relance antes de entrar nos detalhes. */}
        <div className="rounded-2xl border border-glass-border bg-gradient-to-br from-white/[0.03] to-white/[0.01] px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChipWithReclassify
              record={detail}
              onChanged={onValidationSaved}
            />
            {detail.validado && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-500/15 border-green-500/40 text-green-300">
                <ShieldCheck size={12} />
                Validado
              </span>
            )}
            {detail.destino && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${destinoChipCls(detail.destino)}`}>
                <Tag size={12} />
                {capitalize(detail.destino)}
              </span>
            )}
            {tipoLabel && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-orange-500/10 border-orange-500/30 text-orange-300">
                <FileText size={12} />
                {tipoLabel}
              </span>
            )}
            {detail.tipo_contato && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-glass border-glass-border text-secondary">
                {detail.tipo_contato === 'chat' ? <MessageCircle size={12} /> : <PhoneCall size={12} />}
                {detail.tipo_contato === 'chat' ? 'Chat' : 'Ligação'}
              </span>
            )}
            {sentimentoB && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${sentimentoB.cls}`}>
                <Smile size={12} />
                {sentimentoB.label}
              </span>
            )}
            {detail.nota != null && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                <Star size={12} className="fill-current" />
                {detail.nota}/10
              </span>
            )}
          </div>
          {/* Métricas inline (só pra ligação — chat não tem essa info) */}
          {!isChat && (
            <div className="mt-3 pt-3 border-t border-glass-border/60 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <MetricInline icon={<Calendar size={11} />} label="Início" value={fmt(detail.data_hora_chegada)} />
              <MetricInline icon={<Calendar size={11} />} label="Fim"    value={fmt(detail.data_hora_saida)} />
              <MetricInline icon={<Clock size={11} />}    label="Duração" value={formatDuracao(detail.duracao_segundos)} />
              <MetricInline icon={<DollarSign size={11} />} label="Custo" value={formatCusto(detail.custo_real)} />
            </div>
          )}
        </div>

        {/* ─── Body 2 colunas ─────────────────────────────────────────
            Layout responsivo: 1 coluna em mobile, 2 colunas em lg+ (≥1024px).
            Esquerda (40%): dados sobre o atendimento (read-only).
            Direita (60%): transcrição (focal) + ações (validação, vincular). */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">
          {/* ─── Coluna esquerda ─── */}
          <div className="space-y-4">
            <Section title="Cliente" icon={<User size={12} />}>
              {/* Empresa em destaque — é a info que mais importa pro reviewer
                  identificar "qual cliente é esse" antes de qualquer outra coisa. */}
              <div className="mb-4 pb-4 border-b border-glass-border/40">
                <div className="flex items-start gap-2">
                  <Building2 size={18} className="text-orange-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-primary leading-tight">
                      {detail.nome_empresa || '—'}
                    </p>
                    {detail.cnpj && (
                      <p className="text-xs text-secondary font-mono mt-1 tracking-wide">
                        {detail.cnpj}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Demais contatos em lista vertical limpa — uma linha por campo,
                  label à esquerda, valor à direita. Não trunca dados curtos
                  como telefone/whatsapp. */}
              <div className="space-y-2">
                <ContactRow
                  icon={<User size={12} />}
                  label="Cliente"
                  value={detail.cliente_nome}
                />
                <ContactRow
                  icon={<Phone size={12} />}
                  label="Telefone"
                  value={detail.phone}
                  mono
                />
                <ContactRow
                  icon={<MessageSquare size={12} />}
                  label="WhatsApp"
                  value={detail.whatsapp_contato}
                  mono
                />
                {!isChat && (
                  <ContactRow
                    icon={<Monitor size={12} />}
                    label="AnyDesk"
                    value={detail.numero_anydesk}
                    mono
                  />
                )}
              </div>

              {!isChat && detail.id_ligacao && (
                <div className="mt-3 pt-3 border-t border-glass-border/40">
                  <IdLigacaoMeta value={detail.id_ligacao} />
                </div>
              )}
            </Section>

            <Section title="Problema" icon={<FileText size={12} />}>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-secondary">Relatado pela IA</span>
                  <p className="text-primary mt-1 whitespace-pre-wrap leading-relaxed">{detail.problema_relatado || '—'}</p>
                </div>
                {detail.solucao_aplicada && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-secondary">Solução aplicada</span>
                    <p className="text-primary mt-1 whitespace-pre-wrap leading-relaxed">{detail.solucao_aplicada}</p>
                  </div>
                )}
              </div>
            </Section>

            {problema && (
              <Section title="Análise Estruturada" icon={<Search size={12} />}>
                {temProblema && problema.problema ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                    <Meta label="Categoria" value={problema.problema.categoria} />
                    <Meta label="Módulo" value={problema.problema.modulo_afetado} />
                    <Meta label="Frequência" value={problema.problema.frequencia} />
                    <Meta label="Confiança" value={problema.confianca as string | null} />
                    {problema.problema.descricao_tecnica && (
                      <div className="sm:col-span-2">
                        <span className="text-[11px] uppercase tracking-wider text-secondary">Descrição técnica</span>
                        <p className="text-primary mt-1 whitespace-pre-wrap leading-relaxed">{problema.problema.descricao_tecnica}</p>
                      </div>
                    )}
                    {problema.problema.mensagem_erro && (
                      <div className="sm:col-span-2">
                        <span className="text-[11px] uppercase tracking-wider text-secondary">Mensagem de erro</span>
                        <p className="text-primary mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed">{problema.problema.mensagem_erro}</p>
                      </div>
                    )}
                    {problema.problema.impacto_relatado && (
                      <div className="sm:col-span-2">
                        <span className="text-[11px] uppercase tracking-wider text-secondary">Impacto</span>
                        <p className="text-primary mt-1 whitespace-pre-wrap leading-relaxed">{problema.problema.impacto_relatado}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-secondary">
                    Sem problema extraível
                    {problema.motivo_descarte ? ` — ${problema.motivo_descarte}` : ''}
                  </p>
                )}
              </Section>
            )}
          </div>

          {/* ─── Coluna direita ─── */}
          <div className="space-y-4">
            <TranscricaoBlock
              formatada={detail.transcricao_formatada}
              original={detail.transcricao}
              isChat={isChat}
              atendimentoId={detail.id}
            />

            <ValidationSection record={detail} onSaved={onValidationSaved} />
            <ExamplesSection record={detail} />
          </div>
        </div>

        {/* ─── Rodapé full width: Avaliações ─── */}
        <Section title="Avaliações do Cliente" icon={<Star size={12} />}>
          {loadingAvaliacoes ? (
            <div className="py-4 flex justify-center">
              <Spinner size="sm" />
            </div>
          ) : avaliacoes.length === 0 ? (
            <p className="text-sm text-secondary">Nenhuma avaliação registrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {avaliacoes.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-glass border border-glass-border"
                >
                  <Star size={14} className="text-yellow-400 fill-current" />
                  <span className="text-sm font-semibold text-primary">{a.nota ?? '—'}/5</span>
                  <span className="text-xs text-secondary">{fmt(a.criado_em)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </GlassModal>
  )
}

// Helpers de display
function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

// Cor do chip de destino — mesma paleta da Lista pra consistência visual.
function destinoChipCls(destino: string): string {
  if (destino === 'servicedesk') return 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  if (destino === 'financeiro')  return 'bg-purple-500/10 border-purple-500/30 text-purple-300'
  if (destino === 'comercial')   return 'bg-orange-500/10 border-orange-500/30 text-orange-300'
  if (destino === 'ouvidoria')   return 'bg-pink-500/10 border-pink-500/30 text-pink-300'
  return 'bg-glass border-glass-border text-secondary'
}

// Métrica inline pra status bar (mais compacta que o card Meta).
function MetricInline({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-center gap-1.5 text-secondary">
      {icon}
      <span className="text-[10px] uppercase tracking-wider">{label}:</span>
      <span className="text-secondary font-medium truncate">
        {value != null && value !== '' ? String(value) : '—'}
      </span>
    </div>
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
              <p className="text-[11px] text-secondary mt-0.5">
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
              className="text-xs px-2.5 py-1.5 rounded-lg border border-glass-border bg-glass text-secondary hover:text-primary hover:border-orange-500/30 transition-colors cursor-pointer"
            >
              Editar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(false)}
              title="Remover validação"
              className="text-xs px-2 py-1.5 rounded-lg border border-glass-border bg-glass text-secondary hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
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
        <h3 className="text-xs uppercase tracking-wider text-orange-300/90 font-semibold">
          {isValidated ? 'Editando validação' : 'Validação'}
        </h3>
      </div>
      <label className="block text-[11px] text-secondary mb-1.5">
        Comentário <span className="text-secondary">(opcional — observações sobre a validação)</span>
      </label>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        placeholder="Ex: Resposta da IA foi adequada, sem necessidade de retrabalho."
        className="w-full px-3 py-2 rounded-xl bg-base border border-glass-border text-primary text-sm focus:outline-none focus:border-orange-500/50 placeholder:text-secondary resize-none"
      />
      {error && (
        <p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
        <span className="text-[11px] text-secondary">
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
              className="text-xs px-3 py-1.5 rounded-lg border border-glass-border bg-glass text-secondary hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
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
          <h3 className="text-xs uppercase tracking-wider text-orange-300/90 font-semibold">
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
        <p className="text-xs text-secondary py-2">
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
                  <p className="text-[11px] text-secondary mt-0.5">
                    → <span className="text-orange-300">{title}</span>
                    {' · '}
                    <span className="text-secondary">{product} → {moduleName}</span>
                  </p>
                  <p className="text-[10px] text-secondary mt-0.5">
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
                  className="shrink-0 p-1.5 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
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

// Chip de status atual + botão de reclassificação (transferida → resolvido
// parcialmente). Hoje só essa transição faz sentido pelo UX combinado com o
// usuário, mas o helper aceita qualquer status válido caso a gente queira
// expandir depois (ex: undo, em_atendimento → resolvida_ia, etc.).
const STATUS_META: Record<string, { label: string; cls: string }> = {
  em_atendimento:         { label: 'Em atendimento',   cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300' },
  transferida:            { label: 'Transferida',      cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' },
  resolvida_ia:           { label: 'Resolvida IA',     cls: 'bg-green-500/10 border-green-500/30 text-green-300' },
  resolvido_parcialmente: { label: 'Resolvido Parcial.', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
  interrompida:           { label: 'Interrompida',     cls: 'bg-red-500/10 border-red-500/30 text-red-300' },
}

function StatusChipWithReclassify({
  record,
  onChanged,
}: {
  record: AtendimentoRecord
  onChanged?: (updated: AtendimentoRecord) => void
}) {
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const status = record.status ?? ''
  const meta = STATUS_META[status] ?? { label: status || '—', cls: 'bg-glass border-glass-border text-secondary' }
  const podeReclassificarParcial = status === 'transferida'
  const ehParcial = status === 'resolvido_parcialmente'
  const isClickable = podeReclassificarParcial || ehParcial

  // Opções disponíveis pra trocar. Hoje só Transferida ↔ Resolvido Parcial.
  // Pode ser expandido pra cobrir mais transições no futuro.
  const opcoes: Array<{ codigo: 'transferida' | 'resolvido_parcialmente'; label: string; cls: string }> = []
  if (podeReclassificarParcial) {
    opcoes.push({
      codigo: 'resolvido_parcialmente',
      label: 'Resolvido Parcialmente',
      cls: 'text-emerald-300 hover:bg-emerald-500/10',
    })
  } else if (ehParcial) {
    opcoes.push({
      codigo: 'transferida',
      label: 'Transferida',
      cls: 'text-yellow-300 hover:bg-yellow-500/10',
    })
  }

  // Fecha o dropdown ao clicar fora ou apertar ESC.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function reclassify(novoStatus: 'resolvido_parcialmente' | 'transferida') {
    setSaving(true)
    setOpen(false)
    try {
      const res = await fetch(`/api/atendimentos/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      const json = await res.json()
      if (res.ok) {
        onChanged?.(json.atendimento as AtendimentoRecord)
      } else {
        alert(json?.error ?? 'Falha ao reclassificar')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  // Não-clicável: span simples.
  if (!isClickable) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
        {meta.label}
      </span>
    )
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {/* Chip-botão: clique abre o dropdown */}
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((v) => !v)}
        title="Trocar status do atendimento"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls} cursor-pointer hover:brightness-125 transition-all ${saving ? 'opacity-50' : ''}`}
      >
        {meta.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[200px] z-20 rounded-xl border border-orange-500/30 bg-base shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-3 py-2 border-b border-glass-border/60 text-[10px] uppercase tracking-wider text-secondary">
            Trocar status para
          </div>
          {opcoes.map((opt) => (
            <button
              key={opt.codigo}
              type="button"
              disabled={saving}
              onClick={() => void reclassify(opt.codigo)}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${opt.cls} disabled:opacity-50`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="glass p-4 rounded-2xl">
      <h3 className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-300/90 font-semibold mb-3">
        {icon}
        {title}
      </h3>
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
        <p className="text-sm text-secondary">Transcrição indisponível.</p>
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
                  : 'text-secondary hover:text-primary hover:bg-white/5'
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
                  : 'text-secondary hover:text-primary hover:bg-white/5'
              }`}
            >
              Original (Supabase)
            </button>
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-wider text-secondary">
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
              : 'bg-glass border-glass-border text-secondary hover:text-primary hover:border-orange-500/40'
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
    <div className="rounded-xl bg-base/40 border border-glass-border/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-secondary mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-sm text-primary truncate font-medium">
        {value != null && value !== '' ? String(value) : '—'}
      </p>
    </div>
  )
}

// Linha de contato em formato horizontal "label → valor".
// Ocupa só o necessário em altura, lê fácil em escaneamento vertical.
// `mono` aplica font-mono pra dados estruturados (telefone, anydesk).
function ContactRow({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode
  label: string
  value: string | number | null | undefined
  mono?: boolean
}) {
  const hasValue = value != null && value !== ''
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-secondary shrink-0">
        {icon}
        {label}
      </span>
      <span
        className={`text-sm font-medium text-right ${mono ? 'font-mono' : ''} ${hasValue ? 'text-primary' : 'text-secondary'}`}
        title={hasValue ? String(value) : undefined}
      >
        {hasValue ? String(value) : '—'}
      </span>
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
    <div className="rounded-xl bg-base/40 border border-glass-border/60 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-secondary mb-0.5">
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
                : 'bg-glass border-glass-border text-secondary hover:text-primary hover:border-orange-500/40'
            }`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}
