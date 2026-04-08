import { query, queryOne } from '../connection';
import type { Creator, CreatorWithScore, CsvImport } from '@nex/shared';

export interface CreatorFilters {
  vertical?: string;
  region?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minViews?: number;
  tier?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function listCreators(filters: CreatorFilters = {}): Promise<{ creators: CreatorWithScore[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (filters.vertical) {
    conditions.push(`c.vertical = $${p++}::vertical_type`);
    params.push(filters.vertical);
  }
  if (filters.region) {
    conditions.push(`c.region ILIKE $${p++}`);
    params.push(`%${filters.region}%`);
  }
  if (filters.minFollowers !== undefined) {
    conditions.push(`c.follower_count >= $${p++}`);
    params.push(filters.minFollowers);
  }
  if (filters.maxFollowers !== undefined) {
    conditions.push(`c.follower_count <= $${p++}`);
    params.push(filters.maxFollowers);
  }
  if (filters.minViews !== undefined) {
    conditions.push(`c.avg_views_per_video >= $${p++}`);
    params.push(filters.minViews);
  }
  if (filters.tier) {
    conditions.push(`cs.tier = $${p++}::tier_type`);
    params.push(filters.tier);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap: Record<string, string> = {
    score: 'cs.total_score DESC NULLS LAST',
    followers: 'c.follower_count DESC',
    views: 'c.avg_views_per_video DESC',
    created: 'c.created_at DESC',
  };
  const orderBy = sortMap[filters.sort ?? 'score'] ?? 'cs.total_score DESC NULLS LAST';

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM creators c LEFT JOIN creator_scores cs ON c.id = cs.creator_id ${where}`,
    params
  );
  const total = parseInt(countRows[0]?.count ?? '0', 10);

  const rows = await query<CreatorWithScore>(
    `SELECT c.*,
      row_to_json(cs.*) AS score,
      EXISTS(SELECT 1 FROM pipeline_entries pe WHERE pe.creator_id = c.id) AS in_pipeline
    FROM creators c
    LEFT JOIN creator_scores cs ON c.id = cs.creator_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${p++} OFFSET $${p++}`,
    [...params, limit, offset]
  );

  return { creators: rows, total };
}

export async function getCreatorById(id: string): Promise<CreatorWithScore | null> {
  const rows = await query<CreatorWithScore>(
    `SELECT c.*, row_to_json(cs.*) AS score
    FROM creators c
    LEFT JOIN creator_scores cs ON c.id = cs.creator_id
    WHERE c.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createCreator(data: Omit<Creator, 'id' | 'created_at' | 'updated_at'>): Promise<Creator> {
  const row = await queryOne<Creator>(
    `INSERT INTO creators (
      tiktok_handle, display_name, vertical, region, follower_count,
      total_views, avg_views_per_video, videos_per_month, last_posted_at,
      has_tiktok_shop, has_affiliate_links, has_booking_links,
      recent_avg_views, older_avg_views, bio_text, recent_video_titles, import_batch_id
    ) VALUES ($1,$2,$3::vertical_type,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [
      data.tiktok_handle, data.display_name, data.vertical, data.region,
      data.follower_count, data.total_views, data.avg_views_per_video,
      data.videos_per_month, data.last_posted_at, data.has_tiktok_shop,
      data.has_affiliate_links, data.has_booking_links, data.recent_avg_views,
      data.older_avg_views, data.bio_text, data.recent_video_titles, data.import_batch_id,
    ]
  );
  return row!;
}

export async function updateCreator(id: string, data: Partial<Creator>): Promise<Creator | null> {
  const fields = Object.entries(data)
    .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
    .map(([k], i) => `${k} = $${i + 2}`);
  if (fields.length === 0) return getCreatorById(id) as Promise<Creator | null>;

  const values = Object.entries(data)
    .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
    .map(([, v]) => v);

  return queryOne<Creator>(
    `UPDATE creators SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
}

export async function deleteCreator(id: string): Promise<boolean> {
  const rows = await query('DELETE FROM creators WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function createCsvImport(filename: string, totalRows: number): Promise<CsvImport> {
  const row = await queryOne<CsvImport>(
    `INSERT INTO csv_imports (filename, total_rows) VALUES ($1, $2) RETURNING *`,
    [filename, totalRows]
  );
  return row!;
}

export async function updateCsvImport(
  id: string,
  data: Partial<Pick<CsvImport, 'processed_rows' | 'failed_rows' | 'status' | 'errors' | 'completed_at'>>
): Promise<void> {
  const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`);
  await query(
    `UPDATE csv_imports SET ${fields.join(', ')} WHERE id = $1`,
    [id, ...Object.values(data)]
  );
}

export async function getCsvImport(id: string): Promise<CsvImport | null> {
  return queryOne<CsvImport>('SELECT * FROM csv_imports WHERE id = $1', [id]);
}
