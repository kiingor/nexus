-- Adiciona campo de questionário à tabela de monitoria
ALTER TABLE monitoria
  ADD COLUMN IF NOT EXISTS questionario jsonb;
