-- Support tickets imported from external chat platforms (WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS support_tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid UNIQUE NOT NULL,
  ticket_numero    integer,
  ticket_status    text,
  ticket_canal     text,
  ticket_prioridade text,
  setor            text,
  atendente        text,
  suporte_id       text,
  criado_em        timestamptz,
  primeira_resposta timestamptz,
  encerrado_em     timestamptz,
  cliente_id       uuid,
  cliente_nome     text,
  cliente_telefone text,
  cliente_email    text,
  cliente_cnpj     text,
  cliente_pdv      text,
  duracao_total    text,
  tempo_primeira_resposta text,
  total_mensagens  integer DEFAULT 0,
  mensagens_cliente integer DEFAULT 0,
  mensagens_colaborador integer DEFAULT 0,
  has_audio        boolean DEFAULT false,
  total_audios     integer DEFAULT 0,
  has_imagem       boolean DEFAULT false,
  total_imagens    integer DEFAULT 0,
  chat_history     text,
  product_id       uuid REFERENCES products(id) ON DELETE SET NULL,
  raw_data         jsonb,
  imported_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id     ON support_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_produto        ON support_tickets(product_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status         ON support_tickets(ticket_status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_canal          ON support_tickets(ticket_canal);
CREATE INDEX IF NOT EXISTS idx_support_tickets_criado_em      ON support_tickets(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_cliente_cnpj   ON support_tickets(cliente_cnpj);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage support_tickets"
  ON support_tickets FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
