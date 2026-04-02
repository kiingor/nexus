'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getSupabaseClient as createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { BookOpen, AlertTriangle } from 'lucide-react';
import type { ModuleType } from '@/types';

interface Props {
  productId: string;
  slug: string;
}

export function ModuleActions({ productId, slug }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const success = (msg: string) => toast(msg);
  const error = (msg: string) => toast(msg, 'error');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ModuleType>('instruction');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setName('');
    setType('instruction');
    setDescription('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.from('modules').insert({
      product_id: productId,
      name: name.trim(),
      type,
      description: description.trim() || null,
    });

    if (err) { error('Erro ao criar módulo.'); setLoading(false); return; }

    success('Módulo criado!');
    setOpen(false);
    resetForm();
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Plus size={15} />}>
        Novo Módulo
      </Button>

      <Sheet
        open={open}
        onClose={() => { setOpen(false); resetForm(); }}
        title="Novo Módulo"
        description="Módulos organizam itens de conhecimento por área ou contexto."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Type toggle */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#8A8A85]">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'instruction', label: 'Instrução', icon: BookOpen, color: 'blue' },
                { value: 'error', label: 'Erro', icon: AlertTriangle, color: 'red' },
              ] as const).map(({ value, label, icon: Icon, color }) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className="flex items-center gap-3 p-4 rounded-xl transition-all duration-200"
                    style={{
                      background: active
                        ? color === 'blue' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)'
                        : 'rgba(255,255,255,0.03)',
                      border: active
                        ? color === 'blue' ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(248,113,113,0.35)'
                        : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <Icon
                      size={16}
                      className={active
                        ? color === 'blue' ? 'text-blue-300' : 'text-red-300'
                        : 'text-[#4A4A48]'
                      }
                    />
                    <span
                      className={`text-sm font-medium ${active
                        ? color === 'blue' ? 'text-blue-200' : 'text-red-200'
                        : 'text-[#8A8A85]'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Nome do módulo"
            placeholder="Ex.: PDV - Vendas"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <Textarea
            label="Descrição (opcional)"
            placeholder="O que esse módulo cobre..."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setOpen(false); resetForm(); }}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!name.trim()}
              className="flex-1"
            >
              Criar Módulo
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
