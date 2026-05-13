-- ============================================================================
-- Migration 008 — Tipo de contato (ligação x chat) na tabela atendimentos
-- ============================================================================
-- Adiciona uma coluna `tipo_contato` direto em atendimentos, com check
-- constraint pra garantir só valores válidos. Sem tabela separada.
-- Faz backfill: id_ligacao preenchido → 'ligacao'; vazio → 'chat'.
--
-- Como rodar:
--   Supabase Dashboard → SQL Editor → New query → cola e executa
-- ============================================================================

-- 1) Adiciona coluna na tabela atendimentos --------------------------------
ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS tipo_contato TEXT;

-- 2) Check constraint pros valores aceitos ---------------------------------
-- Usa DO block pra ser idempotente: só adiciona se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_tipo_contato_check'
  ) THEN
    ALTER TABLE atendimentos
      ADD CONSTRAINT atendimentos_tipo_contato_check
      CHECK (tipo_contato IS NULL OR tipo_contato IN ('ligacao', 'chat'));
  END IF;
END $$;

-- 3) Index pra filtrar/agrupar rápido --------------------------------------
CREATE INDEX IF NOT EXISTS idx_atendimentos_tipo_contato
  ON atendimentos(tipo_contato);

-- 4) Backfill --------------------------------------------------------------
-- Atendimentos com id_ligacao preenchido viram 'ligacao'; o resto 'chat'.
UPDATE atendimentos
SET tipo_contato = 'ligacao'
WHERE id_ligacao IS NOT NULL AND tipo_contato IS NULL;

UPDATE atendimentos
SET tipo_contato = 'chat'
WHERE id_ligacao IS NULL AND tipo_contato IS NULL;

-- 5) Conferência (opcional, só rode após o backfill) -----------------------
-- SELECT tipo_contato, COUNT(*) AS total
-- FROM atendimentos
-- GROUP BY tipo_contato
-- ORDER BY tipo_contato;
