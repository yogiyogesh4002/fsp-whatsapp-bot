/** Section 6.6 — small talk and edge cases, checked before the answer library. */

export type SmallTalkKind =
  | 'greeting'
  | 'thanks'
  | 'bye'
  | 'is-human'
  | 'other-customer'
  | 'not-interested'
  | 'abuse';

const RULES: { kind: SmallTalkKind; re: RegExp[] }[] = [
  {
    kind: 'abuse',
    re: [
      /\b(?:fuck|fucking|bitch|bastard|asshole|idiot|stupid|nonsense|bloody|shut up|dog|rascal)\b/i,
      /\b(?:punda|pundai|thevdiya|otha|oombu|loosu|naaye|kirukku)\b/i,
      /\bget lost\b|\bdon'?t message\b|\bstop messaging\b.*\b(?:idiot|stupid)\b/i,
    ],
  },
  {
    kind: 'not-interested',
    re: [
      /\bnot interested\b|\bno thanks\b|\bno thank you\b|\bnot required\b|\bdon'?t want\b/i,
      /\bwrong number\b|\bwrong person\b|\bwho is this\b|\bwho are you\b.*\bwrong\b/i,
      /\bremove (?:my|me)\b|\bunsubscribe\b|\bstop (?:sending|messaging)\b|\bdo not disturb\b/i,
      /\bvendam\b|\bthevai illa\b|\binterest illa\b/i,
    ],
  },
  {
    kind: 'is-human',
    re: [
      /\bare you (?:a )?(?:bot|robot|ai|machine|human|real|person)\b/i,
      /\bis this (?:a )?(?:bot|robot|ai|automated|real person|human)\b/i,
      /\bam i (?:talking|chatting) (?:to|with) (?:a )?(?:bot|human|person|machine)\b/i,
      /\bautomated (?:reply|message)\b/i,
      /\bwho are you\b/i,
    ],
  },
  {
    kind: 'other-customer',
    re: [
      /\b(?:give|share|send) (?:me )?(?:his|her|their|someone'?s|other members?'?)\b.*\b(?:number|contact|details|email)\b/i,
      /\bmembers? list\b|\bparticipants? list\b|\bcontact list\b|\bdatabase\b/i,
      /\bwho else (?:joined|is in)\b.*\b(?:number|contact)\b/i,
    ],
  },
  {
    kind: 'thanks',
    re: [
      /^(?:ok(?:ay)?|k|kk|sure|fine|got it|noted|great|good|nice|super|cool|alright)[\s.!]*$/i,
      /\bthanks?\b|\bthank you\b|\bthanku\b|\btq\b|\bnandri\b|\bநன்றி/i,
      /^(?:👍|🙏|👌|😊|🙂|❤️|♥️)+$/u,
    ],
  },
  {
    kind: 'bye',
    re: [
      /^(?:bye|byee|goodbye|good bye|tata|see you|cya)[\s.!]*$/i,
      /\bgood night\b|\bgn\b|\bsigning off\b|\btalk later\b|\bcatch you later\b/i,
      /\bpoitu varen\b|\bvanakkam\b.*\bbye\b/i,
    ],
  },
  {
    kind: 'greeting',
    re: [
      /^(?:hi+|hey+|hello+|helo|hii+|yo|hai|halo)[\s.!,]*$/i,
      /^(?:good (?:morning|afternoon|evening|day))[\s.!,]*$/i,
      /^(?:vanakkam|வணக்கம்)[\s.!,]*$/i,
      /^(?:hi+|hey+|hello+|hai|vanakkam)[\s.!,]+(?:sir|madam|mam|bro|anna|team|there)[\s.!,]*$/i,
      /^(?:namaste|namaskaram)[\s.!,]*$/i,
      /^\.$|^(?:\?+)$/,
    ],
  },
];

export function detectSmallTalk(text: string): SmallTalkKind | null {
  const t = (text || '').trim();
  if (!t) return null;
  for (const rule of RULES) {
    for (const re of rule.re) if (re.test(t)) return rule.kind;
  }
  return null;
}
