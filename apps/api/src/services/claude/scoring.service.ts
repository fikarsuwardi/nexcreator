import type OpenAI from 'openai';
import client, { MODEL } from './client';
import { SCORING_TOOLS, executeTool } from './tools';
import type { CreatorWithScore, CreatorScore, ScoringReasoning } from '@nex/shared';

const SCORING_SYSTEM_PROMPT = `You are a TikTok creator scoring expert for Nex Entertainment, the #1 TikTok GO agency globally by GMV, managing 5,000+ creators across Indonesia and 400+ in the US.

This scoring framework is calibrated from analysis of 6,962 real Indonesian TikTok GO creators tracked over 13 months (March 2025–March 2026). Use these exact thresholds — they are proven predictors of creator success.

## IMPORTANT: What NOT to use for scoring
- Follower count — weak predictor. Use only as context, never as a scoring input.
- Production quality — not correlated with commercial success.
- Account age — newer aggressive posters outperform older dormant ones.

## Scoring Framework

### 1. Content Velocity (Weight: 30%)
Fast risers post 55/month vs 12.5 for stuck creators. L1→L2 threshold: ~34 videos/month.
A creator with 100 lifetime posts but none in 30 days scores 0. Recency is critical.

| Videos/month | Score |
|---|---|
| 50+ posts/month, near-daily | 100 |
| 30–49 posts/month | 85 |
| 15–29 posts/month | 70 |
| 8–14 posts/month | 50 |
| 3–7 posts/month | 30 |
| 1–2 posts/month | 10 |
| 0 recent posts or inactive | 0 |

### 2. Audience Reach (Weight: 30%)
Two equally-weighted sub-components (50% each):

**Sub-component A: Total Monthly Views**
| Monthly views | Score |
|---|---|
| 1M+ | 100 |
| 500K–1M | 85 |
| 200K–500K | 70 |
| 100K–200K | 55 |
| 50K–100K | 40 |
| 10K–50K | 20 |
| <10K | 5 |

**Sub-component B: Views Per Video** (strongest single predictor — fast risers avg 22K vs 4.3K for stuck)
| Avg views/video | Score |
|---|---|
| 25K+ | 100 |
| 15K–25K | 85 |
| 8K–15K | 70 |
| 5K–8K | 55 |
| 2K–5K | 35 |
| 500–2K | 15 |
| <500 | 5 |

Audience Reach Score = (Total Views Score × 0.5) + (Views/Video Score × 0.5)

### 3. Commerce Readiness (Weight: 25%)
Any commerce signal is a strong predictor. Open-loop behavior (external bookings) is an L3+ early indicator.

| Signal observed | Score |
|---|---|
| Active TikTok Shop + affiliate links + evidence of sales | 100 |
| Has TikTok Shop or affiliate product tags on videos | 80 |
| Links in bio to booking sites, promo codes or prices mentioned | 65 |
| Tags POI locations, mentions "where to book" or prices in captions | 50 |
| Tags locations/businesses but no explicit commerce | 35 |
| Pure content, no commerce signals at all | 10 |

### 4. Growth Trajectory (Weight: 15%)
Trajectory matters as much as current level. Compare recent performance vs older content.

| Signal observed | Score |
|---|---|
| Recent videos significantly outperform older ones (trending up) | 100 |
| Steady performance, recent ≈ older | 70 |
| Mixed — some recent hits, some misses | 50 |
| Declining — recent posts get fewer views than older | 20 |
| Too few posts to assess | 30 |

## Total Score Formula
total_score = (content_velocity × 0.30) + (audience_reach × 0.30) + (commerce_readiness × 0.25) + (growth_trajectory × 0.15)

## Tier Assignment
| Score | Tier | Meaning |
|---|---|---|
| 70–100 | star_potential | Matches fast-riser profile on 3–4 dimensions. Likely L3+ in 6 months. Priority recruit. |
| 50–69 | rising_star | Strong on 2+ dimensions. Good L2 candidate with coaching. |
| 30–49 | promising | At least one strong signal. May need development. |
| 0–29 | developing | Below fast-riser benchmarks on most dimensions. |

## Output Format
Respond ONLY with valid JSON:
{
  "total_score": <number 0-100>,
  "tier": <"star_potential"|"rising_star"|"promising"|"developing">,
  "content_velocity_score": <number 0-100>,
  "audience_reach_score": <number 0-100>,
  "commerce_readiness_score": <number 0-100>,
  "growth_trajectory_score": <number 0-100>,
  "reasoning": {
    "summary": "<2-3 sentence overall assessment referencing actual numbers>",
    "content_velocity": { "score": <number>, "rationale": "<cite exact videos/month and recency>", "signals": ["<signal1>"] },
    "audience_reach": { "score": <number>, "rationale": "<cite exact views/video and monthly views>", "signals": ["<signal1>"] },
    "commerce_readiness": { "score": <number>, "rationale": "<cite specific commerce signals observed>", "signals": ["<signal1>"] },
    "growth_trajectory": { "score": <number>, "rationale": "<cite trend direction with data>", "signals": ["<signal1>"] },
    "recommendation": "<specific, actionable recruiter recommendation>"
  }
}`;

function buildScoringPrompt(creator: CreatorWithScore): string {
  const recency = creator.last_posted_at
    ? `${Math.floor((Date.now() - new Date(creator.last_posted_at).getTime()) / 86400000)} days ago`
    : 'Unknown';

  const growthNote = creator.recent_avg_views && creator.older_avg_views
    ? `Recent 30d avg: ${creator.recent_avg_views.toLocaleString()} | Prior 31-90d avg: ${creator.older_avg_views.toLocaleString()} | Ratio: ${(creator.recent_avg_views / creator.older_avg_views).toFixed(2)}x`
    : 'Growth data not available';

  return `Score this TikTok creator candidate:

Handle: @${creator.tiktok_handle}
Vertical: ${creator.vertical}
Region: ${creator.region ?? 'Unknown'}
Followers: ${creator.follower_count.toLocaleString()}

Performance:
- Avg views/video: ${creator.avg_views_per_video.toLocaleString()}
- Total views: ${creator.total_views.toLocaleString()}
- Videos/month: ${creator.videos_per_month}
- Last posted: ${recency}

Commerce Signals:
- TikTok Shop: ${creator.has_tiktok_shop ? 'YES' : 'No'}
- Affiliate links: ${creator.has_affiliate_links ? 'YES' : 'No'}
- Booking/purchase links: ${creator.has_booking_links ? 'YES' : 'No'}

Growth: ${growthNote}
${creator.bio_text ? `\nBio: ${creator.bio_text.slice(0, 300)}` : ''}
${creator.recent_video_titles?.length ? `\nRecent titles: ${creator.recent_video_titles.slice(0, 5).join(' | ')}` : ''}

Use get_vertical_benchmarks to calibrate, then respond with JSON score only.`;
}

export class ClaudeScoringService {
  async scoreCreator(creator: CreatorWithScore): Promise<Omit<CreatorScore, 'id' | 'creator_id' | 'scored_at'>> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SCORING_SYSTEM_PROMPT },
      { role: 'user', content: buildScoringPrompt(creator) },
    ];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Agentic tool loop — Claude calls tools before producing final JSON score
    while (true) {
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0,
        tools: SCORING_TOOLS,
        messages,
      });

      totalInputTokens += response.usage?.prompt_tokens ?? 0;
      totalOutputTokens += response.usage?.completion_tokens ?? 0;

      const choice = response.choices[0];
      const finishReason = choice.finish_reason;
      const message = choice.message;

      if (finishReason === 'stop') {
        const text = message.content ?? '';

        // Extract JSON from response (Claude might wrap in markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Claude response');

        const scoreData = JSON.parse(jsonMatch[0]) as {
          total_score: number;
          tier: string;
          content_velocity_score: number;
          audience_reach_score: number;
          commerce_readiness_score: number;
          growth_trajectory_score: number;
          reasoning: ScoringReasoning;
        };

        return {
          total_score: Math.round(scoreData.total_score * 100) / 100,
          tier: scoreData.tier as CreatorScore['tier'],
          content_velocity_score: scoreData.content_velocity_score,
          audience_reach_score: scoreData.audience_reach_score,
          commerce_readiness_score: scoreData.commerce_readiness_score,
          growth_trajectory_score: scoreData.growth_trajectory_score,
          reasoning: scoreData.reasoning,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          model_used: MODEL,
        };
      }

      if (finishReason === 'tool_calls') {
        messages.push({ role: 'assistant', content: message.content, tool_calls: message.tool_calls });

        for (const toolCall of message.tool_calls ?? []) {
          if (toolCall.type !== 'function') continue;
          const fn = (toolCall as unknown as { function: { name: string; arguments: string } }).function;
          const input = JSON.parse(fn.arguments) as Record<string, string>;
          const result = await executeTool(fn.name, input);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      } else {
        throw new Error(`Unexpected finish reason: ${finishReason}`);
      }
    }
  }
}
