'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Sparkles, ClipboardList } from 'lucide-react';
import { getSupabaseClient as createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Sheet, ConfirmModal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';
import { AIGenerateForm } from './AIGenerateForm';
import { ManualForm } from './ManualForm';
import type { KnowledgeItem, ModuleType } from '@/types';

interface Props {
  items: KnowledgeItem[];
  moduleId: string;
  moduleType: ModuleType;
  slug: string;
}

type AddMode = null | 'choose' | 'ai' | 'manual';

export function KnowledgeList({ items: initialItems, moduleId, moduleType, slug }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const success = (msg: string) => toast(msg);
  const error = (msg: string) => toast(msg, 'error');
  const [items, setItems] = useState(initialItems);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<KnowledgeItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggle(item: KnowledgeItem) {
    setTogglingId(item.id);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('knowledge_items')
      .update({ is_active: !item.is_active })
      .eq('id', item.id)
      .select()
      .single();

    if (err) { error('Erro ao atualizar item.'); }
    else {
      setItems((prev) => prev.map((i) => (i.id === item.id ? data as KnowledgeItem : i)));
      // Atualizar embeddings (remove se desativou, regenera se ativou)
      fetch('/api/embeddings/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, action: item.is_active ? 'delete' : 'upsert' }),
      }).catch(() => {});
    }
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();

    // Apagar embeddings primeiro
    fetch('/api/embeddings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: deleteTarget.id, action: 'delete' }),
    }).catch(() => {});

    const { error: err } = await supabase.from('knowledge_items').delete().eq('id', deleteTarget.id);
    if (err) { error('Erro ao excluir item.'); }
    else {
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      success('Item excluído.');
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  function handleItemSaved(item: KnowledgeItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    setAddMode(null);
    setEditTarget(null);
  }

  const isSheetOpen = addMode === 'ai' || addMode === 'manual' || !!editTarget;

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-[#8A8A85]">
          {items.length === 0
            ? 'Nenhum item cadastrado'
            : `${items.length} ite${items.length !== 1 ? 'ns' : 'm'} · ${items.filter(i => i.is_active).length} ativo${items.filter(i => i.is_active).length !== 1 ? 's' : ''}`}
        </p>
        <Button onClick={() => setAddMode('choose')} icon={<Plus size={15} />}>
          Adicionar item
        </Button>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <EmptyState onAdd={() => setAddMode('choose')} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              toggling={togglingId === item.id}
              onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onToggle={() => handleToggle(item)}
              onEdit={() => setEditTarget(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      {/* Add mode picker */}
      <Sheet
        open={addMode === 'choose'}
        onClose={() => setAddMode(null)}
        title="Adicionar item"
        description="Escolha como deseja criar o item de conhecimento."
      >
        <div className="grid grid-cols-1 gap-3">
          <ModeCard
            icon={<Sparkles size={22} className="text-[#FF8533]" />}
            title="Gerar com IA"
            description="Descreva em linguagem natural e a IA estrutura para você."
            onClick={() => setAddMode('ai')}
            highlight
          />
          <ModeCard
            icon={<ClipboardList size={22} className="text-[#8A8A85]" />}
            title="Cadastro Manual"
            description="Preencha os campos diretamente com preview em tempo real."
            onClick={() => setAddMode('manual')}
          />
        </div>
      </Sheet>

      {/* AI form */}
      <Sheet
        open={addMode === 'ai'}
        onClose={() => setAddMode(null)}
        title="Gerar com IA"
        description={`Descreva o ${moduleType === 'instruction' ? 'processo' : 'erro'} em linguagem natural.`}
        width="560px"
      >
        <AIGenerateForm
          moduleId={moduleId}
          moduleType={moduleType}
          onSaved={handleItemSaved}
          onCancel={() => setAddMode(null)}
        />
      </Sheet>

      {/* Manual form */}
      <Sheet
        open={addMode === 'manual' || !!editTarget}
        onClose={() => { setAddMode(null); setEditTarget(null); }}
        title={editTarget ? 'Editar item' : 'Cadastro Manual'}
        width="560px"
      >
        <ManualForm
          moduleId={moduleId}
          moduleType={moduleType}
          editItem={editTarget ?? undefined}
          onSaved={handleItemSaved}
          onCancel={() => { setAddMode(null); setEditTarget(null); }}
        />
      </Sheet>

      {/* Confirm delete */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir item"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.15)' }}
      >
        <ClipboardList size={24} className="text-[#FF6B00]" />
      </div>
      <h3
        className="text-lg font-semibold text-[#F5F5F0] mb-2"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        Nenhum item ainda
      </h3>
      <p className="text-sm text-[#8A8A85] text-center max-w-xs mb-6">
        Adicione o primeiro item de conhecimento a este módulo.
      </p>
      <Button onClick={onAdd} icon={<Plus size={15} />}>
        Adicionar item
      </Button>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 p-5 rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 group"
      style={{
        background: highlight ? 'rgba(255,107,0,0.06)' : 'rgba(255,255,255,0.03)',
        border: highlight ? '1px solid rgba(255,107,0,0.2)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: highlight ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.05)',
          border: highlight ? '1px solid rgba(255,107,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {icon}
      </div>
      <div>
        <p
          className={`font-semibold mb-0.5 ${highlight ? 'text-[#FF9A3C]' : 'text-[#F5F5F0]'}`}
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {title}
        </p>
        <p className="text-sm text-[#8A8A85] leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

function KnowledgeCard({
  item,
  expanded,
  toggling,
  onExpand,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: KnowledgeItem;
  expanded: boolean;
  toggling: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isInstruction = item.type === 'instruction';
  const content = item.content as unknown as Record<string, unknown>;

  const preview = isInstruction
    ? `${(content.steps as Array<{ acao: string }>)?.length ?? 0} passo${(content.steps as Array<unknown>)?.length !== 1 ? 's' : ''}`
    : (content.error_code as string | null) ? `Código: ${content.error_code}` : (content.description as string)?.slice(0, 60) + '...';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: item.is_active ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(255,255,255,0.04)',
        opacity: item.is_active ? 1 : 0.55,
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={onExpand} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-semibold text-[#F5F5F0] truncate"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                {item.title}
              </span>
              {!item.is_active && (
                <Badge variant="default">Inativo</Badge>
              )}
            </div>
            <p className="text-xs text-[#4A4A48] mt-0.5">{preview}</p>
          </div>
          <span className="text-[#4A4A48] flex-shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggle}
            disabled={toggling}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            title={item.is_active ? 'Desativar' : 'Ativar'}
          >
            {toggling ? (
              <span className="spinner" style={{ width: 15, height: 15 }} />
            ) : item.is_active ? (
              <ToggleRight size={17} className="text-[#FF6B00]" />
            ) : (
              <ToggleLeft size={17} className="text-[#4A4A48]" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/5 text-[#4A4A48] hover:text-[#8A8A85] transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#4A4A48] hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-5 pb-5 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div
            className="mt-4 rounded-xl overflow-auto p-4 text-xs leading-relaxed"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <pre className="text-[#8A8A85] whitespace-pre-wrap">
              {JSON.stringify(item.content, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
