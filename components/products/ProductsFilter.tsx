'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, SortAsc, SortDesc, LayoutGrid, Package2, X } from 'lucide-react';
import type { Product } from '@/types';

type ProductWithCounts = Product & { module_count: number; item_count: number };

type SortField = 'name' | 'created_at' | 'module_count' | 'item_count';
type SortDir = 'asc' | 'desc';

const sortLabels: Record<SortField, string> = {
  name: 'Nome',
  created_at: 'Data de criação',
  module_count: 'Módulos',
  item_count: 'Itens',
};

export function ProductsFilter({ products }: { products: ProductWithCounts[] }) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    let result = products;

    if (q) {
      result = products.filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      });
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'pt-BR');
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'module_count':
          cmp = a.module_count - b.module_count;
          break;
        case 'item_count':
          cmp = a.item_count - b.item_count;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div>
      {/* Search + Sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4A4A48] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou descrição..."
            className="w-full h-10 pl-10 pr-9 rounded-xl text-sm text-[#F5F5F0] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] placeholder:text-[#4A4A48] outline-none transition-all duration-200 focus:border-[rgba(255,107,0,0.5)] focus:bg-[rgba(255,255,255,0.06)] focus:shadow-[0_0_0_3px_rgba(255,107,0,0.12)] hover:border-[rgba(255,255,255,0.14)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A4A48] hover:text-[#8A8A85] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(sortLabels) as SortField[]).map((field) => {
            const active = sortField === field;
            return (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`
                  inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium transition-all duration-200
                  ${active
                    ? 'bg-[rgba(255,107,0,0.12)] text-[#FF8533] border border-[rgba(255,107,0,0.25)]'
                    : 'bg-[rgba(255,255,255,0.04)] text-[#8A8A85] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)] hover:text-[#F5F5F0]'
                  }
                `}
              >
                {sortLabels[field]}
                {active && (
                  sortDir === 'asc'
                    ? <SortAsc size={13} />
                    : <SortDesc size={13} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results info */}
      {search && (
        <p className="text-xs text-[#4A4A48] mb-4">
          {filtered.length === 0
            ? 'Nenhum produto encontrado'
            : `${filtered.length} resultado${filtered.length > 1 ? 's' : ''} para "${search}"`
          }
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 && search ? (
        <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Search size={22} className="text-[#4A4A48]" />
          </div>
          <p className="text-sm text-[#8A8A85] mb-1">Nenhum produto encontrado</p>
          <p className="text-xs text-[#4A4A48]">
            Tente buscar por outro termo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, index }: { product: ProductWithCounts; index: number }) {
  return (
    <div
      className="group flex flex-col gap-4 p-5 rounded-2xl transition-all duration-300 hover:border-[rgba(255,107,0,0.2)] animate-fade-in"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Icon + name */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)' }}
        >
          <LayoutGrid size={18} className="text-[#FF8533]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-[#F5F5F0] truncate"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {product.name}
          </h3>
          <p className="text-xs text-[#4A4A48] font-mono mt-0.5">{product.slug}</p>
        </div>
      </div>

      {product.description && (
        <p className="text-sm text-[#8A8A85] line-clamp-2 leading-relaxed">
          {product.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#4A4A48]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF6B00' }} />
          {product.module_count} módulo{product.module_count !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8A8A85]" />
          {product.item_count} ite{product.item_count !== 1 ? 'ns' : 'm'}
        </span>
      </div>

      {/* Action */}
      <Link
        href={`/products/${product.slug}`}
        className="flex items-center justify-center gap-2 h-9 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[rgba(255,107,0,0.15)] group-hover:text-[#FF8533] text-[#8A8A85]"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}
      >
        Acessar produto
      </Link>
    </div>
  );
}
