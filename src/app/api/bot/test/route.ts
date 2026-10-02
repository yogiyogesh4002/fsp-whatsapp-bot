import { requireUser } from '@/lib/auth';
import { handle, body, bad } from '@/lib/api';
import { decide, type MessageKind } from '@/lib/bot/engine';
import { insideWorkingHours } from '@/lib/handler';
import { triggerTopic } from '@/lib/bot/triggers';
import type { Lang } from '@/lib/bot/language';

export const runtime = 'nodejs';

/**
 * Dry run. Shows exactly what the bot would reply to a given message, with
 * no WhatsApp traffic and nothing written to the database. Use it to check
 * the payment rule before going live.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    const input = await body<{
      text?: string;
      kind?: MessageKind;
      name?: string;
      city?: string;
      language?: Lang;
      greeted?: boolean;
      escalatedTriggers?: number[];
      isGroup?: boolean;
    }>(req);

    if (input.isGroup) {
      return {
        send: false,
        replies: [],
        reason: 'group chat — the bot never replies in groups',
        triggerNo: null,
        topic: null,
        intent: null,
      };
    }

    const text = input.text ?? '';
    if (!text.trim() && (input.kind ?? 'text') === 'text') throw bad('Type a message to test');

    const decision = decide(
      text,
      input.kind ?? 'text',
      {
        name: input.name || null,
        city: input.city || null,
        language: input.language ?? null,
        greeted: !!input.greeted,
        stage: 'new',
        escalatedTriggers: input.escalatedTriggers ?? [],
        recentInbound: [],
      },
      {
        site: process.env.FSP_WEBSITE_URL || 'https://fsp-beta.vercel.app/',
        outsideHours: !insideWorkingHours(),
      },
    );

    return {
      send: decision.send,
      replies: decision.replies,
      intent: decision.intent,
      triggerNo: decision.triggerNo,
      topic: decision.topic ?? (decision.triggerNo ? triggerTopic(decision.triggerNo) : null),
      language: decision.language,
      captured: decision.captured,
      stage: decision.stage,
      blocked: decision.blocked,
      reason: decision.reason,
    };
  });
}
