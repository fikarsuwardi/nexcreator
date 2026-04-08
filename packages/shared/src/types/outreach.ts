export type OutreachChannel = 'tiktok_dm' | 'email' | 'instagram_dm';
export type OutreachTone = 'casual' | 'professional' | 'enthusiastic';
export type Language = 'en' | 'id';

export interface OutreachMessage {
  id: string;
  creator_id: string;
  channel: OutreachChannel;
  tone: OutreachTone;
  language: Language;
  subject: string | null;
  body: string;
  generation_index: number;
  conversation_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  model_used: string;
  created_at: string;
}

export interface OutreachConversation {
  id: string;
  creator_id: string;
  channel: OutreachChannel;
  tone: OutreachTone;
  language: Language;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  generation_count: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachBatch {
  id: string;
  creator_ids: string[];
  channel: OutreachChannel;
  tone: OutreachTone;
  language: Language;
  total_count: number;
  completed_count: number;
  failed_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  created_at: string;
  completed_at: string | null;
}

export interface GenerateOutreachRequest {
  creator_id: string;
  channel: OutreachChannel;
  tone: OutreachTone;
  language: Language;
}

export interface RegenerateOutreachRequest {
  conversation_id: string;
}

export interface BatchOutreachRequest {
  creator_ids: string[];
  channel: OutreachChannel;
  tone: OutreachTone;
  language: Language;
}
