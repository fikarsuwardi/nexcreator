import { parse } from 'csv-parse/sync';
import * as db from '../db/queries/creators';

interface CsvRow {
  // Nex sample CSV columns
  creator_id?: string;
  handle?: string;
  // Legacy / alternative column names
  tiktok_handle?: string;
  display_name?: string;
  name?: string;
  vertical?: string;
  region?: string;
  follower_count?: string;
  followers?: string;
  // Nex CSV uses total_monthly_views; legacy CSV may use total_views
  total_monthly_views?: string;
  total_views?: string;
  avg_views_per_video?: string;
  avg_views?: string;
  videos_per_month?: string;
  // Nex CSV: days since last post (integer), legacy: ISO date
  last_post_days_ago?: string;
  last_posted_at?: string;
  // Nex CSV: posting_trend = "increasing" | "decreasing" | "stable" | "mixed"
  posting_trend?: string;
  // Nex CSV: commerce_signals = comma-separated tags e.g. "tiktok_shop,affiliate_links"
  commerce_signals?: string;
  has_tiktok_shop?: string;
  tiktok_shop?: string;
  has_affiliate_links?: string;
  has_booking_links?: string;
  has_email_in_bio?: string;
  recent_avg_views?: string;
  older_avg_views?: string;
  bio_text?: string;
  // Nex CSV informational fields (used to enrich bio_text context for scoring)
  content_niche?: string;
  unique_pois_featured?: string;
  monthly_gmv_usd?: string;
  monthly_orders?: string;
  open_loop_gmv_pct?: string;
  current_level?: string;
  months_in_program?: string;
  level_history?: string;
}

function toBoolean(val?: string): boolean {
  if (!val) return false;
  return ['true', '1', 'yes', 'y'].includes(val.toLowerCase().trim());
}

function toInt(val?: string): number {
  if (!val) return 0;
  const n = parseInt(val.replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function toFloat(val?: string): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function normalizeVertical(val?: string): 'ACC' | 'FNB' | 'TTD' | null {
  if (!val) return null;
  const upper = val.toUpperCase().trim();
  if (['ACC', 'FNB', 'TTD'].includes(upper)) return upper as 'ACC' | 'FNB' | 'TTD';
  if (upper.includes('ACCOM') || upper.includes('HOTEL')) return 'ACC';
  if (upper.includes('FOOD') || upper.includes('FNB') || upper.includes('DINING')) return 'FNB';
  if (upper.includes('TOUR') || upper.includes('TTD') || upper.includes('ACTIVITY')) return 'TTD';
  return null;
}

export class CsvService {
  async processImport(buffer: Buffer, filename: string): Promise<string> {
    const content = buffer.toString('utf-8');
    const rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    const imp = await db.createCsvImport(filename, rows.length);
    await db.updateCsvImport(imp.id, { status: 'processing' });

    const errors: Array<{ row: number; handle: string; error: string }> = [];
    let processed = 0;

    // Process in batches to avoid overwhelming the DB
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const handle = row.tiktok_handle ?? row.handle ?? '';

      if (!handle) {
        errors.push({ row: i + 1, handle: '', error: 'Missing tiktok_handle' });
        continue;
      }

      const vertical = normalizeVertical(row.vertical);
      if (!vertical) {
        errors.push({ row: i + 1, handle, error: `Invalid vertical: ${row.vertical}` });
        continue;
      }

      try {
        // Parse commerce signals from Nex CSV tag format or legacy boolean columns
        const commerceSignals = (row.commerce_signals ?? '').toLowerCase();
        const hasTiktokShop = toBoolean(row.has_tiktok_shop ?? row.tiktok_shop)
          || commerceSignals.includes('tiktok_shop');
        const hasAffiliateLinks = toBoolean(row.has_affiliate_links)
          || commerceSignals.includes('affiliate');
        const hasBookingLinks = toBoolean(row.has_booking_links)
          || commerceSignals.includes('booking')
          || commerceSignals.includes('mentions_prices')
          || toBoolean(row.has_email_in_bio);

        // Derive last_posted_at from days_ago if ISO date not provided
        let lastPostedAt: string | null = row.last_posted_at ?? null;
        if (!lastPostedAt && row.last_post_days_ago) {
          const days = toInt(row.last_post_days_ago);
          const d = new Date();
          d.setDate(d.getDate() - days);
          lastPostedAt = d.toISOString();
        }

        // Derive growth trajectory proxies from posting_trend
        const avgViews = toInt(row.avg_views_per_video ?? row.avg_views);
        let recentAvgViews: number | null = row.recent_avg_views ? toInt(row.recent_avg_views) : null;
        let olderAvgViews: number | null = row.older_avg_views ? toInt(row.older_avg_views) : null;
        if (recentAvgViews === null && olderAvgViews === null && row.posting_trend && avgViews > 0) {
          const trend = row.posting_trend.toLowerCase().trim();
          if (trend === 'increasing') {
            recentAvgViews = Math.round(avgViews * 1.25);
            olderAvgViews = Math.round(avgViews * 0.75);
          } else if (trend === 'decreasing') {
            recentAvgViews = Math.round(avgViews * 0.75);
            olderAvgViews = Math.round(avgViews * 1.25);
          } else if (trend === 'stable') {
            recentAvgViews = avgViews;
            olderAvgViews = avgViews;
          }
          // mixed → leave null (too few data points to assess)
        }

        // Build bio_text from available context fields
        const bioContext = [
          row.bio_text,
          row.content_niche ? `Niche: ${row.content_niche}` : null,
          row.current_level ? `TikTok GO level: ${row.current_level}` : null,
          row.months_in_program ? `${row.months_in_program} months in program` : null,
          row.level_history ? `Level history: ${row.level_history}` : null,
          row.monthly_gmv_usd ? `Monthly GMV: $${row.monthly_gmv_usd}` : null,
          row.monthly_orders ? `Monthly orders: ${row.monthly_orders}` : null,
          row.open_loop_gmv_pct ? `Open-loop GMV: ${row.open_loop_gmv_pct}%` : null,
        ].filter(Boolean).join(' | ') || null;

        await db.createCreator({
          tiktok_handle: handle.replace('@', ''),
          display_name: row.display_name ?? row.name ?? null,
          vertical,
          region: row.region ?? null,
          follower_count: toInt(row.follower_count ?? row.followers),
          total_views: toInt(row.total_monthly_views ?? row.total_views),
          avg_views_per_video: avgViews,
          videos_per_month: toFloat(row.videos_per_month),
          last_posted_at: lastPostedAt,
          has_tiktok_shop: hasTiktokShop,
          has_affiliate_links: hasAffiliateLinks,
          has_booking_links: hasBookingLinks,
          recent_avg_views: recentAvgViews,
          older_avg_views: olderAvgViews,
          bio_text: bioContext,
          recent_video_titles: null,
          import_batch_id: imp.id,
        });
        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Skip duplicate handles silently
        if (message.includes('unique')) {
          processed++;
        } else {
          errors.push({ row: i + 1, handle, error: message });
        }
      }
    }

    await db.updateCsvImport(imp.id, {
      processed_rows: processed,
      failed_rows: errors.length,
      status: errors.length === rows.length ? 'failed' : 'completed',
      errors: errors.length > 0 ? errors : null,
      completed_at: new Date().toISOString(),
    });

    return imp.id;
  }
}
