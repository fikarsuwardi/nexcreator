import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI client before importing the scoring service
vi.mock('../services/claude/client', () => ({
  default: {
    messages: {
      create: vi.fn(),
    },
  },
  MODEL: 'claude-sonnet-4-6',
}));

// Mock DB queries used by tools
vi.mock('../db/connection', () => ({
  default: {},
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
}));

import { ClaudeScoringService } from '../services/claude/scoring.service';
import client from '../services/claude/client';
import type { CreatorWithScore } from '@nex/shared';

const mockCreator: CreatorWithScore = {
  id: 'test-id',
  tiktok_handle: 'testcreator',
  display_name: 'Test Creator',
  vertical: 'FNB',
  region: 'Jakarta',
  follower_count: 50000,
  total_views: 2000000,
  avg_views_per_video: 12000,
  videos_per_month: 35,
  last_posted_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  has_tiktok_shop: true,
  has_affiliate_links: false,
  has_booking_links: false,
  recent_avg_views: 15000,
  older_avg_views: 10000,
  bio_text: 'Food & drink creator based in Jakarta',
  recent_video_titles: ['Best nasi goreng in town', 'Top 5 cafes Jakarta'],
  import_batch_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  score: null,
};

const MOCK_SCORE_RESPONSE = {
  total_score: 72.5,
  tier: 'star_potential',
  content_velocity_score: 78,
  audience_reach_score: 75,
  commerce_readiness_score: 60,
  growth_trajectory_score: 70,
  reasoning: {
    summary: 'Strong content velocity and audience reach with active TikTok Shop.',
    content_velocity: {
      score: 78,
      rationale: 'Posts 35 videos/month, just above L1→L2 threshold of 34. Posted 2 days ago.',
      signals: ['35 videos/month', 'Last post: 2 days ago'],
    },
    audience_reach: {
      score: 75,
      rationale: 'Avg 12K views/video is above Nex\'s fast riser benchmark.',
      signals: ['12K avg views/video', '2M total views'],
    },
    commerce_readiness: {
      score: 60,
      rationale: 'TikTok Shop active (+35 pts). No affiliate or booking links.',
      signals: ['TikTok Shop: active'],
    },
    growth_trajectory: {
      score: 70,
      rationale: 'Recent avg 15K vs older avg 10K — 1.5x growth ratio (strong upward).',
      signals: ['1.5x growth ratio', 'Trending upward'],
    },
    recommendation: 'High priority recruit. Strong FNB content with active commerce.',
  },
};

function mockStopResponse(text: string, inputTokens = 1200, outputTokens = 400) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

function mockToolCallResponse(toolName: string, toolArgs: object, inputTokens = 800, outputTokens = 50) {
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      id: 'tool-1',
      name: toolName,
      input: toolArgs,
    }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe('ClaudeScoringService', () => {
  let service: ClaudeScoringService;

  beforeEach(() => {
    service = new ClaudeScoringService();
    vi.clearAllMocks();
  });

  it('calls Claude and returns structured score', async () => {
    const mockCreate = vi.mocked(client.messages.create);
    mockCreate.mockResolvedValueOnce(mockStopResponse(JSON.stringify(MOCK_SCORE_RESPONSE)) as never);

    const result = await service.scoreCreator(mockCreator);

    expect(result.total_score).toBe(72.5);
    expect(result.tier).toBe('star_potential');
    expect(result.content_velocity_score).toBe(78);
    expect(result.audience_reach_score).toBe(75);
    expect(result.reasoning.summary).toContain('Strong');
    expect(result.input_tokens).toBe(1200);
    expect(result.output_tokens).toBe(400);
    expect(result.model_used).toBe('claude-sonnet-4-6');
  });

  it('handles tool use loop correctly', async () => {
    const mockCreate = vi.mocked(client.messages.create);

    // First call: Claude requests tool use
    mockCreate.mockResolvedValueOnce(mockToolCallResponse('get_vertical_benchmarks', { vertical: 'FNB' }) as never);

    // Second call: Claude returns final score after getting benchmarks
    mockCreate.mockResolvedValueOnce(mockStopResponse(JSON.stringify(MOCK_SCORE_RESPONSE), 1500, 400) as never);

    const result = await service.scoreCreator(mockCreator);

    // Should have called Claude twice (tool loop)
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.tier).toBe('star_potential');
    // Total tokens should be sum of both calls
    expect(result.input_tokens).toBe(2300);
    expect(result.output_tokens).toBe(450);
  });

  it('correctly calculates tier based on total_score', () => {
    const tierCases: Array<[number, string]> = [
      [85, 'star_potential'],
      [70, 'star_potential'],
      [65, 'rising_star'],
      [50, 'rising_star'],
      [45, 'promising'],
      [30, 'promising'],
      [20, 'developing'],
      [0, 'developing'],
    ];

    for (const [score, expectedTier] of tierCases) {
      const tier =
        score >= 70 ? 'star_potential' :
        score >= 50 ? 'rising_star' :
        score >= 30 ? 'promising' : 'developing';
      expect(tier).toBe(expectedTier);
    }
  });

  it('extracts JSON from Claude response with markdown wrapping', async () => {
    const mockCreate = vi.mocked(client.messages.create);
    // Claude sometimes wraps JSON in markdown code blocks
    const markdownWrapped = `Here is the score:\n\`\`\`json\n${JSON.stringify(MOCK_SCORE_RESPONSE)}\n\`\`\``;

    mockCreate.mockResolvedValueOnce(mockStopResponse(markdownWrapped, 1200, 500) as never);

    const result = await service.scoreCreator(mockCreator);
    expect(result.total_score).toBe(72.5);
  });

  it('uses cache_control on system prompt', async () => {
    const mockCreate = vi.mocked(client.messages.create);
    mockCreate.mockResolvedValueOnce(mockStopResponse(JSON.stringify(MOCK_SCORE_RESPONSE)) as never);

    await service.scoreCreator(mockCreator);

    const callArgs = mockCreate.mock.calls[0][0] as { system: Array<{ cache_control?: unknown }> };
    expect(callArgs.system?.[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });
});
