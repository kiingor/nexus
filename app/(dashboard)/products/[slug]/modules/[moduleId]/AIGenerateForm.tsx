'use client';

import { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { getSupabaseClient as createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Input';
import { JsonPreview } from '@/components/ui/JsonPreview';
import { useToast } from '@/components/ui/Toast';
import type { KnowledgeItem, ModuleType, KnowledgeContent } from '@/types';

interface Props {
  moduleId: string;
  moduleType: ModuleType;
  onSaved: (item: KnowledgeItem) => void;
  onCancel: () => void;
}

export function AIGenerateForm({ moduleId, moduleType, onSaved, onCancel }: Props) {
  const { toast } = useToast();
  const success = (msg: string) => toast(msg);
  const error = (msg: string) => toast(msg, 'error');
  const [description, setDescription] = useState('');
  const [generated, setGenerated] = useState<({ title: string } & KnowledgeContent) | null>(null);
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    setGenerated(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), type: moduleType }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGenerated(data);
      setTitle(data.title ?? '');
    } catch {
      error('Erro ao gerar estrutura. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generated || !title.trim()) return;
    setSaving(true);

    const { title: _t, ...content } = generated;
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from('knowledge_items')
      .insert({
        module_id: moduleId,
        title: title.trim(),
        type: moduleType,
        content: content as KnowledgeContent,
      })
      .select()
      .single();

    if (err) {
      error('Erro ao salvar item.');
      setSaving(false);
      return;
    }

    // Gerar embeddings em background
    fetch('/api/embeddings/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: data.id, action: 'upsert' }),
    }).catch(() => {});

    success('Item salvo no Nexus!');
    onSaved(data as KnowledgeItem);
  }

  return (
    <div className="flex flex-col gap-5">
      <Textarea
        label={`Descreva o ${moduleType === 'instruction' ? 'processo' : 'erro'} em linguagem natural`}
        placeholder={
          moduleType === 'instruction'
            ? 'Ex.: Para realizar uma venda no PDV, o usuário clica em Iniciar Venda, seleciona os produtos...'
            : 'Ex.: O sistema mostra o erro PDV-001 quando a conexão com o servidor fiscal é perdida...'
        }
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <Button
        onClick={handleGenerate}
        loading={generating}
        disabled={!description.trim()}
        icon={<Sparkles size={15} />}
        variant="secondary"
      >
        {generating ? 'Gerando estrutura...' : 'Gerar estrutura'}
      </Button>

      {generated && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div
            className="h-px"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />

          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            hint="Revise o título gerado pela IA antes de salvar."
          />

          <div>
            <p className="text-sm font-medium text-[#8A8A85] mb-2">Preview JSON</p>
            <JsonPreview
              data={{ ...generated, title }}
              className="max-h-64"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!title.trim()}
              icon={<Check size={15} />}
              className="flex-1"
            >
              Salvar no Nexus
            </Button>
          </div>
        </div>
      )}

      {!generated && (
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
