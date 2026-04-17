-- Monitoria de atendimentos: avaliações de qualidade e transcrições de chamadas
CREATE TABLE IF NOT EXISTS monitoria (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_avaliacao   numeric(3,1) CHECK (nota_avaliacao >= 0 AND nota_avaliacao <= 10),
  data_avaliacao   timestamptz,
  transcricao      text,
  nota_cliente     numeric(3,1) CHECK (nota_cliente >= 0 AND nota_cliente <= 10),
  ramal            text,
  numero_contato   text,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monitoria_data_avaliacao ON monitoria(data_avaliacao DESC);
CREATE INDEX IF NOT EXISTS idx_monitoria_ramal          ON monitoria(ramal);
CREATE INDEX IF NOT EXISTS idx_monitoria_numero_contato ON monitoria(numero_contato);

ALTER TABLE monitoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage monitoria"
  ON monitoria FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
