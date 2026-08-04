-- ============================================================================
-- Migration: product_audience
-- Descrição: Classifica cada PRODUTO por público-alvo — 'tecnico' ou
-- 'cliente'. Tudo que está dentro do produto (módulos, knowledge_items,
-- knowledge_embeddings) herda essa classificação por pertencer a ele:
-- a busca semântica já faz join até products, então não é preciso duplicar
-- a coluna nas outras tabelas nem sincronizar por trigger.
--
-- Valores: 'tecnico' | 'cliente'. NULL = ainda não classificado.
-- ============================================================================

-- 1. Coluna no produto (fonte única da verdade)
alter table public.products
  add column if not exists audience text;

-- Check idempotente (permite NULL enquanto não classificado)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_audience_check'
  ) then
    alter table public.products
      add constraint products_audience_check
      check (audience is null or audience in ('tecnico', 'cliente'));
  end if;
end $$;

create index if not exists idx_products_audience
  on public.products using btree (audience);

-- 1b. Todos os produtos que já existem são de público CLIENTE.
--     Produtos novos entram sem classificação e são definidos na criação.
update public.products set audience = 'cliente' where audience is null;

-- 2. Busca semântica passa a aceitar filtro por público.
--    O node Supabase Vector Store do n8n manda, no `filter`, algo como
--    { "audience": "tecnico" } ou { "audience": "cliente" } — assim o
--    agente técnico busca só conteúdo técnico e o do cliente só o de cliente.
--    Mantém compatível com o filtro `product_id` já existente.
create or replace function match_items_openai(
  query_embedding vector(1536),
  match_count int default 10,
  filter jsonb default '{}'
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  with scored as (
    select
      ke.item_id,
      max(1 - (ke.embedding_openai <=> query_embedding)) as best_sim
    from knowledge_embeddings ke
    join knowledge_items ki on ki.id = ke.item_id
    join modules m on m.id = ki.module_id
    join products p on p.id = m.product_id
    where ke.embedding_openai is not null
      and ki.is_active = true
      and (filter->>'product_id' is null or p.id::text = filter->>'product_id')
      and (filter->>'audience'   is null or p.audience  = filter->>'audience')
    group by ke.item_id
    order by best_sim desc
    limit match_count
  )
  select
    ke.id,
    ke.chunk_text as content,
    jsonb_build_object(
      'item_id', ke.item_id,
      'item_title', ki.title,
      'chunk_type', ke.chunk_type,
      'step_number', ke.step_number,
      'module_name', m.name,
      'product_name', p.name,
      'audience', p.audience
    ) as metadata,
    s.best_sim as similarity
  from scored s
  join knowledge_embeddings ke
    on ke.item_id = s.item_id
   and ke.chunk_type in ('item_full', 'error_full')
  join knowledge_items ki on ki.id = ke.item_id
  join modules m on m.id = ki.module_id
  join products p on p.id = m.product_id
  order by s.best_sim desc;
$$;
