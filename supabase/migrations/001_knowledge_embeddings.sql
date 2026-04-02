-- ============================================================================
-- Migration: Knowledge Embeddings (pgvector)
-- Descrição: Cria tabela de embeddings para busca semântica via IA
-- IMPORTANTE: Não altera nenhuma tabela existente
-- ============================================================================

-- 1. Ativar extensão pgvector
create extension if not exists vector;

-- 2. Tabela de embeddings
-- Cada "chunk" é um pedaço de conteúdo (item completo, step individual, erro, etc.)
create table if not exists knowledge_embeddings (
  id uuid default gen_random_uuid() primary key,

  -- Referência ao item original
  item_id uuid references knowledge_items(id) on delete cascade not null,

  -- Tipo do chunk: 'item_full' | 'step' | 'error_full'
  chunk_type text not null check (chunk_type in ('item_full', 'step', 'error_full')),

  -- Número do step (só quando chunk_type = 'step')
  step_number int,

  -- Texto usado para gerar o embedding (guardamos para debug/reprocessamento)
  chunk_text text not null,

  -- Embeddings por provider
  -- OpenAI text-embedding-3-small = 1536 dimensões
  embedding_openai vector(1536),
  -- Google Gemini text-embedding-004 = 768 dimensões
  embedding_gemini vector(768),

  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Índices para busca vetorial (IVFFlat - bom equilíbrio performance/precisão)
-- Nota: IVFFlat precisa de dados para criar as listas.
-- Para poucos registos (<1000), cosine distance sem índice é suficiente.
-- Quando tiveres mais dados, descomenta e executa:
--
-- create index idx_embeddings_openai on knowledge_embeddings
--   using ivfflat (embedding_openai vector_cosine_ops) with (lists = 100);
--
-- create index idx_embeddings_gemini on knowledge_embeddings
--   using ivfflat (embedding_gemini vector_cosine_ops) with (lists = 100);

-- 4. Índices regulares
create index if not exists idx_embeddings_item_id on knowledge_embeddings(item_id);
create index if not exists idx_embeddings_chunk_type on knowledge_embeddings(chunk_type);

-- 5. RLS (mesma política das outras tabelas)
alter table knowledge_embeddings enable row level security;

create policy "Authenticated users can manage knowledge_embeddings"
  on knowledge_embeddings for all using (auth.role() = 'authenticated');

-- Acesso anónimo para leitura (para o chatbot no n8n usar com service_role ou anon key)
create policy "Anon users can read knowledge_embeddings"
  on knowledge_embeddings for select using (true);

-- 6. Função de busca semântica - OpenAI
create or replace function match_documents_openai(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_product_id uuid default null
)
returns table (
  id uuid,
  item_id uuid,
  chunk_type text,
  step_number int,
  chunk_text text,
  similarity float,
  item_title text,
  module_name text,
  product_name text
)
language sql stable
as $$
  select
    ke.id,
    ke.item_id,
    ke.chunk_type,
    ke.step_number,
    ke.chunk_text,
    1 - (ke.embedding_openai <=> query_embedding) as similarity,
    ki.title as item_title,
    m.name as module_name,
    p.name as product_name
  from knowledge_embeddings ke
  join knowledge_items ki on ki.id = ke.item_id
  join modules m on m.id = ki.module_id
  join products p on p.id = m.product_id
  where
    ke.embedding_openai is not null
    and 1 - (ke.embedding_openai <=> query_embedding) > match_threshold
    and (filter_product_id is null or p.id = filter_product_id)
    and ki.is_active = true
  order by ke.embedding_openai <=> query_embedding
  limit match_count;
$$;

-- 7. Função de busca semântica - Gemini
create or replace function match_documents_gemini(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_product_id uuid default null
)
returns table (
  id uuid,
  item_id uuid,
  chunk_type text,
  step_number int,
  chunk_text text,
  similarity float,
  item_title text,
  module_name text,
  product_name text
)
language sql stable
as $$
  select
    ke.id,
    ke.item_id,
    ke.chunk_type,
    ke.step_number,
    ke.chunk_text,
    1 - (ke.embedding_gemini <=> query_embedding) as similarity,
    ki.title as item_title,
    m.name as module_name,
    p.name as product_name
  from knowledge_embeddings ke
  join knowledge_items ki on ki.id = ke.item_id
  join modules m on m.id = ki.module_id
  join products p on p.id = m.product_id
  where
    ke.embedding_gemini is not null
    and 1 - (ke.embedding_gemini <=> query_embedding) > match_threshold
    and (filter_product_id is null or p.id = filter_product_id)
    and ki.is_active = true
  order by ke.embedding_gemini <=> query_embedding
  limit match_count;
$$;

-- 8. Função auxiliar: listar itens sem embedding (para saber o que falta processar)
create or replace function items_without_embeddings(provider text default 'openai')
returns table (
  item_id uuid,
  title text,
  module_name text,
  product_name text
)
language sql stable
as $$
  select
    ki.id as item_id,
    ki.title,
    m.name as module_name,
    p.name as product_name
  from knowledge_items ki
  join modules m on m.id = ki.module_id
  join products p on p.id = m.product_id
  where ki.is_active = true
    and not exists (
      select 1 from knowledge_embeddings ke
      where ke.item_id = ki.id
        and case
          when provider = 'openai' then ke.embedding_openai is not null
          when provider = 'gemini' then ke.embedding_gemini is not null
          else false
        end
    );
$$;
