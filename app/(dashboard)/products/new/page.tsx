'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const success = (msg: string) => toast(msg);
  const error = (msg: string) => toast(msg, 'error');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const slug = slugify(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { error('Sessão expirada'); setLoading(false); return; }

    const { error: err } = await supabase.from('products').insert({
      name: name.trim(),
      slug,
      description: description.trim() || null,
      created_by: user.id,
    });

    if (err) {
      if (err.code === '23505') error('Já existe um produto com este nome.');
      else error('Erro ao criar produto.');
      setLoading(false);
      return;
    }

    success('Produto criado com sucesso!');
    router.push(`/products/${slug}`);
    router.refresh();
  }

  return (
    <div className="px-8 py-8 max-w-xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-[#8A8A85] hover:text-[#F5F5F0] transition-colors mb-6"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m12 19-7-7 7-7M5 12h14" /></svg> Voltar aos produtos
      </Link>

      <h1
        className="text-2xl font-bold text-[#F5F5F0] mb-1"
        style={{ fontFamily: 'Syne, sans-serif' }}
      >
        Novo Produto
      </h1>
      <p className="text-sm text-[#8A8A85] mb-8">
        Crie um produto para organizar módulos e itens de conhecimento.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-6 rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <Input
          label="Nome do produto"
          placeholder="Ex.: Softcomshop"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        {name && (
          <div className="flex items-center gap-2 -mt-2">
            <span className="text-xs text-[#4A4A48]">Slug:</span>
            <span
              className="text-xs text-[#FF8533]"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {slug}
            </span>
          </div>
        )}

        <Textarea
          label="Descrição (opcional)"
          placeholder="Breve descrição do produto..."
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={!name.trim()}
            className="flex-1"
          >
            Criar Produto
          </Button>
        </div>
      </form>
    </div>
  );
}
