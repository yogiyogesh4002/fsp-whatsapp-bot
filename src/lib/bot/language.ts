import { normalize } from './text';

export type Lang = 'en' | 'ta' | 'tl'; // English, Tamil script, Tanglish

const TAMIL_SCRIPT = /[\u0B80-\u0BFF]/;

/** Romanised Tamil markers. Long/distinctive forms only — short ones like
 *  "na" or "oru" also appear in English text and cause false positives. */
const TANGLISH_STRONG = [
  'vanakkam', 'eppadi', 'epdi', 'enna', 'yaaru', 'evlo', 'evalo', 'evvalavu',
  'panren', 'pandringa', 'panniruken', 'pannunga', 'pannuvanga', 'panlama',
  'pannalaam', 'mudiyuma', 'mudiyum', 'theriyuma', 'theriyum', 'sollunga',
  'solluga', 'solren', 'irukku', 'irukka', 'irukkum', 'venum', 'vendum',
  'kandippa', 'ungaluku', 'ungalukku', 'enakku', 'enaku', 'namma', 'neenga',
  'seekiram', 'nandri', 'kattanum', 'kaasu', 'paisa', 'romba', 'sari',
  'seri', 'aamaa', 'illaye', 'ipothu', 'ippo', 'eppo', 'edhuku', 'ethuku',
  'vaanga', 'poiduven', 'aagum', 'joinnu', 'joinna', 'velai', 'thevai',
];

const TANGLISH_WEAK = ['na', 'oru', 'nalla', 'illa', 'aama', 'nee', 'naan', 'unga', 'edhu', 'ethu', 'yen', 'kooda'];

export function detectLanguage(text: string): Lang {
  if (TAMIL_SCRIPT.test(text)) return 'ta';
  const t = ` ${normalize(text)} `;
  let score = 0;
  for (const w of TANGLISH_STRONG) if (t.includes(` ${w} `)) score += 2;
  for (const w of TANGLISH_WEAK) if (t.includes(` ${w} `)) score += 1;
  return score >= 2 ? 'tl' : 'en';
}

/**
 * Sticky language: a single English word ("ok") mid-conversation should not
 * flip a Tamil conversation back to English, but a full switch should.
 */
export function resolveLanguage(text: string, previous: Lang | null | undefined): Lang {
  const detected = detectLanguage(text);
  if (!previous || previous === detected) return detected;
  if (detected === 'en' && normalize(text).split(' ').length <= 3) return previous;
  return detected;
}
