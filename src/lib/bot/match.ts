import { INTENTS, type Intent } from './knowledge';
import { normalize } from './text';

export type Match = { intent: Intent; score: number; hits: string[] };

/**
 * Score every intent by how many of its patterns the message satisfies, then
 * return the best. Deliberately conservative: a single weak hit on a short
 * message is not enough, because an unmatched message escalates to the human
 * team, which is always the safe outcome.
 */
export function matchIntent(raw: string): Match | null {
  const text = raw || '';
  const norm = normalize(text);
  if (!norm) return null;

  const wordCount = norm.split(' ').length;
  let best: Match | null = null;

  for (const intent of INTENTS) {
    const hits: string[] = [];
    for (const re of intent.patterns) {
      // Patterns are authored against readable text, so test both forms.
      const m = re.exec(text) || re.exec(norm);
      if (m) hits.push(m[0].trim());
    }
    if (!hits.length) continue;
    const score = hits.length * (intent.weight ?? 1);
    if (!best || score > best.score) best = { intent, score, hits };
  }

  if (!best) return null;

  // A one or two word message that only grazed a single generic pattern is
  // more likely noise than a real question — hand it to the team instead.
  const longestHit = Math.max(...best.hits.map((h) => h.length));
  if (wordCount <= 2 && best.hits.length === 1 && longestHit < 4) return null;

  return best;
}
