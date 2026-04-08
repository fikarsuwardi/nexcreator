# Nex Creator Sourcing, Outreach & Tracking Tool

A working prototype for discovering, scoring, and recruiting TikTok creators — powered by Claude AI.

## Quick Start (Docker)

```bash
# Copy env file and add your API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=your_key_here

# Run everything with one command
docker-compose up
```

- **Web:** http://localhost:3000
- **API:** http://localhost:4000

## Local Development

### Prerequisites
- Node.js 22+
- PostgreSQL 16 (user: `postgres`, password: `postgres`)
- Anthropic API key

### Setup

```bash
# Install dependencies
npm install

# Create database
psql -U postgres -c "CREATE DATABASE nex_creator_tool;"

# Run migrations
npm run db:migrate

# Set API key
echo "ANTHROPIC_API_KEY=sk-ant-..." >> apps/api/.env

# Start both services
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health

### Run Tests

```bash
npm test --workspace=apps/api
```

---

## Architecture

```
nex-creator-tool/
├── apps/
│   ├── api/          # Express.js REST API (Node.js + TypeScript)
│   └── web/          # Next.js 16 App Router frontend
└── packages/
    └── shared/       # Shared TypeScript types
```

### Tech Stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Server components, streaming support |
| Backend | Express.js + TypeScript | Simple, battle-tested, easy SSE |
| Database | PostgreSQL 16 | JSONB for reasoning, ENUM types, materialized views |
| AI | Claude Sonnet 4.6 | Best balance of capability and cost |

---

## Database Schema

### Key tables:
- **`creators`** — raw TikTok profile data fed to Claude
- **`creator_scores`** — Claude's 4-dimension scoring output with JSONB reasoning
- **`outreach_messages`** — generated messages per creator
- **`outreach_conversations`** — multi-turn conversation history for regeneration
- **`pipeline_entries`** — recruitment stage tracking (1 per creator)
- **`pipeline_stage_history`** — full audit trail of stage transitions
- **`pipeline_analytics`** — materialized view for dashboard metrics

Schema decisions:
- Scores are in a **separate table** from creators: allows rescoring without data loss and tracks scoring history
- Conversation history stored as **JSONB** in PostgreSQL (not Redis): eliminates a dependency, survives API restarts
- Stage timestamps **denormalized** on `pipeline_entries`: fast analytics queries without JOINs to history table

---

## Claude API Integration

### Features Used

| Feature | Where Used |
|---|---|
| **Tool use** | Scoring: Claude calls `get_vertical_benchmarks`, `check_pipeline_status`, `get_similar_creators` before scoring |
| **System prompts** | All 3 services have dedicated system prompts with `cache_control: ephemeral` |
| **Multi-turn conversations** | Outreach: regeneration loads DB conversation history; follow-up uses 2-turn analyze→write |
| **Streaming** | Outreach generation streams via SSE — recruiter sees message being written in real-time |

### Scoring Architecture (Module 1)

```
Creator data → Claude tool call (get_vertical_benchmarks)
            → Tool result returned to Claude  
            → Claude produces structured JSON score (0-100, 4 dimensions)
            → Store to DB with reasoning JSONB
```

Claude calls `get_vertical_benchmarks` to calibrate against actual Nex data before scoring. This improves score consistency across verticals.

### Outreach Architecture (Module 2)

```
Generate: POST /outreach/generate → SSE stream → store conversation history
Regenerate: load history from DB → append "different angle" prompt → new turn
```

Multi-turn regeneration stores the full conversation in `outreach_conversations.messages` (JSONB). Each regeneration appends to the history, ensuring Claude sees previous versions and produces meaningfully different output.

### Follow-up Architecture (Module 3)

```
Turn 1: Claude analyzes original message (what angle was used, what's new)
Turn 2: Claude writes follow-up referencing Turn 1 analysis
```

Two-turn approach produces measurably better follow-ups than single-turn. The analysis step forces Claude to identify a fresh angle before writing.

### Prompt Caching

All system prompts use `cache_control: { type: "ephemeral" }`. At ~100 creators per batch:
- Scoring: saves ~80,000 cached input tokens (~$0.10/session)
- Outreach batch: saves ~60,000 cached tokens (~$0.06/session)

---

## API Endpoints

```
GET    /api/v1/creators                    # List with filters
POST   /api/v1/creators                    # Create creator
POST   /api/v1/creators/import/csv         # CSV batch import
GET    /api/v1/creators/import/:batchId    # Poll import status

POST   /api/v1/scoring/creator/:id         # Score via Claude (tool use)
POST   /api/v1/scoring/batch               # Batch score
GET    /api/v1/scoring/creator/:id         # Get existing score

POST   /api/v1/outreach/generate           # Generate + SSE stream
POST   /api/v1/outreach/regenerate         # Multi-turn regeneration
POST   /api/v1/outreach/batch              # Batch generation
GET    /api/v1/outreach/batch/:batchId     # Poll batch status

GET    /api/v1/pipeline                    # Kanban data
POST   /api/v1/pipeline/:creatorId         # Add to pipeline
PATCH  /api/v1/pipeline/:creatorId/stage   # Move stage
GET    /api/v1/pipeline/analytics          # Dashboard metrics
POST   /api/v1/pipeline/followup/:id       # AI follow-up
GET    /api/v1/pipeline/export             # XLSX export
```

---

## Estimated API Costs (Claude Sonnet 4.6)

Pricing: $3.00/M input tokens, $15.00/M output tokens

| Operation | Tokens (in/out) | Cost |
|---|---|---|
| Score 1 creator | ~1,500 / ~800 | ~$0.017 |
| Score 50 creators (with cache) | ~75K / ~40K | ~$0.83 |
| Generate 1 outreach message | ~600 / ~300 | ~$0.006 |
| Batch outreach 50 creators | ~30K / ~15K | ~$0.32 |
| Smart follow-up (2-turn) | ~1,200 / ~400 | ~$0.010 |

Cost is displayed per operation in the UI.

---

## Tradeoffs & Decisions

**Structured outputs in scoring:** Could have used plain JSON prompt. Using the structured approach eliminates fragile JSON parsing — every score response is guaranteed to match the schema.

**PostgreSQL over SQLite:** JSONB for reasoning, ENUM type validation, MATERIALIZED VIEW for analytics, array types for video titles — all features used actively.

**Sequential batch processing:** Could use parallel requests for speed but risks hitting Claude's rate limits. Sequential with exponential backoff (SDK default: 5 retries) is more reliable for 50+ creator batches.

**Conversation history in DB:** Stateless API requires persisting conversation state. PostgreSQL eliminates a Redis dependency while remaining sufficient for a prototype at this scale.

---

## What I'd Improve With More Time

1. **Real TikTok data integration** — scraping or TikTok API to populate creator profiles automatically
2. **Claude Batches API** for offline scoring at scale (50% cheaper, but async — 24h completion)
3. **Recruiter authentication** — multi-user support, assigned_to pipeline entries
4. **Webhook outreach delivery** — actually send DMs/emails rather than copy-to-clipboard
5. **Score drift monitoring** — re-score creators weekly and track tier changes over time
