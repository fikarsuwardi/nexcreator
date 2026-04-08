export type Vertical = 'ACC' | 'FNB' | 'TTD';
export type Tier = 'star_potential' | 'rising_star' | 'promising' | 'developing';

export interface Creator {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  vertical: Vertical;
  region: string | null;
  follower_count: number;
  total_views: number;
  avg_views_per_video: number;
  videos_per_month: number;
  last_posted_at: string | null;
  has_tiktok_shop: boolean;
  has_affiliate_links: boolean;
  has_booking_links: boolean;
  recent_avg_views: number | null;
  older_avg_views: number | null;
  bio_text: string | null;
  recent_video_titles: string[] | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DimensionScore {
  score: number;
  rationale: string;
  signals: string[];
}

export interface ScoringReasoning {
  summary: string;
  content_velocity: DimensionScore;
  audience_reach: DimensionScore;
  commerce_readiness: DimensionScore;
  growth_trajectory: DimensionScore;
  recommendation: string;
}

export interface CreatorScore {
  id: string;
  creator_id: string;
  total_score: number;
  tier: Tier;
  content_velocity_score: number;
  audience_reach_score: number;
  commerce_readiness_score: number;
  growth_trajectory_score: number;
  reasoning: ScoringReasoning;
  input_tokens: number | null;
  output_tokens: number | null;
  model_used: string;
  scored_at: string;
}

export interface CreatorWithScore extends Creator {
  score: CreatorScore | null;
  in_pipeline?: boolean;
}

export interface CsvImport {
  id: string;
  filename: string;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errors: Array<{ row: number; handle: string; error: string }> | null;
  created_at: string;
  completed_at: string | null;
}
