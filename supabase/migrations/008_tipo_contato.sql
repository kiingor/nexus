-- ============================================================================
-- Migration 008 — Tipo de contato (ligação x chat) para atendimentos
-- ============================================================================
-- Cria a tabela tipo_contato como lookup (ligação, chat, ...) e adiciona
-- a FK em atendimentos. Faz backfill simples: atendimentos com id_ligacao
-- preenchido viram "ligacao", os demais "chat".
--
-- Como rodar:
--   1. Abre o Supabase Dashboard do seu projeto
--   2. SQL Editor → New query
--   3. Cola este arquivo inteiro e executa
-- ============================================================================

-- 1) Tabela de tipos --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipo_contato (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,        -- chave técnica: 'ligacao', 'chat', ...
  label      TEXT NOT NULL,               -- nome amigável: 'Ligação', 'Chat'
  icone      TEXT,                        -- identificador opcional ('phone', 'message-circle')
  cor        TEXT,                        -- cor de tema opcional ('blue', 'green')
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tipo_contato IS 'Tipos de canal pelo qual o atendimento foi recebido (ligação, chat, etc).';

-- 2) Seed dos tipos básicos -------------------------------------------------
INSERT INTO tipo_contato (nome, label, icone, cor) VALUES
  ('ligacao', 'Ligação', 'phone',          'blue'),
  ('chat',    'Chat',    'message-circle', 'green')
ON CONFLICT (nome) DO NOTHING;

-- 3) FK em atendimentos -----------------------------------------------------
ALTER TABLE atendimentos
  ADD COLUMN IF NOT EXISTS tipo_contato_id INTEGER
  REFERENCES tipo_contato(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atendimentos_tipo_contato
  ON atendimentos(tipo_contato_id);

-- 4) Backfill ---------------------------------------------------------------
-- Atendimentos com id_ligacao preenchido = ligação.
-- Atendimentos sem id_ligacao = chat (assumindo o padrão atual do sistema).
UPDATE atendimentos
SET tipo_contato_id = (SELECT id FROM tipo_contato WHERE nome = 'ligacao')
WHERE id_ligacao IS NOT NULL
  AND tipo_contato_id IS NULL;

UPDATE atendimentos
SET tipo_contato_id = (SELECT id FROM tipo_contato WHERE nome = 'chat')
WHERE id_ligacao IS NULL
  AND tipo_contato_id IS NULL;

-- 5) Conferência ------------------------------------------------------------
-- Esta linha NÃO altera nada — só mostra a distribuição final pra você
-- conferir no painel do SQL Editor depois de rodar a migration.
-- SELECT t.label, COUNT(a.id) AS total
-- FROM tipo_contato t
-- LEFT JOIN atendimentos a ON a.tipo_contato_id = t.id
-- GROUP BY t.id, t.label
-- ORDER BY t.id;
