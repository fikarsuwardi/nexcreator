import type Anthropic from '@anthropic-ai/sdk';
import type { Response } from 'express';
import client, { MODEL } from './client';
import * as outreachDb from '../../db/queries/outreach';
import type { CreatorWithScore, CreatorScore, OutreachChannel, OutreachTone, Language } from '@nex/shared';

const OUTREACH_SYSTEM_PROMPT = `You are a creator recruitment specialist at Nex Entertainment, the #1 TikTok GO agency globally by GMV, managing 5,000+ creators across Indonesia and 400+ in the US.

## Your task
Write personalized outreach messages that feel genuinely human. You have access to the creator's profile — use it. A message that could apply to any creator is a failure.

## Reference Templates (use these as structural guides, not copy-paste)

### TikTok DM — Casual (best for <10K followers, high posting frequency)
Hey {first_name}! 👋

Just came across your {specific_content_reference} video and honestly it's exactly the kind of content that crushes it on TikTok GO.

We're Nex Entertainment — we work with TikTok to help creators like you earn money from your {vertical_content_type} content. Our top creators are making {earnings_reference} per month just by tagging hotels/restaurants/attractions in their posts.

Would love to chat about getting you set up — it literally takes 5 mins and you keep doing what you're already doing, just with the chance to earn from it.

Interested? 🙌

### Email — Professional (best for 10K–50K followers, semi-professional creators)
Subject: Partnership opportunity — earn from your {vertical} content on TikTok GO

Hi {first_name},

I'm {recruiter_name} from Nex Entertainment. We're TikTok's #1 partner agency for TikTok GO — the local services marketplace on TikTok — and we manage over 5,000 creators across Indonesia.

I've been following your content and your {specific_strength} really stands out. Creators with your posting frequency and engagement level typically see strong results on our platform.

Here's how it works:
• You keep creating the {vertical_content_type} content you already make
• We help you tag relevant businesses (hotels, restaurants, attractions) using TikTok GO
• When your viewers book or purchase through your content, you earn commission
• Our top creators in {vertical} are earning {earnings_range} per month

There's no upfront cost, no exclusivity requirement, and no minimum posting commitment.

Would you be open to a quick 10-minute call this week?

Best,
{recruiter_name}
Nex Entertainment

## Must-have rules
1. Reference SPECIFIC content — a video topic, posting pattern, or niche detail. "Love your content!" is an instant credibility killer.
2. Use tier-appropriate earnings numbers: promising→ "$500+", rising_star→ "$2,000+", star_potential→ "$5,000+"
3. Low-friction CTA: "Interested?" or "quick 10-min call" — not "fill out this form"
4. Keep TikTok DMs under 150 words. Emails 150–250 words.

## Must-avoid rules
1. AI-sounding phrases: "leverage your platform", "exciting opportunity", "synergies", "I'd love to explore"
2. Guaranteeing specific earnings — use ranges, say "top creators earn..."
3. More than 2 emojis in DMs, zero in emails
4. Sounding like a template — if you remove the name and it fits any creator, rewrite it

## Vertical earnings reference
- ACC (Accommodation): top creators $5K–15K/month from hotel/villa tags
- FNB (Food & Beverage): high-volume model, $2K–8K/month from restaurant/café bookings
- TTD (Things To Do): attraction-based, $3K–10K/month from activity bookings

## Channel formats
- tiktok_dm: conversational, under 150 words, 1–2 emojis max, no formal greeting
- email: "Subject: ..." on first line, then body, 150–250 words, professional-warm
- instagram_dm: visual-first language, reference their aesthetic/reel style, under 150 words

When regenerating: use a DIFFERENT hook, different value emphasis, different structure — not rephrasing.`;

function channelConstraints(channel: OutreachChannel): string {
  switch (channel) {
    case 'tiktok_dm':
      return 'Max 280 characters. Conversational tone. Can use 1-2 emojis. No formal greetings. Get straight to the point.';
    case 'email':
      return 'Include a subject line first (format: "Subject: ..."), then the email body. 150-250 words. Professional but warm. Clear call-to-action at the end.';
    case 'instagram_dm':
      return 'Max 320 characters. Reference their visual content. Casual, visual-first language. Brief and engaging.';
  }
}

function buildOutreachPrompt(
  creator: CreatorWithScore,
  score: CreatorScore | null,
  channel: OutreachChannel,
  tone: OutreachTone,
  language: Language
): string {
  const langNote = language === 'id' ? 'Write entirely in Bahasa Indonesia.' : 'Write in English.';
  const tierLabel = score?.tier.replace(/_/g, ' ') ?? 'promising';
  const commerceSignals = [
    creator.has_tiktok_shop && 'TikTok Shop active',
    creator.has_affiliate_links && 'affiliate links',
    creator.has_booking_links && 'booking links',
  ].filter(Boolean).join(', ') || 'no commerce signals yet';

  return `Write a ${tone} ${channel.replace(/_/g, ' ')} outreach message. ${langNote}

Creator:
- Handle: @${creator.tiktok_handle}
- Name: ${creator.display_name ?? creator.tiktok_handle}
- Vertical: ${creator.vertical} (${creator.vertical === 'ACC' ? 'Accommodation' : creator.vertical === 'FNB' ? 'Food & Beverage' : 'Things To Do'})
- Location: ${creator.region ?? 'Indonesia'}
- Followers: ${creator.follower_count.toLocaleString()}
- Avg views/video: ${creator.avg_views_per_video.toLocaleString()}
- Tier assessment: ${tierLabel}
- Commerce: ${commerceSignals}
${creator.bio_text ? `- Bio: ${creator.bio_text.slice(0, 200)}` : ''}
${score ? `- Key strength: ${score.reasoning.summary.slice(0, 150)}` : ''}

Channel constraints: ${channelConstraints(channel)}

Write the message now (message text only, no preamble):`;
}

export class ClaudeOutreachService {
  async generateWithStreaming(
    creator: CreatorWithScore,
    score: CreatorScore | null,
    channel: OutreachChannel,
    tone: OutreachTone,
    language: Language,
    res: Response
  ): Promise<{ conversationId: string; message: string; tokens: { input: number; output: number } }> {
    const conversation = await outreachDb.createConversation(
      creator.id, channel, tone, language
    );

    const userPrompt = buildOutreachPrompt(creator, score, channel, tone, language);
    const conversationHistory: Anthropic.MessageParam[] = [
      { role: 'user', content: userPrompt },
    ];

    let fullMessage = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: OUTREACH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: conversationHistory,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullMessage += event.delta.text;
        res.write(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`);
      }
      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens;
      }
      if (event.type === 'message_start' && event.message.usage) {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    conversationHistory.push({ role: 'assistant', content: fullMessage });
    await outreachDb.updateConversation(conversation.id, conversationHistory, 1);

    res.write(`data: ${JSON.stringify({ done: true, conversationId: conversation.id })}\n\n`);
    res.end();

    return { conversationId: conversation.id, message: fullMessage, tokens: { input: inputTokens, output: outputTokens } };
  }

  async generateSimple(
    creator: CreatorWithScore,
    score: CreatorScore | null,
    channel: OutreachChannel,
    tone: OutreachTone,
    language: Language
  ): Promise<{ conversationId: string; message: string; tokens: { input: number; output: number } }> {
    const conversation = await outreachDb.createConversation(creator.id, channel, tone, language);
    const userPrompt = buildOutreachPrompt(creator, score, channel, tone, language);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: OUTREACH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const message = response.content.find((b) => b.type === 'text')?.text ?? '';
    const history: Anthropic.MessageParam[] = [
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: message },
    ];
    await outreachDb.updateConversation(conversation.id, history, 1);

    return {
      conversationId: conversation.id,
      message,
      tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    };
  }

  async regenerate(
    conversationId: string,
    creator: CreatorWithScore,
    score: CreatorScore | null
  ): Promise<{ message: string; tokens: { input: number; output: number } }> {
    const conversation = await outreachDb.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const history = conversation.messages as Anthropic.MessageParam[];

    const regenerationPrompt = `Generate a completely different outreach message for the same creator.

Your previous ${conversation.generation_count} message(s) are in this conversation. This new version MUST:
- Use a different opening hook (not the same first sentence structure)
- Emphasize different value propositions (if previous focused on earnings, now focus on network/support)
- Have a different call-to-action approach
- Feel like a fresh creative approach, not just rephrasing

Same creator, channel, tone — fresh angle. Message only, no preamble:`;

    history.push({ role: 'user', content: regenerationPrompt });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: OUTREACH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: history,
    });

    const newMessage = response.content.find((b) => b.type === 'text')?.text ?? '';
    history.push({ role: 'assistant', content: newMessage });
    await outreachDb.updateConversation(conversationId, history, conversation.generation_count + 1);

    return {
      message: newMessage,
      tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    };
  }
}
