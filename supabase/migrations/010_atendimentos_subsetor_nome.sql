-- Nome legível do setor/subsetor usado para conferência e filtros no portal.
-- A migration é idempotente porque a coluna já pode ter sido criada no painel.
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS subsetor_nome text;

CREATE INDEX IF NOT EXISTS idx_atendimentos_subsetor_nome
  ON public.atendimentos (subsetor_nome);
