-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMs
CREATE TYPE vertical_type AS ENUM ('ACC', 'FNB', 'TTD');
CREATE TYPE tier_type AS ENUM ('star_potential', 'rising_star', 'promising', 'developing');
CREATE TYPE language_type AS ENUM ('en', 'id');

-- CSV import tracking
CREATE TABLE csv_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        VARCHAR(255) NOT NULL,
  total_rows      INTEGER NOT NULL,
  processed_rows  INTEGER NOT NULL DEFAULT 0,
  failed_rows     INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  errors          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Core creator profiles
CREATE TABLE creators (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_handle         VARCHAR(100) NOT NULL UNIQUE,
  display_name          VARCHAR(200),
  vertical              vertical_type NOT NULL,
  region                VARCHAR(100),
  follower_count        INTEGER NOT NULL DEFAULT 0,
  total_views           BIGINT NOT NULL DEFAULT 0,
  avg_views_per_video   INTEGER NOT NULL DEFAULT 0,
  videos_per_month      NUMERIC(6,2) NOT NULL DEFAULT 0,
  last_posted_at        TIMESTAMPTZ,
  has_tiktok_shop       BOOLEAN NOT NULL DEFAULT false,
  has_affiliate_links   BOOLEAN NOT NULL DEFAULT false,
  has_booking_links     BOOLEAN NOT NULL DEFAULT false,
  recent_avg_views      INTEGER,
  older_avg_views       INTEGER,
  bio_text              TEXT,
  recent_video_titles   TEXT[],
  import_batch_id       UUID REFERENCES csv_imports(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Claude scoring output (separate from creators to allow rescoring)
CREATE TABLE creator_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  total_score               NUMERIC(5,2) NOT NULL,
  tier                      tier_type NOT NULL,
  content_velocity_score    NUMERIC(5,2) NOT NULL,
  audience_reach_score      NUMERIC(5,2) NOT NULL,
  commerce_readiness_score  NUMERIC(5,2) NOT NULL,
  growth_trajectory_score   NUMERIC(5,2) NOT NULL,
  reasoning                 JSONB NOT NULL,
  input_tokens              INTEGER,
  output_tokens             INTEGER,
  model_used                VARCHAR(50) NOT NULL DEFAULT 'claude-sonnet-4-6',
  scored_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_creator_score UNIQUE (creator_id)
);

-- Indexes
CREATE INDEX idx_creators_vertical ON creators(vertical);
CREATE INDEX idx_creators_region ON creators(region);
CREATE INDEX idx_creators_follower_count ON creators(follower_count);
CREATE INDEX idx_creator_scores_tier ON creator_scores(tier);
CREATE INDEX idx_creator_scores_total ON creator_scores(total_score DESC);
