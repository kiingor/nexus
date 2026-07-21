'use client'

import { useEffect, useState } from 'react'
import { GlassModal } from '@/components/ui/GlassModal'
import { Spinner } from '@/components/ui/Spinner'
import { FileText } from 'lucide-react'

type Cliente = {
  cliente_id: string
  nome: string
  telefone: string | null
  pdv: string | null
  inicio: string
  fim: string
  total: number
} | null

type MensagemRow = {
  id: string
  remetente: string
  conteudo: string | null
  enviado_em: string | null
  url_imagem: string | null
  media_type: string | null
}

function hora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// `tipo` na tabela vem como 'imagem' pra qualquer anexo — quem manda no
// render é o media_type.
function Anexo({ url, mediaType }: { url: string; mediaType: string | null }) {
  const [falhou, setFalhou] = useState(false)
  const mt = (mediaType ?? '').toLowerCase()
  const base = 'mt-1.5 rounded-xl max-w-full border border-white/10'

  const link = (label: string) => (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1.5 inline-flex items-center gap-1.5 text-xs underline decoration-dotted opacity-90 hover:opacity-100"
    >
      <FileText size={12} />
      {label}
    </a>
  )

  if (falhou) return link('Abrir anexo')

  if (mt.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Anexo"
          onError={() => setFalhou(true)}
          className={`${base} max-h-64 object-contain`}
        />
      </a>
    )
  }
  if (mt.startsWith('video/')) {
    return (
      <div className="mt-1.5">
        <video
          src={url}
          controls
          playsInline
          preload="metadata"
          onError={() => setFalhou(true)}
          className={`${base} max-h-64 w-full bg-black/40`}
        />
        {link('Abrir vídeo em nova aba')}
      </div>
    )
  }
  if (mt.startsWith('audio/')) {
    return (
      <audio
        src={url}
        controls
        preload="metadata"
        onError={() => setFalhou(true)}
        className="mt-1.5 w-full"
      />
    )
  }
  return link(mediaType || 'Arquivo')
}

export function ConversaAbandonadaModal({
  open,
  onClose,
  cliente,
}: {
  open: boolean
  onClose: () => void
  cliente: Cliente
}) {
  const [mensagens, setMensagens] = useState<MensagemRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const clienteId = cliente?.cliente_id ?? null
  // Um pouco de folga nas pontas pra não cortar a conversa no limite exato.
  const from = cliente ? new Date(Date.parse(cliente.inicio) - 60_000).toISOString() : null
  const to = cliente ? new Date(Date.parse(cliente.fim) + 60_000).toISOString() : null

  useEffect(() => {
    if (!open || !clienteId || !from || !to) return

    let cancelado = false

    async function carregar(id: string, de: string, ate: string) {
      setLoading(true)
      setErro(null)
      setMensagens(null)
      try {
        const qs = new URLSearchParams({ cliente_id: id, from: de, to: ate })
        const r = await fetch(`/api/atendimentos/abandonados/conversa?${qs}`)
        const json = await r.json().catch(() => ({}))
        if (cancelado) return
        if (!r.ok) {
          setErro(json?.error ?? 'Falha ao carregar a conversa')
          return
        }
        setMensagens(json?.mensagens ?? [])
      } catch {
        if (!cancelado) setErro('Falha ao carregar a conversa')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar(clienteId, from, to)
    return () => {
      cancelado = true
    }
  }, [open, clienteId, from, to])

  if (!cliente) return null

  return (
    <GlassModal open={open} onClose={onClose} title={cliente.nome}>
      <p className="text-xs text-secondary mb-4">
        {[cliente.telefone, cliente.pdv, `${cliente.total} mensagens`]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {loading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}

      {erro && <p className="text-sm text-red-300 py-4">{erro}</p>}

      {mensagens && mensagens.length === 0 && !loading && (
        <p className="text-sm text-secondary py-4">Nenhuma mensagem no período.</p>
      )}

      {mensagens && mensagens.length > 0 && (
        <div className="bg-glass border border-glass-border rounded-xl p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {mensagens.map((m) => {
            const doCliente = m.remetente === 'cliente-nexus'
            return (
              <div
                key={m.id}
                className={`flex ${doCliente ? 'justify-start' : 'justify-end'}`}
              >
                <div className="max-w-[78%]">
                  <p
                    className={`text-[10px] uppercase tracking-wider mb-1 ${
                      doCliente ? 'text-blue-400 text-left' : 'text-orange-400 text-right'
                    }`}
                  >
                    {doCliente ? 'Cliente' : 'Nexus'}
                  </p>
                  <div
                    className={`px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed border ${
                      doCliente
                        ? 'bg-blue-500/10 border-blue-500/25 text-blue-50 rounded-2xl rounded-bl-sm'
                        : 'bg-orange-500/10 border-orange-500/30 text-orange-50 rounded-2xl rounded-br-sm'
                    }`}
                  >
                    {m.conteudo || (m.url_imagem ? '' : '—')}
                    {m.url_imagem && (
                      <Anexo url={m.url_imagem} mediaType={m.media_type} />
                    )}
                    <span
                      className={`block text-[10px] mt-1 opacity-60 ${
                        doCliente ? 'text-left' : 'text-right'
                      }`}
                    >
                      {hora(m.enviado_em)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </GlassModal>
  )
}
