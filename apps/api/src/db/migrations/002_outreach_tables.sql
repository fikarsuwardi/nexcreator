-- Outreach ENUMs
CREATE TYPE outreach_channel AS ENUM ('tiktok_dm', 'email', 'instagram_dm');
CREATE TYPE outreach_tone AS ENUM ('casual', 'professional', 'enthusiastic');

-- Multi-turn conversation state for regeneration
CREATE TABLE outreach_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  channel           outreach_channel NOT NULL,
  tone              outreach_tone NOT NULL,
  language          language_type NOT NULL DEFAULT 'en',
  messages          JSONB NOT NULL DEFAULT '[]',
  generation_count  INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated outreach messages
CREATE TABLE outreach_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  channel           outreach_channel NOT NULL,
  tone              outreach_tone NOT NULL,
  language          language_type NOT NULL DEFAULT 'en',
  subject           VARCHAR(500),
  body              TEXT NOT NULL,
  generation_index  INTEGER NOT NULL DEFAULT 0,
  conversation_id   UUID REFERENCES outreach_conversations(id),
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  model_used        VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Batch outreach operations
CREATE TABLE outreach_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_ids       UUID[] NOT NULL,
  channel           outreach_channel NOT NULL,
  tone              outreach_tone NOT NULL,
  language          language_type NOT NULL DEFAULT 'en',
  total_count       INTEGER NOT NULL,
  completed_count   INTEGER NOT NULL DEFAULT 0,
  failed_count      INTEGER NOT NULL DEFAULT 0,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_outreach_creator ON outreach_messages(creator_id);
CREATE INDEX idx_outreach_conversation ON outreach_messages(conversation_id);
