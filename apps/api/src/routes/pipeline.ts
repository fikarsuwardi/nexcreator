import { Router, type Request, type Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as pipelineDb from '../db/queries/pipeline';
import * as outreachDb from '../db/queries/outreach';
import * as creatorDb from '../db/queries/creators';
import * as scoringDb from '../db/queries/scoring';
import { ClaudeFollowUpService } from '../services/claude/followup.service';
import { ExportService } from '../services/export.service';

const router = Router();
const followUpService = new ClaudeFollowUpService();
const exportService = new ExportService();

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const entries = await pipelineDb.getPipeline();
    res.json({ data: entries });
  } catch (err) {
    next(err);
  }
});

router.post('/:creatorId', async (req: Request, res: Response, next) => {
  try {
    const entry = await pipelineDb.createPipelineEntry(req.params.creatorId);
    res.status(201).json({ data: entry });
  } catch (err) {
    next(err);
  }
});

router.patch('/:creatorId/stage', async (req: Request, res: Response, next) => {
  try {
    const { to_stage, outreach_message_id, notes } = req.body as {
      to_stage: string;
      outreach_message_id?: string;
      notes?: string;
    };
    if (!to_stage) throw new AppError(400, 'to_stage required');

    const validStages = ['discovered','contacted','responded','negotiating','onboarded','declined','unresponsive'];
    if (!validStages.includes(to_stage)) throw new AppError(400, `Invalid stage: ${to_stage}`);

    const entry = await pipelineDb.updatePipelineStage(
      req.params.creatorId, to_stage, outreach_message_id, notes
    );
    res.json({ data: entry });
  } catch (err) {
    next(err);
  }
});

router.get('/:creatorId/history', async (req: Request, res: Response, next) => {
  try {
    const history = await pipelineDb.getStageHistory(req.params.creatorId);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

router.get('/analytics', async (_req: Request, res: Response, next) => {
  try {
    const analytics = await pipelineDb.getAnalytics();
    res.json({ data: analytics });
  } catch (err) {
    next(err);
  }
});

router.post('/followup/:creatorId', async (req: Request, res: Response, next) => {
  try {
    const creator = await creatorDb.getCreatorById(req.params.creatorId);
    if (!creator) throw new AppError(404, 'Creator not found');

    const pipelineEntry = await pipelineDb.getPipelineEntry(req.params.creatorId);
    if (!pipelineEntry) throw new AppError(404, 'Pipeline entry not found');

    const messages = await outreachDb.getMessagesByCreator(req.params.creatorId);
    if (messages.length === 0) throw new AppError(400, 'No outreach messages found');

    const originalMessage = messages[0];
    const score = await scoringDb.getScore(req.params.creatorId);

    const daysSince = pipelineEntry.contacted_at
      ? Math.floor((Date.now() - new Date(pipelineEntry.contacted_at).getTime()) / 86400000)
      : 7;

    const result = await followUpService.generateFollowUp(
      creator, originalMessage, daysSince
    );

    const saved = await pipelineDb.saveFollowUp({
      creator_id: creator.id,
      pipeline_id: pipelineEntry.id,
      original_message_id: originalMessage.id,
      days_since_contact: daysSince,
      body: result.body,
      channel: result.channel,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      model_used: result.model_used,
    });

    res.json({ data: saved });
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (_req: Request, res: Response, next) => {
  try {
    const entries = await pipelineDb.getPipeline();
    const buffer = await exportService.exportPipelineToXlsx(entries as Parameters<typeof exportService.exportPipelineToXlsx>[0]);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="nex-pipeline.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
