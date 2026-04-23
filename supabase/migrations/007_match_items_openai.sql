-- ============================================================================
-- Migration: match_items_openai
-- Descrição: Função de busca semântica compatível com LangChain / n8n
-- Supabase Vector Store node. Retorna 1 linha por item, sempre o chunk
-- `item_full`/`error_full` — evita que o agente receba um `step` isolado
-- quando o item casa em vários chunks.
--
-- Assinatura segue o contrato esperado pelo node Supabase Vector Store do
-- n8n: (query_embedding, match_count, filter jsonb). O `filter` aceita
-- `{ "product_id": "<uuid>" }` para restringir a um produto específico;
-- qualquer outra chave é ignorada.
-- ============================================================================

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
    where ke.embedding_openai is not null
      and ki.is_active = true
      and (
        filter->>'product_id' is null
        or exists (
          select 1 from modules m
          where m.id = ki.module_id
            and m.product_id::text = filter->>'product_id'
        )
      )
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
      'product_name', p.name
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
