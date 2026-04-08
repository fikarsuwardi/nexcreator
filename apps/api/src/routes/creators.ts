import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import * as db from '../db/queries/creators';
import { CsvService } from '../services/csv.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const csvService = new CsvService();

const CreatorSchema = z.object({
  tiktok_handle: z.string().min(1).max(100),
  display_name: z.string().optional(),
  vertical: z.enum(['ACC', 'FNB', 'TTD']),
  region: z.string().optional(),
  follower_count: z.number().int().min(0).default(0),
  total_views: z.number().int().min(0).default(0),
  avg_views_per_video: z.number().int().min(0).default(0),
  videos_per_month: z.number().min(0).default(0),
  last_posted_at: z.string().datetime().optional(),
  has_tiktok_shop: z.boolean().default(false),
  has_affiliate_links: z.boolean().default(false),
  has_booking_links: z.boolean().default(false),
  recent_avg_views: z.number().int().optional(),
  older_avg_views: z.number().int().optional(),
  bio_text: z.string().optional(),
  recent_video_titles: z.array(z.string()).optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const { vertical, region, minFollowers, maxFollowers, minViews, tier, sort, page, limit } = req.query;
    const result = await db.listCreators({
      vertical: vertical as string,
      region: region as string,
      minFollowers: minFollowers ? Number(minFollowers) : undefined,
      maxFollowers: maxFollowers ? Number(maxFollowers) : undefined,
      minViews: minViews ? Number(minViews) : undefined,
      tier: tier as string,
      sort: sort as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = CreatorSchema.parse(req.body);
    const creator = await db.createCreator({
      ...data,
      display_name: data.display_name ?? null,
      region: data.region ?? null,
      last_posted_at: data.last_posted_at ?? null,
      recent_avg_views: data.recent_avg_views ?? null,
      older_avg_views: data.older_avg_views ?? null,
      bio_text: data.bio_text ?? null,
      recent_video_titles: data.recent_video_titles ?? null,
      import_batch_id: null,
    });
    res.status(201).json({ data: creator });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, 'Validation error', err.errors) : err);
  }
});

router.get('/import/:batchId', async (req, res, next) => {
  try {
    const imp = await db.getCsvImport(req.params.batchId);
    if (!imp) throw new AppError(404, 'Import not found');
    res.json({ data: imp });
  } catch (err) {
    next(err);
  }
});

router.post('/import/csv', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'No file uploaded');
    const batchId = await csvService.processImport(req.file.buffer, req.file.originalname);
    res.status(202).json({ data: { batch_id: batchId } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const creator = await db.getCreatorById(req.params.id);
    if (!creator) throw new AppError(404, 'Creator not found');
    res.json({ data: creator });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = CreatorSchema.partial().parse(req.body);
    const creator = await db.updateCreator(req.params.id, data as Parameters<typeof db.updateCreator>[1]);
    if (!creator) throw new AppError(404, 'Creator not found');
    res.json({ data: creator });
  } catch (err) {
    next(err instanceof z.ZodError ? new AppError(400, 'Validation error', err.errors) : err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await db.deleteCreator(req.params.id);
    if (!deleted) throw new AppError(404, 'Creator not found');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
