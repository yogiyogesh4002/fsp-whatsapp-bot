/**
 * Lead capture — WHATSAPP-BOT-KNOWLEDGE.md section 5.
 * "Never block the conversation to collect fields. Answer first, ask second."
 *
 * Extraction is best-effort; the dashboard lets the team correct anything.
 */

import { normalize } from './text';

export type Captured = {
  name?: string;
  city?: string;
  profession?: string;
  profile?: 'aspiring' | 'new' | 'experienced' | 'corporate' | 'hr-ld';
  program?: string;
  contact_time?: string;
};

/** Cities seen most often in FSP conversations, plus every Indian state capital. */
const CITIES = [
  'chennai', 'coimbatore', 'madurai', 'trichy', 'tiruchirappalli', 'salem',
  'erode', 'tirunelveli', 'vellore', 'thanjavur', 'tirupur', 'hosur',
  'nagercoil', 'kanchipuram', 'cuddalore', 'dindigul', 'karur', 'namakkal',
  'pollachi', 'sivakasi', 'thoothukudi', 'tuticorin', 'ooty', 'kodaikanal',
  'pondicherry', 'puducherry', 'bangalore', 'bengaluru', 'mysore', 'mysuru',
  'hyderabad', 'secunderabad', 'mumbai', 'pune', 'nagpur', 'nashik', 'thane',
  'delhi', 'new delhi', 'noida', 'gurgaon', 'gurugram', 'faridabad',
  'kolkata', 'ahmedabad', 'surat', 'vadodara', 'rajkot', 'jaipur', 'lucknow',
  'kanpur', 'indore', 'bhopal', 'patna', 'ranchi', 'raipur', 'bhubaneswar',
  'guwahati', 'chandigarh', 'ludhiana', 'amritsar', 'dehradun', 'shimla',
  'srinagar', 'jammu', 'kochi', 'cochin', 'ernakulam', 'trivandrum',
  'thiruvananthapuram', 'kozhikode', 'calicut', 'thrissur', 'kollam',
  'visakhapatnam', 'vizag', 'vijayawada', 'guntur', 'tirupati', 'nellore',
  'goa', 'panaji', 'dubai', 'abu dhabi', 'sharjah', 'singapore', 'malaysia',
  'qatar', 'doha', 'muscat', 'kuwait', 'bahrain', 'riyadh', 'sri lanka',
  'colombo', 'london', 'usa', 'canada', 'australia',
];

const NOT_A_NAME = new Set([
  'ok', 'okay', 'yes', 'no', 'yeah', 'yep', 'sure', 'fine', 'thanks', 'thank',
  'hi', 'hello', 'hey', 'good', 'morning', 'evening', 'afternoon', 'fsp',
  'interested', 'trainer', 'facilitator', 'sir', 'madam', 'mam', 'bro',
  'details', 'information', 'info', 'please', 'program', 'course', 'from',
  'and', 'the', 'what', 'how', 'when', 'where', 'why', 'who', 'tell', 'send',
]);

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function plausibleName(candidate: string): string | undefined {
  const cleaned = candidate.replace(/[^\p{L}\s.]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  const words = cleaned.split(' ');
  if (words.length > 4) return undefined;
  if (words.some((w) => NOT_A_NAME.has(w.toLowerCase()))) return undefined;
  if (cleaned.length < 2 || cleaned.length > 40) return undefined;
  if (CITIES.includes(cleaned.toLowerCase())) return undefined;
  return titleCase(cleaned);
}

function findCity(norm: string): string | undefined {
  const padded = ` ${norm} `;
  // Longest match first so "new delhi" beats "delhi".
  const sorted = [...CITIES].sort((a, b) => b.length - a.length);
  for (const c of sorted) if (padded.includes(` ${c} `)) return titleCase(c);
  return undefined;
}

const PROFILE_RULES: { profile: NonNullable<Captured['profile']>; re: RegExp }[] = [
  { profile: 'hr-ld', re: /\b(?:hr|human resources|l ?& ?d|learning and development|od|talent)\b/i },
  { profile: 'corporate', re: /\bcorporate (?:trainer|l ?& ?d)\b|\bin ?house trainer\b|\bcompany trainer\b/i },
  {
    profile: 'experienced',
    re: /\b(?:experienced|senior|full ?time|professional) (?:trainer|facilitator)\b|\b\d+\+? years?\b|\bi (?:conduct|deliver|run) (?:training|workshops)\b/i,
  },
  { profile: 'new', re: /\b(?:new|just started|recently started|1 year|one year)\b.*\b(?:trainer|training|facilitat)/i },
  {
    profile: 'aspiring',
    re: /\b(?:aspiring|want to become|wish to become|planning to become|beginner|fresher|no experience|zero experience|student)\b/i,
  },
];

const PROGRAM_RULES: { program: string; re: RegExp }[] = [
  { program: 'FSP Core Program', re: /\bcore (?:program|programme)\b|\bfsp core\b/i },
  { program: '30 Days Challenge', re: /\b30 ?days?\b/i },
  { program: 'FSP TTX', re: /\bttx\b/i },
  { program: 'FSP Mastermind', re: /\bmastermind\b/i },
  { program: 'Wednesday Masterclass', re: /\bmasterclass\b/i },
  { program: 'Catalyst Connect', re: /\bcatalyst\b/i },
  { program: 'Good to Great Facilitator', re: /\bgood to great\b/i },
];

/**
 * @param text      the raw inbound message
 * @param expecting what the bot's previous message asked for, if anything
 */
export function captureFields(text: string, expecting?: string | null): Captured {
  const raw = (text || '').trim();
  const norm = normalize(raw);
  const out: Captured = {};

  /* city — explicit "from X" / "in X", or a known city anywhere */
  const fromCity = /\b(?:from|based in|living in|i'?m in|staying in|city is|city:)\s+([\p{L}\s]{2,30})/iu.exec(raw);
  if (fromCity) {
    const c = findCity(normalize(fromCity[1]));
    if (c) out.city = c;
    else {
      const guess = plausibleName(fromCity[1]);
      if (guess) out.city = guess;
    }
  }
  if (!out.city) {
    const c = findCity(norm);
    if (c) out.city = c;
  }

  /* name — explicit introduction wins */
  const intro =
    /\b(?:my name is|my name'?s|myself|i am|i'?m|this is|name is|name:)\s+([\p{L}][\p{L}\s.]{1,38})/iu.exec(raw);
  if (intro) {
    let candidate = intro[1];
    // "I'm Ravi from Chennai" -> stop at the city clause
    candidate = candidate.split(/\s+(?:from|in|at|and|a|an|the)\s+/i)[0];
    const n = plausibleName(candidate);
    if (n) out.name = n;
  }

  /* "Ravi, Chennai" or "Ravi - Coimbatore" — the shape people answer the
     handoff question with. Only trusted when the bot asked. */
  if (!out.name && (expecting === 'name' || expecting === 'name+city')) {
    const pair = /^([\p{L}][\p{L}\s.]{1,30})\s*[,\-|/]\s*([\p{L}][\p{L}\s.]{1,30})$/u.exec(raw);
    if (pair) {
      const n = plausibleName(pair[1]);
      if (n) out.name = n;
      const c = findCity(normalize(pair[2])) ?? plausibleName(pair[2]);
      if (c && !out.city) out.city = c;
    } else if (raw.split(/\s+/).length <= 3 && !/\?/.test(raw)) {
      // A bare "Ravi" in reply to "could you share your name?"
      const withoutCity = out.city
        ? raw.replace(new RegExp(out.city, 'i'), ' ')
        : raw;
      const n = plausibleName(withoutCity);
      if (n) out.name = n;
    }
  }

  /* profession / profile */
  const prof =
    /\b(?:i (?:am|'m) (?:a|an)|i work as (?:a|an)|my profession is|i'?m working as (?:a|an)|profession:)\s+([\p{L}\s&/-]{3,40})/iu.exec(
      raw,
    );
  if (prof) {
    const p = prof[1].split(/\s+(?:from|in|at|and)\s+/i)[0].trim();
    if (p && p.length <= 40 && !NOT_A_NAME.has(p.toLowerCase())) out.profession = titleCase(p);
  }
  for (const r of PROFILE_RULES) {
    if (r.re.test(raw)) {
      out.profile = r.profile;
      break;
    }
  }

  /* program of interest */
  for (const r of PROGRAM_RULES) {
    if (r.re.test(raw)) {
      out.program = r.program;
      break;
    }
  }

  /* preferred contact time */
  const when =
    /\b(?:call me|contact me|reach me|available)\s+(?:at|after|before|around|in the)?\s*([\p{L}\d\s:.]{3,24})/iu.exec(raw);
  if (when) {
    const w = when[1].trim();
    if (/\d|morning|afternoon|evening|night|tomorrow|weekend|anytime/i.test(w)) {
      out.contact_time = w.slice(0, 40);
    }
  }

  return out;
}
