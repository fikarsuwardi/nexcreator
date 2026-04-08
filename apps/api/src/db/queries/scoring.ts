import { query, queryOne } from '../connection';
import type { CreatorScore } from '@nex/shared';

export async function upsertScore(
  creatorId: string,
  score: Omit<CreatorScore, 'id' | 'creator_id' | 'scored_at'>
): Promise<CreatorScore> {
  const row = await queryOne<CreatorScore>(
    `INSERT INTO creator_scores (
      creator_id, total_score, tier,
      content_velocity_score, audience_reach_score,
      commerce_readiness_score, growth_trajectory_score,
      reasoning, input_tokens, output_tokens, model_used
    ) VALUES ($1,$2,$3::tier_type,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (creator_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      tier = EXCLUDED.tier,
      content_velocity_score = EXCLUDED.content_velocity_score,
      audience_reach_score = EXCLUDED.audience_reach_score,
      commerce_readiness_score = EXCLUDED.commerce_readiness_score,
      growth_trajectory_score = EXCLUDED.growth_trajectory_score,
      reasoning = EXCLUDED.reasoning,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      model_used = EXCLUDED.model_used,
      scored_at = NOW()
    RETURNING *`,
    [
      creatorId, score.total_score, score.tier,
      score.content_velocity_score, score.audience_reach_score,
      score.commerce_readiness_score, score.growth_trajectory_score,
      JSON.stringify(score.reasoning), score.input_tokens, score.output_tokens, score.model_used,
    ]
  );
  return row!;
}

export async function getScore(creatorId: string): Promise<CreatorScore | null> {
  return queryOne<CreatorScore>(
    'SELECT * FROM creator_scores WHERE creator_id = $1',
    [creatorId]
  );
}

export async function getManyScores(creatorIds: string[]): Promise<CreatorScore[]> {
  if (creatorIds.length === 0) return [];
  return query<CreatorScore>(
    'SELECT * FROM creator_scores WHERE creator_id = ANY($1)',
    [creatorIds]
  );
}
