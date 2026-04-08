# Creator Potential Scoring Rubric — Nex Entertainment

> **Context:** This scoring framework was developed from analysis of 6,962 Indonesian TikTok GO creators tracked over 13 months (March 2025–March 2026). The weights and thresholds are calibrated to what actually predicted creator success (reaching L3/L4 levels), not theoretical assumptions.

---

## Scoring Dimensions

### 1. Content Velocity — 30% weight

**Why it matters:** This was the most controllable predictor of level-up success. Fast risers (creators who went from L0/L1 to L3+) posted 4.4× more than stuck creators (55 vs 12.5 videos/month). The L1→L2 promotion threshold requires a median of ~34 videos/month.

| Signal | Score |
|--------|-------|
| 50+ posts/month, near-daily uploads | 100 |
| 30–49 posts/month (5–6×/week) | 85 |
| 15–29 posts/month (several times/week) | 70 |
| 8–14 posts/month (~2×/week) | 50 |
| 3–7 posts/month (~weekly) | 30 |
| 1–2 posts/month | 10 |
| 0 recent posts (inactive) | 0 |

**Implementation note:** The score should also factor in recency. A creator with 100 lifetime posts but none in the last 30 days should score 0. A creator with 20 posts, all from the last month, should score higher than one with 20 posts spread over 6 months.

---

### 2. Audience Reach — 30% weight

**Why it matters:** Combines total view accumulation with per-post efficiency. Views/video proved to be the single strongest predictor of level-up — fast risers averaged 22K views/video vs 4.3K for stuck creators. The L1→L2 threshold requires ~273K total views/month.

This dimension has two sub-components, equally weighted:

#### Total Monthly Views (50% of Reach Score)

| Estimated total monthly views | Score |
|-------------------------------|-------|
| 1M+ | 100 |
| 500K–1M | 85 |
| 200K–500K | 70 |
| 100K–200K | 55 |
| 50K–100K | 40 |
| 10K–50K | 20 |
| < 10K | 5 |

#### Views Per Video (50% of Reach Score)

| Avg views per video | Score | Benchmark context |
|---------------------|-------|-------------------|
| 25K+ | 100 | Approaching L3→L4 benchmark |
| 15K–25K | 85 | At L2→L3 level |
| 8K–15K | 70 | Strong L1→L2 candidate |
| 5K–8K | 55 | Above fast-riser threshold |
| 2K–5K | 35 | At L1 average |
| 500–2K | 15 | Below L1 average |
| < 500 | 5 | Below L0 median |

**Reach Score** = (Total Views Score × 0.5) + (Views/Video Score × 0.5)

---

### 3. Commerce Readiness — 25% weight

**Why it matters:** Any sign of existing commerce behavior is a strong predictor of success. The median L1→L2 promotion required $594 GMV/month and 30 orders. Even tiny signals matter — creators generating just $6 GMV in their first month were already above the promotion threshold median.

Key insight: The data shows a major shift by level — L1 creators earn 60% of GMV from close-loop (in-app transactions) but L3+ creators earn 80% from open-loop (external bookings). Creators already showing open-loop behavior (driving external bookings for hotels, restaurants, attractions) are exhibiting L3+ patterns early.

| Signal observed | Score |
|-----------------|-------|
| Active TikTok Shop + affiliate links + evidence of sales | 100 |
| Has TikTok Shop or affiliate product tags on videos | 80 |
| Links in bio to booking sites, mentions promo codes or prices | 65 |
| Tags POI locations, mentions "where to book" or prices in captions | 50 |
| Tags locations/businesses but no explicit commerce | 35 |
| Pure content, no commerce signals at all | 10 |

---

### 4. Growth Trajectory — 15% weight

**Why it matters:** Trajectory matters as much as current level. In our data, 293 creators who were L3+ subsequently declined — representing ~$1M/month in at-risk GMV. A creator on an upward arc is more valuable than one at the same level but declining.

| Signal observed | Score |
|-----------------|-------|
| Recent videos significantly outperform older ones (views trending up) | 100 |
| Steady performance, recent ≈ older | 70 |
| Mixed — some recent hits, some misses | 50 |
| Declining — recent posts get fewer views than older content | 20 |
| Too few posts to assess trajectory | 30 |

---

## Final Score Calculation

```
Potential Score = (Content Velocity × 0.30)
               + (Audience Reach × 0.30)
               + (Commerce Readiness × 0.25)
               + (Growth Trajectory × 0.15)
```

## Tier Assignment

| Score Range | Tier | Interpretation |
|-------------|------|----------------|
| 70–100 | **Star Potential** | Matches fast-riser profile on 3–4 dimensions. Likely to reach L3+ within 6 months. Priority recruit. |
| 50–69 | **Rising Star** | Strong on 2+ dimensions. Good L2 candidate with coaching. Worth investing in. |
| 30–49 | **Promising** | Shows at least one strong signal. May need development but could surprise. |
| 0–29 | **Developing** | Below fast-riser benchmarks on most dimensions. Recruit only if no better options available. |

---

## Key Benchmarks for Calibration

Use these reference points when implementing and testing the scoring model:

| Metric | L1 Stuck | L1→L2 Threshold | Fast Riser (L3+) | L4 Average |
|--------|----------|------------------|-------------------|------------|
| Videos/month | 12.5 | ~34 | 55 | 55+ |
| Views/video | 4,300 | ~8,000 | 22,000 | 22,000+ |
| Total monthly views | 54,000 | ~273,000 | 1,200,000 | 1,200,000+ |
| Monthly GMV (USD) | $49 | ~$594 | $3,000+ | $16,267 |
| Monthly orders | 2 | ~30 | 100+ | 300+ |
| GMV/video (ACC) | — | — | — | $656 |
| GMV/video (FNB) | — | — | — | $9 |

---

## What NOT to Use for Scoring

These factors are explicitly excluded based on the data analysis:

- **Follower count** — weak predictor of level-up success. Used only as a minimum qualification filter (≥500), not as a scoring input.
- **Production quality** — not measured in the data and not correlated with commercial success. A shaky phone video with 50K views is worth more than a cinematic edit with 500.
- **Account age** — newer accounts that post aggressively outperform older dormant ones.
- **Bio completeness** — cosmetic signal, no proven correlation with performance.
