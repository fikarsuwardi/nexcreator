import type Anthropic from '@anthropic-ai/sdk';
import client, { MODEL } from './client';
import type { CreatorWithScore, OutreachMessage } from '@nex/shared';

const FOLLOW_UP_SYSTEM_PROMPT = `You are a creator recruitment specialist at Nex Entertainment, the #1 TikTok GO agency globally. You write natural follow-up messages that recover non-responders (~15% recovery rate) by adding genuine new value.

## Reference Template (structural guide only)
Hey {first_name}! Following up on my message from last week 😊

Just wanted to share — one of our creators in {their_region} who makes similar {vertical_content_type} content just hit {recent_success_metric} last month through TikTok GO. Your content style is really similar to theirs when they first started with us.

No pressure at all — just thought you'd want to know the opportunity is there. Happy to answer any questions if you're curious!

## Rules
- Never apologize for following up ("sorry to bother you" = instant delete)
- Never just repeat the original message — add a NEW angle (social proof, recent success story, new availability window, season/timing hook)
- Reference something specific from the original to show continuity — not "as I mentioned" but a detail
- Keep it shorter than the original
- End with a question (low-friction) not a demand
- Match channel tone: TikTok DM = casual/brief, email = warm-professional
- NEVER mention AI or that this was generated
- NEVER guarantee specific earnings — use "top creators earn..." or "creators in your area hit..."`;

export class ClaudeFollowUpService {
  async generateFollowUp(
    creator: CreatorWithScore,
    originalMessage: OutreachMessage,
    daysSinceContact: number
  ): Promise<{
    body: string;
    channel: OutreachMessage['channel'];
    input_tokens: number;
    output_tokens: number;
    model_used: string;
  }> {
    // Turn 1: Claude analyzes the original message
    const analysisMessages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `I need to write a follow-up for a TikTok creator who hasn't responded to our outreach.

Creator: @${creator.tiktok_handle} (${creator.vertical} vertical, ${creator.region ?? 'Indonesia'})
Days since first contact: ${daysSinceContact}
Channel: ${originalMessage.channel}

Original message sent:
---
${originalMessage.body}
---

Before writing, briefly analyze:
1. What was the main value proposition in the original?
2. What NEW angle could work that wasn't covered?
3. Is there a natural time urgency we could reference?`,
      },
    ];

    const analysis = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: FOLLOW_UP_SYSTEM_PROMPT,
      messages: analysisMessages,
    });

    const analysisText = analysis.content.find((b) => b.type === 'text')?.text ?? '';

    // Turn 2: Write the follow-up using the analysis
    const writeMessages: Anthropic.MessageParam[] = [
      ...analysisMessages,
      { role: 'assistant', content: analysisText },
      {
        role: 'user',
        content: `Good. Now write the follow-up for ${originalMessage.channel.replace(/_/g, ' ')}.

Requirements:
- Implicitly acknowledge it's a follow-up (don't say "just following up")
- Reference a specific element from the original to show continuity
- Lead with the NEW angle you identified
- Keep shorter than original
- End with a question or easy next step as CTA
${daysSinceContact > 14 ? '- It has been 2+ weeks — add a gentle time or availability angle' : ''}

Message only, no preamble:`,
      },
    ];

    const followUp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: FOLLOW_UP_SYSTEM_PROMPT,
      messages: writeMessages,
    });

    const body = followUp.content.find((b) => b.type === 'text')?.text ?? '';

    return {
      body,
      channel: originalMessage.channel,
      input_tokens: analysis.usage.input_tokens + followUp.usage.input_tokens,
      output_tokens: analysis.usage.output_tokens + followUp.usage.output_tokens,
      model_used: MODEL,
    };
  }
}
