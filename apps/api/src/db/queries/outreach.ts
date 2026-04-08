import { query, queryOne } from '../connection';
import type { OutreachMessage, OutreachConversation, OutreachBatch } from '@nex/shared';

export async function createConversation(
  creatorId: string,
  channel: string,
  tone: string,
  language: string
): Promise<OutreachConversation> {
  const row = await queryOne<OutreachConversation>(
    `INSERT INTO outreach_conversations (creator_id, channel, tone, language)
    VALUES ($1, $2::outreach_channel, $3::outreach_tone, $4::language_type)
    RETURNING *`,
    [creatorId, channel, tone, language]
  );
  return row!;
}

export async function getConversation(id: string): Promise<OutreachConversation | null> {
  return queryOne<OutreachConversation>(
    'SELECT * FROM outreach_conversations WHERE id = $1',
    [id]
  );
}

export async function updateConversation(
  id: string,
  messages: unknown[],
  generationCount: number
): Promise<void> {
  await query(
    `UPDATE outreach_conversations
    SET messages = $2, generation_count = $3, updated_at = NOW()
    WHERE id = $1`,
    [id, JSON.stringify(messages), generationCount]
  );
}

export async function saveMessage(data: {
  creatorId: string;
  channel: string;
  tone: string;
  language: string;
  subject?: string;
  body: string;
  generationIndex: number;
  conversationId: string;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<OutreachMessage> {
  const row = await queryOne<OutreachMessage>(
    `INSERT INTO outreach_messages (
      creator_id, channel, tone, language, subject, body,
      generation_index, conversation_id, input_tokens, output_tokens
    ) VALUES ($1,$2::outreach_channel,$3::outreach_tone,$4::language_type,$5,$6,$7,$8,$9,$10)
    RETURNING *`,
    [
      data.creatorId, data.channel, data.tone, data.language,
      data.subject ?? null, data.body, data.generationIndex,
      data.conversationId, data.inputTokens ?? null, data.outputTokens ?? null,
    ]
  );
  return row!;
}

export async function getMessagesByCreator(creatorId: string): Promise<OutreachMessage[]> {
  return query<OutreachMessage>(
    'SELECT * FROM outreach_messages WHERE creator_id = $1 ORDER BY created_at DESC',
    [creatorId]
  );
}

export async function getMessage(id: string): Promise<OutreachMessage | null> {
  return queryOne<OutreachMessage>('SELECT * FROM outreach_messages WHERE id = $1', [id]);
}

export async function createBatch(data: {
  creatorIds: string[];
  channel: string;
  tone: string;
  language: string;
}): Promise<OutreachBatch> {
  const row = await queryOne<OutreachBatch>(
    `INSERT INTO outreach_batches (creator_ids, channel, tone, language, total_count)
    VALUES ($1, $2::outreach_channel, $3::outreach_tone, $4::language_type, $5)
    RETURNING *`,
    [data.creatorIds, data.channel, data.tone, data.language, data.creatorIds.length]
  );
  return row!;
}

export async function updateBatch(
  id: string,
  data: Partial<Pick<OutreachBatch, 'completed_count' | 'failed_count' | 'status' | 'completed_at'>>
): Promise<void> {
  const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`);
  await query(
    `UPDATE outreach_batches SET ${fields.join(', ')} WHERE id = $1`,
    [id, ...Object.values(data)]
  );
}

export async function getBatch(id: string): Promise<OutreachBatch | null> {
  return queryOne<OutreachBatch>('SELECT * FROM outreach_batches WHERE id = $1', [id]);
}
