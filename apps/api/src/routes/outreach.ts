import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import * as creatorDb from '../db/queries/creators';
import * as scoringDb from '../db/queries/scoring';
import * as outreachDb from '../db/queries/outreach';
import { ClaudeOutreachService } from '../services/claude/outreach.service';

const router = Router();
const outreachService = new ClaudeOutreachService();

const GenerateSchema = z.object({
  creator_id: z.string().uuid(),
  channel: z.enum(['tiktok_dm', 'email', 'instagram_dm']),
  tone: z.enum(['casual', 'professional', 'enthusiastic']),
  language: z.enum(['en', 'id']).default('en'),
});

router.post('/generate', async (req: Request, res: Response, next) => {
  try {
    const { creator_id, channel, tone, language } = GenerateSchema.parse(req.body);

    const creator = await creatorDb.getCreatorById(creator_id);
    if (!creator) throw new AppError(404, 'Creator not found');

    const score = await scoringDb.getScore(creator_id);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const result = await outreachService.generateWithStreaming(
      creator, score, channel, tone, language, res
    );

    // Save message to DB
    await outreachDb.saveMessage({
      creatorId: creator_id,
      channel, tone, language,
      body: result.message,
      generationIndex: 0,
      conversationId: result.conversationId,
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
    });

  } catch (err) {
    next(err);
  }
});

router.post('/regenerate', async (req: Request, res: Response, next) => {
  try {
    const { conversation_id } = req.body as { conversation_id: string };
    if (!conversation_id) throw new AppError(400, 'conversation_id required');

    const conversation = await outreachDb.getConversation(conversation_id);
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const creator = await creatorDb.getCreatorById(conversation.creator_id);
    if (!creator) throw new AppError(404, 'Creator not found');

    const score = await scoringDb.getScore(conversation.creator_id);

    const result = await outreachService.regenerate(conversation_id, creator, score);

    await outreachDb.saveMessage({
      creatorId: conversation.creator_id,
      channel: conversation.channel,
      tone: conversation.tone,
      language: conversation.language,
      body: result.message,
      generationIndex: conversation.generation_count,
      conversationId: conversation_id,
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
    });

    res.json({ data: { message: result.message, tokens: result.tokens } });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req: Request, res: Response, next) => {
  try {
    const { creator_ids, channel, tone, language } = req.body as {
      creator_ids: string[];
      channel: string;
      tone: string;
      language: string;
    };

    if (!Array.isArray(creator_ids) || creator_ids.length === 0) {
      throw new AppError(400, 'creator_ids must be non-empty');
    }

    const batch = await outreachDb.createBatch({ creatorIds: creator_ids, channel, tone, language });
    await outreachDb.updateBatch(batch.id, { status: 'processing' });

    // Process in background
    setImmediate(async () => {
      let completed = 0;
      let failed = 0;

      for (const creator_id of creator_ids) {
        try {
          const creator = await creatorDb.getCreatorById(creator_id);
          if (!creator) { failed++; continue; }

          const score = await scoringDb.getScore(creator_id);
          const result = await outreachService.generateSimple(
            creator, score,
            channel as 'tiktok_dm' | 'email' | 'instagram_dm',
            tone as 'casual' | 'professional' | 'enthusiastic',
            (language as 'en' | 'id') ?? 'en'
          );

          await outreachDb.saveMessage({
            creatorId: creator_id, channel, tone,
            language: language ?? 'en',
            body: result.message, generationIndex: 0,
            conversationId: result.conversationId,
            inputTokens: result.tokens.input, outputTokens: result.tokens.output,
          });
          completed++;
        } catch {
          failed++;
        }

        await outreachDb.updateBatch(batch.id, { completed_count: completed, failed_count: failed });
      }

      const finalStatus = failed === creator_ids.length ? 'failed'
        : failed > 0 ? 'partial' : 'completed';
      await outreachDb.updateBatch(batch.id, {
        status: finalStatus,
        completed_at: new Date().toISOString(),
      });
    });

    res.status(202).json({ data: { batch_id: batch.id } });
  } catch (err) {
    next(err);
  }
});

router.get('/batch/:batchId', async (req: Request, res: Response, next) => {
  try {
    const batch = await outreachDb.getBatch(req.params.batchId);
    if (!batch) throw new AppError(404, 'Batch not found');
    res.json({ data: batch });
  } catch (err) {
    next(err);
  }
});

router.get('/creator/:creatorId', async (req: Request, res: Response, next) => {
  try {
    const messages = await outreachDb.getMessagesByCreator(req.params.creatorId);
    res.json({ data: messages });
  } catch (err) {
    next(err);
  }
});

router.get('/messages/:messageId', async (req: Request, res: Response, next) => {
  try {
    const msg = await outreachDb.getMessage(req.params.messageId);
    if (!msg) throw new AppError(404, 'Message not found');
    res.json({ data: msg });
  } catch (err) {
    next(err);
  }
});

export default router;
