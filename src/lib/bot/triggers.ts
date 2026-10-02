/**
 * The 16 escalation triggers from WHATSAPP-BOT-KNOWLEDGE.md section 4.
 *
 * Every inbound message is screened here BEFORE any answer is composed, so a
 * fee question can never reach the answer library. Triggers 13, 14 and 15 are
 * partly behavioural and are also raised by the engine.
 */

export type Trigger = {
  no: number;
  topic: string;
  /** Any of these matching raises the trigger. */
  re: RegExp[];
  /** Section 4 "Deflect, don't invent": honest one-liner, then hand over. */
  deflect?: boolean;
};

// Reusable fragments
const MONEY_WORD =
  /(\bfee\b|\bfees\b|\bcost\b|\bcosts\b|\bprice\b|\bpricing\b|\bcharges?\b|\brate\b|\bamount\b|\bbudget\b|\binvestment\b|\bkaasu\b|\bpaisa\b|\bpanam\b|\bkattanam\b|\bkattanum\b|கட்டணம்|விலை|பணம்)/i;

const HOW_MUCH = /\bhow much\b(?!\s+(?:time|long|days?|hours?|duration|experience))/i;

const CHEAP =
  /(\bdiscount\b|\boffer\b|\bcoupon\b|\bpromo\b|\bconcession\b|\bscholarship\b|\bearly ?bird\b|\bemi\b|\binstal?ments?\b|\bpart payment\b|\bsplit payment\b)/i;

export const TRIGGERS: Trigger[] = [
  {
    no: 1,
    topic: 'Fees, price, cost, discount, EMI',
    re: [MONEY_WORD, HOW_MUCH, CHEAP, /\bevlo\b|\bevalo\b|\bevvalavu\b|எவ்வளவு/i],
  },
  {
    no: 2,
    topic: 'Payment method, UPI, bank, link, payment proof',
    re: [
      /\bupi\b|\bgpay\b|\bg pay\b|\bphone ?pe\b|\bpaytm\b|\bbhim\b|\bqr ?code\b|\bqr\b/i,
      /\bbank\b|\bifsc\b|\baccount (?:no|number|details)\b|\bbeneficiary\b/i,
      /\bpayment link\b|\bpay ?link\b|\brazorpay\b|\bpayu\b|\bccavenue\b|\bcheckout link\b/i,
      /\b(?:how|where|whom?)\b.*\b(?:pay|transfer|send money)\b/i,
      /\b(?:i|we)\s+(?:already\s+)?(?:paid|transferred|sent (?:the )?(?:money|amount|payment))\b/i,
      /\bpayment (?:done|made|confirm|confirmed|received|proof|screenshot|status)\b/i,
      /\btransaction (?:id|number)\b|\butr\b|\breference number\b/i,
      /\bcard (?:number|details)\b|\bcvv\b|\botp\b|\bnet ?banking\b/i,
      /\bsend (?:me )?(?:the )?(?:payment )?link\b/i,
      /\bpay (?:now|here|online)\b/i,
    ],
  },
  {
    no: 3,
    topic: 'Batch dates, start date, timings, schedule',
    deflect: true,
    re: [
      /\bbatch\b/i,
      /\bstart(?:s|ing)? (?:date|on|when)\b/i,
      /\bwhen (?:does|do|is|will|can)\b.*\b(?:start|begin|class|session|program)\b/i,
      /\btimings?\b|\bwhat time\b|\bschedule\b|\bslot\b/i,
      /\bwhich (?:date|day|month)\b/i,
      /\beppo\b.*\b(?:start|class|session)\b/i,
      /எப்போது|தேதி|நேரம்/,
    ],
  },
  {
    no: 4,
    topic: 'Program duration or exact online/offline format',
    deflect: true,
    re: [
      /\bhow (?:many|long)\b.*\b(?:days?|weeks?|months?|hours?|sessions?|classes)\b/i,
      /\bduration\b|\bhow long (?:is|does|will|are)\b|\bhow much time\b/i,
      /\b(?:online|offline)\b/i,
      /\bzoom\b|\bgoogle meet\b|\bin ?person\b|\bclassroom\b|\bvenue\b/i,
      /\bwhere is (?:the )?(?:class|session|program|training)\b/i,
      /\bhours? (?:per|a) (?:day|week)\b/i,
    ],
  },
  {
    no: 5,
    topic: 'Certificate validity, accreditation, recognition',
    deflect: true,
    re: [
      /\bcertificat\w*\b.*\b(?:valid|validity|recognis|recogniz|approved|accredit|government|govt|iso|ugc|aicte|msme|international)\b/i,
      /\b(?:valid|recognis|recogniz|accredit|government|govt)\w*\b.*\bcertificat/i,
      /\bis the certificate\b/i,
      /\baccreditation\b|\baffiliat(?:ed|ion)\b/i,
    ],
  },
  {
    no: 6,
    topic: 'Enrollment, seat booking, registration confirmation',
    re: [
      /\b(?:book|reserve|block|confirm)\b.*\b(?:seat|slot|place|spot)\b/i,
      /\b(?:enrol|enroll|enrolment|enrollment|register|registration|sign ?up|admission)\b/i,
      // "I want to join" is enrolment; "can I join?" is an eligibility
      // question and is answered from section 6.2 instead.
      /\b(?:i want to|i would like to|i wish to|ready to|how (?:do|can) i|where (?:do|can) i|please)\b[^.\n]{0,20}\bjoin\b/i,
      /\bjoin pana(?:num|lama)\b|\bjoinnu\b|\bseat irukka\b/i,
      /சேர|பதிவு/,
    ],
  },
  {
    no: 7,
    topic: 'Refund, cancellation, transfer to another batch',
    re: [
      /\brefund\b|\bmoney back\b|\bcancel\w*\b|\bwithdraw\b/i,
      /\b(?:change|transfer|shift|postpone|reschedul)\w*\b.*\bbatch\b/i,
      /\bmiss(?:ed)?\b.*\b(?:class|session)\b/i,
    ],
  },
  {
    no: 8,
    topic: 'Corporate / bulk / in-house training enquiry',
    re: [
      /\b(?:corporate|in ?house|on ?site|bulk|group)\b.*\b(?:training|program|session|booking|batch|rate)\b/i,
      /\b(?:our|my) (?:company|organisation|organization|employees|staff|firm)\b/i,
      /\bfor \d{2,}\s+(?:people|employees|staff|members|participants|students)\b/i,
      /\bwe (?:need|want|are looking for|would like)\b[^.\n]{0,40}\b(?:training|workshop|facilitator|session|program|programme)\b/i,
      /\brfp\b|\bquotation\b|\bproposal for (?:our|my)\b/i,
    ],
  },
  {
    no: 9,
    topic: 'Partnership, sponsorship, collaboration, franchise',
    re: [
      /\bpartner(?:ship)?\b|\bcollaborat\w*\b|\bsponsor\w*\b|\bfranchise\b|\btie ?up\b/i,
      /\b(?:become|be|join as)\b[^.\n]{0,30}\b(?:fsp )?(?:trainer|facilitator|faculty|mentor|affiliate|reseller)\b.*\b(?:with|for|at|in) (?:you|fsp|your)\b/i,
      /\bcan i (?:become|be|join as)\b[^.\n]{0,30}\b(?:trainer|facilitator|faculty|mentor)\b/i,
      /\bjob (?:opening|vacancy|opportunity|available|there)\b|\bvacancy\b|\bhiring\b|\binternship\b|\bcareer (?:with|at|in) (?:you|fsp)\b/i,
      /\b(?:any|is there a|looking for a|need a|give me a)\b[^.\n]{0,20}\bjob\b/i,
      /\brefer(?:ral)? (?:program|commission|bonus)\b/i,
    ],
  },
  {
    no: 10,
    topic: 'Speaking to the founder or a specific person',
    re: [
      /\b(?:talk|speak|connect|meet|call|discuss)\b[^.\n]{0,30}\b(?:karunai|prakash|founder|owner|director|ceo|sir|madam)\b/i,
      /\b(?:karunai|prakash|founder|sir|madam)\b[^.\n]{0,30}\b(?:number|contact|available|directly|personally|whatsapp|mobile|email)\b/i,
      /\bi want to (?:talk|speak|meet)\b/i,
    ],
  },
  {
    no: 11,
    topic: 'Invoice, GST, receipt, company billing',
    deflect: true,
    re: [/\binvoice\b|\bgst\b|\breceipt\b|\bbilling\b|\btds\b|\bpan (?:card|number)\b/i],
  },
  {
    no: 12,
    topic: 'Complaint, dissatisfaction, abuse, legal matter',
    re: [
      /\b(?:not happy|unhappy|disappointed|dissatisfied|worst|waste of (?:time|money)|cheat\w*|fraud|scam\w*|fake)\b/i,
      /\bcomplaints?\b|\bgrievance\b|\bconsumer court\b|\blegal (?:action|notice)\b|\blawyer\b|\bpolice\b/i,
      /\bno (?:one|body) (?:is )?(?:responding|replying|answering)\b|\bnobody (?:called|replied)\b/i,
    ],
  },
  {
    no: 14,
    topic: 'Customer explicitly asks for a human',
    re: [
      /\b(?:call|ring|phone) me\b|\bgive me a call\b|\bcall ?back\b/i,
      /\b(?:talk|speak|chat) (?:to|with) (?:a |an )?(?:human|person|real person|agent|someone|executive|team|staff)\b/i,
      /\bconnect me\b|\btransfer me\b|\bhuman please\b/i,
      /\b(?:your |the )?(?:contact|phone|mobile|whatsapp) number\b|\bemail id\b/i,
      /\bcall pannunga\b|\bpesa (?:num|venum)\b/i,
    ],
  },
  {
    no: 16,
    topic: 'Personal / medical / financial advice, or off-topic',
    re: [
      /\b(?:loan|insurance|mutual fund|share market|crypto|bitcoin|day trading|investment advice)\b/i,
      /\b(?:medicine|tablet|depression|anxiety|suicide|therapy|treatment|prescription)\b/i,
      /\b(?:horoscope|astrology|jathagam|rasi|lottery)\b/i,
      /\b(?:politics|election|religion|caste|cricket score)\b/i,
      /\b(?:girlfriend|boyfriend|marriage proposal|dating)\b/i,
    ],
  },
];

export type TriggerHit = { no: number; topic: string; deflect: boolean; matched: string };

/** First matching trigger, scanned in knowledge-base order. */
export function screenInbound(text: string): TriggerHit | null {
  if (!text) return null;
  for (const t of TRIGGERS) {
    for (const re of t.re) {
      const m = re.exec(text);
      if (m) return { no: t.no, topic: t.topic, deflect: !!t.deflect, matched: m[0].trim() };
    }
  }
  return null;
}

export function triggerTopic(no: number): string {
  const found = TRIGGERS.find((t) => t.no === no);
  if (found) return found.topic;
  if (no === 13) return 'Not covered by the knowledge base';
  if (no === 15) return 'Repeated question or frustration';
  return `Trigger ${no}`;
}
