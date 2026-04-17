-- MCP API keys: bearer tokens nomeados com hash SHA-256 (nunca armazena plaintext)
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  prefix       text NOT NULL,               -- primeiros ~8 chars, exibido na UI
  key_hash     text NOT NULL UNIQUE,        -- SHA-256 hex do bearer completo
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_key_hash   ON mcp_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_revoked_at ON mcp_api_keys(revoked_at);

ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage mcp_api_keys"
  ON mcp_api_keys FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
