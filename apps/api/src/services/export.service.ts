import ExcelJS from 'exceljs';

interface PipelineRow {
  current_stage: string;
  contacted_at: string | null;
  responded_at: string | null;
  onboarded_at: string | null;
  notes: string | null;
  creator: {
    tiktok_handle: string;
    display_name: string | null;
    vertical: string;
    region: string | null;
    follower_count: number;
    avg_views_per_video: number;
  };
  score?: {
    total_score: number;
    tier: string;
  } | null;
}

export class ExportService {
  async exportPipelineToXlsx(entries: PipelineRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Pipeline');

    // Header row style
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1C1C2E' },
    };
    const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };

    ws.columns = [
      { header: 'Handle', key: 'handle', width: 20 },
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Vertical', key: 'vertical', width: 10 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'Followers', key: 'followers', width: 14 },
      { header: 'Avg Views/Video', key: 'avg_views', width: 18 },
      { header: 'Stage', key: 'stage', width: 16 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Tier', key: 'tier', width: 14 },
      { header: 'Contacted', key: 'contacted_at', width: 18 },
      { header: 'Responded', key: 'responded_at', width: 18 },
      { header: 'Onboarded', key: 'onboarded_at', width: 18 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF6366F1' } },
      };
    });
    headerRow.height = 24;

    // Stage color map
    const stageColors: Record<string, string> = {
      discovered: 'FFE8E8FF',
      contacted: 'FFFEF3C7',
      responded: 'FFD1FAE5',
      negotiating: 'FFFCE7F3',
      onboarded: 'FFD1FAE5',
      declined: 'FFFFE4E6',
      unresponsive: 'FFF3F4F6',
    };

    const tierColors: Record<string, string> = {
      star_potential: 'FFFEF9C3',
      rising_star: 'FFDBEAFE',
      promising: 'FFD1FAE5',
      developing: 'FFF3F4F6',
    };

    for (const entry of entries) {
      const row = ws.addRow({
        handle: `@${entry.creator.tiktok_handle}`,
        name: entry.creator.display_name ?? '',
        vertical: entry.creator.vertical,
        region: entry.creator.region ?? '',
        followers: entry.creator.follower_count,
        avg_views: entry.creator.avg_views_per_video,
        stage: entry.current_stage.replace(/_/g, ' '),
        score: entry.score?.total_score ?? '',
        tier: entry.score?.tier.replace(/_/g, ' ') ?? '',
        contacted_at: entry.contacted_at ? new Date(entry.contacted_at).toLocaleDateString() : '',
        responded_at: entry.responded_at ? new Date(entry.responded_at).toLocaleDateString() : '',
        onboarded_at: entry.onboarded_at ? new Date(entry.onboarded_at).toLocaleDateString() : '',
        notes: entry.notes ?? '',
      });

      // Color stage cell
      const stageCell = row.getCell('stage');
      const color = stageColors[entry.current_stage] ?? 'FFFFFFFF';
      stageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };

      // Color tier cell
      if (entry.score?.tier) {
        const tierCell = row.getCell('tier');
        const tc = tierColors[entry.score.tier] ?? 'FFFFFFFF';
        tierCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tc } };
      }

      row.alignment = { vertical: 'middle' };
    }

    // Auto-filter
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };

    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
