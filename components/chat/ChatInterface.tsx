'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from './ChatMessage'
import { GlassButton } from '@/components/ui/GlassButton'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

const BASE_MODELS = [
  { id: 'gpt-4.1-mini', label: '4.1 Mini' },
  { id: 'gpt-4.1-nano', label: '4.1 Nano' },
  { id: 'gpt-4o-mini', label: '4o Mini' },
  { id: 'gpt-4o', label: '4o' },
  { id: 'gpt-4.1', label: '4.1' },
  { id: 'gpt-4.5-preview', label: '4.5 Preview' },
  { id: 'o3-mini', label: 'o3 Mini' },
  { id: 'o4-mini', label: 'o4 Mini' },
]

const FINETUNED_MODEL_ID = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL
const FINETUNED_MODEL_V2_ID = process.env.NEXT_PUBLIC_OPENAI_FINETUNED_MODEL_V2

const MODELS = [
  ...(FINETUNED_MODEL_ID ? [{ id: FINETUNED_MODEL_ID, label: 'Nexus AI' }] : []),
  ...(FINETUNED_MODEL_V2_ID ? [{ id: FINETUNED_MODEL_V2_ID, label: 'Nexus AI V2' }] : []),
  ...BASE_MODELS,
]

interface Product {
  id: string
  name: string
  slug: string
  description?: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState(FINETUNED_MODEL_V2_ID || FINETUNED_MODEL_ID || 'gpt-4.1-mini')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then((data: Product[]) => {
        setProducts(Array.isArray(data) ? data : [])
      })
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false))
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: ChatMessageType = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          model,
          history: messages,
          productSlug: selectedProduct?.slug,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response },
        ])
      } else {
        const data = await res.json().catch(() => ({}))
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.error || 'Erro ao processar mensagem.' },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Erro de conexão. Tente novamente.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setMessages([])
  }

  // Product selection screen
  if (!selectedProduct) {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-center">
            <p className="text-lg font-semibold text-primary mb-1">Qual sistema você utiliza?</p>
            <p className="text-sm text-muted">Selecione o produto para receber ajuda específica</p>
          </div>

          {loadingProducts ? (
            <Spinner size="sm" />
          ) : products.length === 0 ? (
            <p className="text-sm text-muted">Nenhum produto cadastrado.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {products.map(p => (
                <button
                  key={p.slug}
                  onClick={() => setSelectedProduct(p)}
                  className="flex flex-col items-start gap-1.5 px-5 py-4 rounded-2xl bg-glass border border-glass-border hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left group cursor-pointer"
                >
                  <span className="text-sm font-semibold text-primary group-hover:text-orange-400 transition-colors">{p.name}</span>
                  {p.description && <span className="text-xs text-muted line-clamp-2">{p.description}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Model selector + product badge */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setSelectedProduct(null); setMessages([]) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition-all cursor-pointer"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {selectedProduct.name}
        </button>
        <span className="text-muted text-xs">·</span>
        <span className="text-xs text-muted uppercase tracking-wider">Modelo:</span>
        {MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModel(m.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer',
              model === m.id
                ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                : 'bg-glass border border-glass-border text-secondary hover:text-primary hover:bg-glass-hover'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="flex-1 glass p-4 flex flex-col min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-secondary text-sm gap-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-muted mb-2">
              <path d="M6 6h20v16a2 2 0 01-2 2H8a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 13h10M11 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p>Envie uma pergunta sobre o <span className="text-orange-400 font-medium">{selectedProduct.name}</span></p>
            <p className="text-muted text-xs">Usando {MODELS.find((m) => m.id === model)?.label}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={handleClear}
                className="text-xs text-muted hover:text-secondary transition-colors cursor-pointer"
              >
                Limpar conversa
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="glass px-4 py-3 rounded-2xl rounded-bl-md">
                    <Spinner size="sm" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pergunte sobre o ${selectedProduct.name}...`}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-glass-border text-primary placeholder:text-muted focus:outline-none focus:border-orange-500/50 transition-all disabled:opacity-50"
          />
          <GlassButton
            type="submit"
            disabled={!input.trim() || loading}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9M14 2l-5 12-2-5-5-2 12-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </GlassButton>
        </form>
      </div>
    </div>
  )
}
