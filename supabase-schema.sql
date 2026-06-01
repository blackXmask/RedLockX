-- ============================================================
-- RedLockX — Prompt Injection Firewall
-- Supabase / PostgreSQL Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Analysis logs (all prompt scans)
CREATE TABLE IF NOT EXISTS analysis_logs (
  id           SERIAL PRIMARY KEY,
  prompt       TEXT    NOT NULL,
  verdict      TEXT    NOT NULL CHECK (verdict IN ('BLOCK','ALLOW')),
  risk_score   REAL    NOT NULL,
  is_safe      BOOLEAN NOT NULL,
  attack_type  TEXT,
  hybrid_probability REAL NOT NULL,
  ml_status    TEXT    NOT NULL,
  ml_confidence      REAL NOT NULL,
  explanation  TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_verdict    ON analysis_logs (verdict);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs (created_at DESC);

-- 2. LLM provider settings (one active row)
CREATE TABLE IF NOT EXISTS llm_settings (
  id         SERIAL PRIMARY KEY,
  provider   TEXT NOT NULL CHECK (provider IN ('openai','groq','gemini','custom')),
  api_key    TEXT NOT NULL,
  model      TEXT NOT NULL,
  base_url   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_llm_settings_updated_at ON llm_settings;
CREATE TRIGGER trg_llm_settings_updated_at
  BEFORE UPDATE ON llm_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Chat messages (per session)
CREATE TABLE IF NOT EXISTS chat_messages (
  id             SERIAL PRIMARY KEY,
  session_id     TEXT    NOT NULL,
  role           TEXT    NOT NULL CHECK (role IN ('user','assistant','system')),
  content        TEXT    NOT NULL,
  verdict        TEXT    CHECK (verdict IN ('BLOCK','ALLOW')),
  risk_score     REAL,
  is_blocked     BOOLEAN,
  blocked_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages (created_at DESC);

-- ============================================================
-- Row Level Security (optional — enable for multi-tenant)
-- ============================================================
-- ALTER TABLE analysis_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE llm_settings   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages  ENABLE ROW LEVEL SECURITY;
