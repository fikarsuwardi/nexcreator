import type Anthropic from '@anthropic-ai/sdk';
import { query } from '../../db/connection';

export const SCORING_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_vertical_benchmarks',
    description: `Retrieve benchmark statistics for a specific vertical (ACC/FNB/TTD) to calibrate scoring against real Nex creator performance data. Call this BEFORE scoring to get context-appropriate thresholds.`,
    input_schema: {
      type: 'object',
      properties: {
        vertical: {
          type: 'string',
          enum: ['ACC', 'FNB', 'TTD'],
          description: 'The content vertical to get benchmarks for',
        },
      },
      required: ['vertical'],
    },
  },
  {
    name: 'check_pipeline_status',
    description: `Check if a creator is already in the recruitment pipeline and at what stage. Prevents duplicate outreach.`,
    input_schema: {
      type: 'object',
      properties: {
        tiktok_handle: { type: 'string', description: 'TikTok handle to check' },
      },
      required: ['tiktok_handle'],
    },
  },
  {
    name: 'get_similar_creators',
    description: `Look up top-performing creators in the same vertical and region for comparative scoring context.`,
    input_schema: {
      type: 'object',
      properties: {
        vertical: { type: 'string', enum: ['ACC', 'FNB', 'TTD'] },
        region: { type: 'string' },
      },
      required: ['vertical'],
    },
  },
];

const VERTICAL_BENCHMARKS: Record<string, object> = {
  ACC: {
    vertical: 'ACC',
    description: 'Accommodation (Hotels, Villas, Staycations)',
    l1_to_l2_threshold: { videos_per_month: 34, views_per_month: 273000 },
    top_creator_avg_views_per_video: 22000,
    average_creator_views_per_video: 4300,
    fast_riser_videos_per_month: 55,
    stuck_creator_videos_per_month: 12.5,
    l4_monthly_gmv_usd: 16267,
    l1_monthly_gmv_usd: 49,
    key_commerce_signals: ['booking.com links', 'agoda links', 'hotel promo codes', 'checkout links'],
  },
  FNB: {
    vertical: 'FNB',
    description: 'Food & Beverage (Restaurants, Cafes, Food Delivery)',
    l1_to_l2_threshold: { videos_per_month: 34, views_per_month: 273000 },
    top_creator_avg_views_per_video: 18000,
    average_creator_views_per_video: 3800,
    fast_riser_videos_per_month: 50,
    stuck_creator_videos_per_month: 11,
    l4_monthly_gmv_usd: 14500,
    l1_monthly_gmv_usd: 45,
    key_commerce_signals: ['restaurant reservation links', 'food delivery affiliate', 'promo codes', 'menu pricing'],
  },
  TTD: {
    vertical: 'TTD',
    description: 'Things To Do (Attractions, Activities, Experiences)',
    l1_to_l2_threshold: { videos_per_month: 34, views_per_month: 273000 },
    top_creator_avg_views_per_video: 25000,
    average_creator_views_per_video: 5100,
    fast_riser_videos_per_month: 60,
    stuck_creator_videos_per_month: 14,
    l4_monthly_gmv_usd: 18000,
    l1_monthly_gmv_usd: 55,
    key_commerce_signals: ['klook links', 'traveloka links', 'activity booking', 'experience promo codes'],
  },
};

export async function executeTool(
  toolName: string,
  toolInput: Record<string, string>
): Promise<string> {
  switch (toolName) {
    case 'get_vertical_benchmarks': {
      const benchmarks = VERTICAL_BENCHMARKS[toolInput.vertical];
      return JSON.stringify(benchmarks ?? { error: 'Unknown vertical' });
    }
    case 'check_pipeline_status': {
      try {
        const rows = await query(
          `SELECT pe.current_stage, pe.contacted_at
          FROM pipeline_entries pe
          JOIN creators c ON pe.creator_id = c.id
          WHERE c.tiktok_handle = $1`,
          [toolInput.tiktok_handle]
        );
        if (rows.length === 0) {
          return JSON.stringify({ in_pipeline: false, message: 'Creator not in pipeline' });
        }
        const entry = rows[0] as { current_stage: string; contacted_at: string };
        return JSON.stringify({
          in_pipeline: true,
          current_stage: entry.current_stage,
          contacted_at: entry.contacted_at,
        });
      } catch {
        return JSON.stringify({ in_pipeline: false, message: 'Unable to check pipeline' });
      }
    }
    case 'get_similar_creators': {
      try {
        const rows = await query(
          `SELECT c.tiktok_handle, c.follower_count, c.avg_views_per_video, c.videos_per_month, cs.total_score, cs.tier
          FROM creators c
          JOIN creator_scores cs ON c.id = cs.creator_id
          WHERE c.vertical = $1::vertical_type
          ${toolInput.region ? 'AND c.region ILIKE $2' : ''}
          AND cs.total_score >= 60
          ORDER BY cs.total_score DESC
          LIMIT 3`,
          toolInput.region ? [toolInput.vertical, `%${toolInput.region}%`] : [toolInput.vertical]
        );
        return JSON.stringify({ top_creators: rows });
      } catch {
        return JSON.stringify({ top_creators: [] });
      }
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}
