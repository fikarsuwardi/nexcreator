-- Pipeline ENUMs
CREATE TYPE pipeline_stage AS ENUM (
  'discovered', 'contacted', 'responded',
  'negotiating', 'onboarded', 'declined', 'unresponsive'
);

-- Pipeline entries: one per creator
CREATE TABLE pipeline_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  current_stage   pipeline_stage NOT NULL DEFAULT 'discovered',
  contacted_at    TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  negotiating_at  TIMESTAMPTZ,
  onboarded_at    TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  assigned_to     VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pipeline_creator UNIQUE (creator_id)
);

-- Full audit trail of stage transitions
CREATE TABLE pipeline_stage_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id           UUID NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  from_stage            pipeline_stage,
  to_stage              pipeline_stage NOT NULL,
  outreach_message_id   UUID REFERENCES outreach_messages(id),
  transitioned_by       VARCHAR(100),
  notes                 TEXT,
  transitioned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI-generated follow-up messages
CREATE TABLE follow_up_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id            UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  pipeline_id           UUID NOT NULL REFERENCES pipeline_entries(id) ON DELETE CASCADE,
  original_message_id   UUID NOT NULL REFERENCES outreach_messages(id),
  days_since_contact    INTEGER NOT NULL,
  body                  TEXT NOT NULL,
  channel               outreach_channel NOT NULL,
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  model_used            VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Materialized view for dashboard analytics
CREATE MATERIALIZED VIEW pipeline_analytics AS
SELECT
  COUNT(*) FILTER (WHERE current_stage = 'discovered')   AS discovered_count,
  COUNT(*) FILTER (WHERE current_stage = 'contacted')    AS contacted_count,
  COUNT(*) FILTER (WHERE current_stage = 'responded')    AS responded_count,
  COUNT(*) FILTER (WHERE current_stage = 'negotiating')  AS negotiating_count,
  COUNT(*) FILTER (WHERE current_stage = 'onboarded')    AS onboarded_count,
  COUNT(*) FILTER (WHERE current_stage = 'declined')     AS declined_count,
  COUNT(*) FILTER (WHERE current_stage = 'unresponsive') AS unresponsive_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE responded_at IS NOT NULL)
    / NULLIF(COUNT(*) FILTER (WHERE contacted_at IS NOT NULL), 0), 2
  ) AS response_rate_pct,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (contacted_at - created_at)) / 86400
  ) FILTER (WHERE contacted_at IS NOT NULL), 1) AS avg_days_to_contact,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (responded_at - contacted_at)) / 86400
  ) FILTER (WHERE responded_at IS NOT NULL AND contacted_at IS NOT NULL), 1) AS avg_days_to_respond
FROM pipeline_entries;

CREATE INDEX idx_pipeline_stage ON pipeline_entries(current_stage);
CREATE INDEX idx_stage_history_pipeline ON pipeline_stage_history(pipeline_id);
