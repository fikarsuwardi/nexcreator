import { query, queryOne } from '../connection';
import type { PipelineEntry, PipelineStageHistory, PipelineAnalytics, FollowUpMessage } from '@nex/shared';

export async function getPipeline(): Promise<Array<PipelineEntry & { creator: unknown }>> {
  return query(
    `SELECT pe.*, row_to_json(c.*) AS creator, row_to_json(cs.*) AS score
    FROM pipeline_entries pe
    JOIN creators c ON pe.creator_id = c.id
    LEFT JOIN creator_scores cs ON c.id = cs.creator_id
    ORDER BY pe.updated_at DESC`
  );
}

export async function getPipelineEntry(creatorId: string): Promise<PipelineEntry | null> {
  return queryOne<PipelineEntry>(
    'SELECT * FROM pipeline_entries WHERE creator_id = $1',
    [creatorId]
  );
}

export async function createPipelineEntry(creatorId: string): Promise<PipelineEntry> {
  const row = await queryOne<PipelineEntry>(
    `INSERT INTO pipeline_entries (creator_id) VALUES ($1)
    ON CONFLICT (creator_id) DO UPDATE SET updated_at = NOW()
    RETURNING *`,
    [creatorId]
  );
  return row!;
}

export async function updatePipelineStage(
  creatorId: string,
  toStage: string,
  outreachMessageId?: string,
  notes?: string
): Promise<PipelineEntry> {
  const entry = await getPipelineEntry(creatorId);
  if (!entry) throw new Error('Pipeline entry not found');

  const stageTimestamps: Record<string, string> = {
    contacted: 'contacted_at',
    responded: 'responded_at',
    negotiating: 'negotiating_at',
    onboarded: 'onboarded_at',
    declined: 'closed_at',
    unresponsive: 'closed_at',
  };

  const tsField = stageTimestamps[toStage];
  const updateClause = tsField
    ? `, ${tsField} = NOW()`
    : '';

  const updated = await queryOne<PipelineEntry>(
    `UPDATE pipeline_entries
    SET current_stage = $2::pipeline_stage, updated_at = NOW()${updateClause}
    ${notes ? ', notes = $4' : ''}
    WHERE creator_id = $1
    RETURNING *`,
    notes ? [creatorId, toStage, null, notes] : [creatorId, toStage]
  );

  // Log history
  await query(
    `INSERT INTO pipeline_stage_history
    (pipeline_id, from_stage, to_stage, outreach_message_id, notes)
    VALUES ($1, $2::pipeline_stage, $3::pipeline_stage, $4, $5)`,
    [entry.id, entry.current_stage, toStage, outreachMessageId ?? null, notes ?? null]
  );

  return updated!;
}

export async function getStageHistory(creatorId: string): Promise<PipelineStageHistory[]> {
  return query<PipelineStageHistory>(
    `SELECT h.* FROM pipeline_stage_history h
    JOIN pipeline_entries pe ON h.pipeline_id = pe.id
    WHERE pe.creator_id = $1
    ORDER BY h.transitioned_at DESC`,
    [creatorId]
  );
}

export async function getAnalytics(): Promise<PipelineAnalytics> {
  // Refresh materialized view first
  await query('REFRESH MATERIALIZED VIEW pipeline_analytics');
  const rows = await query<PipelineAnalytics>('SELECT * FROM pipeline_analytics');
  return rows[0] ?? {
    discovered_count: 0, contacted_count: 0, responded_count: 0,
    negotiating_count: 0, onboarded_count: 0, declined_count: 0,
    unresponsive_count: 0, response_rate_pct: null,
    avg_days_to_contact: null, avg_days_to_respond: null,
  };
}

export async function saveFollowUp(data: Omit<FollowUpMessage, 'id' | 'created_at'>): Promise<FollowUpMessage> {
  const row = await queryOne<FollowUpMessage>(
    `INSERT INTO follow_up_messages
    (creator_id, pipeline_id, original_message_id, days_since_contact, body, channel, input_tokens, output_tokens, model_used)
    VALUES ($1,$2,$3,$4,$5,$6::outreach_channel,$7,$8,$9)
    RETURNING *`,
    [
      data.creator_id, data.pipeline_id, data.original_message_id,
      data.days_since_contact, data.body, data.channel,
      data.input_tokens ?? null, data.output_tokens ?? null, data.model_used,
    ]
  );
  return row!;
}

export async function getCreatorsForFollowUp(daysSinceContact: number): Promise<unknown[]> {
  return query(
    `SELECT pe.*, c.*, om.id AS latest_message_id, om.body AS latest_message_body, om.channel AS latest_message_channel
    FROM pipeline_entries pe
    JOIN creators c ON pe.creator_id = c.id
    JOIN outreach_messages om ON om.creator_id = c.id
    WHERE pe.current_stage = 'contacted'
    AND pe.contacted_at < NOW() - INTERVAL '1 day' * $1
    AND om.created_at = (
      SELECT MAX(created_at) FROM outreach_messages WHERE creator_id = c.id
    )`,
    [daysSinceContact]
  );
}
