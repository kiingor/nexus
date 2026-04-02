'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { getSupabaseClient as createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { JsonPreview } from '@/components/ui/JsonPreview';
import { useToast } from '@/components/ui/Toast';
import type { KnowledgeItem, ModuleType, InstructionStep, InstructionContent, ErrorContent } from '@/types';

interface Props {
  moduleId: string;
  moduleType: ModuleType;
  editItem?: KnowledgeItem;
  onSaved: (item: KnowledgeItem) => void;
  onCancel: () => void;
}

// ─── Instruction Form ─────────────────────────────────────────────────────────

function emptyStep(passo: number): InstructionStep {
  return { passo, acao: '', orientacao: null, atalho: null };
}

function InstructionFormFields({
  steps,
  onChange,
}: {
  steps: InstructionStep[];
  onChange: (steps: InstructionStep[]) => void;
}) {
  function update(index: number, field: keyof InstructionStep, value: string) {
    const next = steps.map((s, i) =>
      i === index
        ? { ...s, [field]: value || (field === 'acao' ? '' : null) }
        : s
    );
    onChange(next);
  }

  function addStep() {
    onChange([...steps, emptyStep(steps.length + 1)]);
  }

  function removeStep(index: number) {
    const next = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, passo: i + 1 }));
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 p-4 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-[#FF8533]" style={{ fontFamily: 'Syne, sans-serif' }}>
              Passo {step.passo}
            </span>
            {steps.length > 1 && (
              <button
                onClick={() => removeStep(i)}
                className="text-[#4A4A48] hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <Input
            placeholder="Ação que o usuário deve realizar *"
            value={step.acao}
            onChange={(e) => update(i, 'acao', e.target.value)}
          />
          <Input
            placeholder="Onde na tela encontrar (opcional)"
            value={step.orientacao ?? ''}
            onChange={(e) => update(i, 'orientacao', e.target.value)}
          />
          <Input
            placeholder="Atalho de teclado (opcional)"
            value={step.atalho ?? ''}
            onChange={(e) => update(i, 'atalho', e.target.value)}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addStep}
        icon={<Plus size={13} />}
      >
        Adicionar passo
      </Button>
    </div>
  );
}

// ─── Error Form ───────────────────────────────────────────────────────────────

interface ErrorFields {
  error_code: string;
  description: string;
  cause: string;
  solution: string;
  orientation: string;
}

function ErrorFormFields({
  fields,
  onChange,
}: {
  fields: ErrorFields;
  onChange: (f: ErrorFields) => void;
}) {
  const update = (key: keyof ErrorFields, val: string) =>
    onChange({ ...fields, [key]: val });

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Código do erro (opcional)"
        placeholder="Ex.: PDV-001"
        value={fields.error_code}
        onChange={(e) => update('error_code', e.target.value)}
      />
      <Textarea
        label="Descrição *"
        placeholder="O que o erro significa para o usuário..."
        rows={2}
        value={fields.description}
        onChange={(e) => update('description', e.target.value)}
      />
      <Textarea
        label="Causa *"
        placeholder="Por que esse erro acontece..."
        rows={2}
        value={fields.cause}
        onChange={(e) => update('cause', e.target.value)}
      />
      <Textarea
        label="Solução *"
        placeholder="Como resolver passo a passo..."
        rows={3}
        value={fields.solution}
        onChange={(e) => update('solution', e.target.value)}
      />
      <Input
        label="Localização na tela (opcional)"
        placeholder="Onde o erro aparece na tela..."
        value={fields.orientation}
        onChange={(e) => update('orientation', e.target.value)}
      />
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function ManualForm({ moduleId, moduleType, editItem, onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const success = (msg: string) => toast(msg);
  const error = (msg: string) => toast(msg, 'error');

  const [title, setTitle] = useState(editItem?.title ?? '');
  const [saving, setSaving] = useState(false);

  // Instruction state
  const [steps, setSteps] = useState<InstructionStep[]>(() => {
    if (editItem?.type === 'instruction') {
      return (editItem.content as InstructionContent).steps;
    }
    return [emptyStep(1)];
  });

  // Error state
  const [errorFields, setErrorFields] = useState<ErrorFields>(() => {
    if (editItem?.type === 'error') {
      const c = editItem.content as ErrorContent;
      return {
        error_code: c.error_code ?? '',
        description: c.description,
        cause: c.cause,
        solution: c.solution,
        orientation: c.orientation ?? '',
      };
    }
    return { error_code: '', description: '', cause: '', solution: '', orientation: '' };
  });

  // Build preview
  const previewContent = moduleType === 'instruction'
    ? {
        title,
        type: 'instruction' as const,
        steps: steps.map((s) => ({
          ...s,
          orientacao: s.orientacao || null,
          atalho: s.atalho || null,
        })),
      }
    : {
        title,
        type: 'error' as const,
        error_code: errorFields.error_code || null,
        description: errorFields.description,
        cause: errorFields.cause,
        solution: errorFields.solution,
        orientation: errorFields.orientation || null,
      };

  const isValid = moduleType === 'instruction'
    ? title.trim() && steps.every((s) => s.acao.trim())
    : title.trim() && errorFields.description.trim() && errorFields.cause.trim() && errorFields.solution.trim();

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);

    const supabase = createClient();
    const { title: _t, ...content } = previewContent;
    const payload = {
      module_id: moduleId,
      title: title.trim(),
      type: moduleType,
      content,
    };

    let data, err;
    if (editItem) {
      ({ data, error: err } = await supabase
        .from('knowledge_items')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editItem.id)
        .select()
        .single());
    } else {
      ({ data, error: err } = await supabase
        .from('knowledge_items')
        .insert(payload)
        .select()
        .single());
    }

    if (err) {
      error('Erro ao salvar item.');
      setSaving(false);
      return;
    }

    // Gerar/atualizar embeddings em background
    fetch('/api/embeddings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: data.id, action: 'upsert' }),
    }).catch(() => {});

    success(editItem ? 'Item atualizado!' : 'Item salvo no Nexus!');
    onSaved(data as KnowledgeItem);
  }

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Título"
        placeholder="Título descritivo do item"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      {moduleType === 'instruction' ? (
        <div>
          <p className="text-sm font-medium text-[#8A8A85] mb-3">Passos</p>
          <InstructionFormFields steps={steps} onChange={setSteps} />
        </div>
      ) : (
        <ErrorFormFields fields={errorFields} onChange={setErrorFields} />
      )}

      {/* Preview */}
      <div>
        <p className="text-sm font-medium text-[#8A8A85] mb-2">Preview JSON</p>
        <JsonPreview data={previewContent} className="max-h-52" />
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onCancel} className="flex-1" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!isValid}
          icon={<Save size={15} />}
          className="flex-1"
        >
          {editItem ? 'Atualizar' : 'Salvar no Nexus'}
        </Button>
      </div>
    </div>
  );
}
