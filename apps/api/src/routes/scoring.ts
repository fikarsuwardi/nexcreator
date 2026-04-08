import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as creatorDb from '../db/queries/creators';
import * as scoringDb from '../db/queries/scoring';
import { ClaudeScoringService } from '../services/claude/scoring.service';

const router = Router();
const scoringService = new ClaudeScoringService();

router.get('/creator/:id', async (req, res, next) => {
  try {
    const score = await scoringDb.getScore(req.params.id);
    if (!score) throw new AppError(404, 'Score not found');
    res.json({ data: score });
  } catch (err) {
    next(err);
  }
});

router.post('/creator/:id', async (req, res, next) => {
  try {
    const creator = await creatorDb.getCreatorById(req.params.id);
    if (!creator) throw new AppError(404, 'Creator not found');

    const scoreData = await scoringService.scoreCreator(creator);
    const score = await scoringDb.upsertScore(creator.id, scoreData);
    res.json({ data: score });
  } catch (err) {
    next(err);
  }
});

router.post('/rescore/:id', async (req, res, next) => {
  try {
    const creator = await creatorDb.getCreatorById(req.params.id);
    if (!creator) throw new AppError(404, 'Creator not found');

    const scoreData = await scoringService.scoreCreator(creator);
    const score = await scoringDb.upsertScore(creator.id, scoreData);
    res.json({ data: score });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req, res, next) => {
  try {
    const { creator_ids } = req.body as { creator_ids: string[] };
    if (!Array.isArray(creator_ids) || creator_ids.length === 0) {
      throw new AppError(400, 'creator_ids must be a non-empty array');
    }

    const results: Array<{ creator_id: string; status: string; error?: string }> = [];

    for (const id of creator_ids) {
      try {
        const creator = await creatorDb.getCreatorById(id);
        if (!creator) {
          results.push({ creator_id: id, status: 'failed', error: 'Creator not found' });
          continue;
        }
        const scoreData = await scoringService.scoreCreator(creator);
        await scoringDb.upsertScore(id, scoreData);
        results.push({ creator_id: id, status: 'scored' });
      } catch (err) {
        results.push({ creator_id: id, status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});

export default router;
