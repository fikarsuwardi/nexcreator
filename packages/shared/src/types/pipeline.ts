import type { OutreachChannel } from './outreach';

export type PipelineStage =
  | 'discovered'
  | 'contacted'
  | 'responded'
  | 'negotiating'
  | 'onboarded'
  | 'declined'
  | 'unresponsive';

export const PIPELINE_STAGES: PipelineStage[] = [
  'discovered',
  'contacted',
  'responded',
  'negotiating',
  'onboarded',
];

export const TERMINAL_STAGES: PipelineStage[] = ['declined', 'unresponsive'];

export interface PipelineEntry {
  id: string;
  creator_id: string;
  current_stage: PipelineStage;
  contacted_at: string | null;
  responded_at: string | null;
  negotiating_at: string | null;
  onboarded_at: string | null;
  closed_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineStageHistory {
  id: string;
  pipeline_id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  outreach_message_id: string | null;
  transitioned_by: string | null;
  notes: string | null;
  transitioned_at: string;
}

export interface PipelineAnalytics {
  discovered_count: number;
  contacted_count: number;
  responded_count: number;
  negotiating_count: number;
  onboarded_count: number;
  declined_count: number;
  unresponsive_count: number;
  response_rate_pct: number | null;
  avg_days_to_contact: number | null;
  avg_days_to_respond: number | null;
}

export interface FollowUpMessage {
  id: string;
  creator_id: string;
  pipeline_id: string;
  original_message_id: string;
  days_since_contact: number;
  body: string;
  channel: OutreachChannel;
  input_tokens: number | null;
  output_tokens: number | null;
  model_used: string;
  created_at: string;
}
