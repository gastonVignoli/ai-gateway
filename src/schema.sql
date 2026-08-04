CREATE TABLE usage (
  api_key TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  requests INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0
);