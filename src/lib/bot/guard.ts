/**
 * Outbound payment guard — WHATSAPP-BOT-KNOWLEDGE.md section 3 and section 11.
 *
 * "Enforce the payment block in code, not only in the prompt."
 *
 * Every outgoing message passes through `guardOutbound` before it reaches
 * Evolution API. HARD patterns are blocked unconditionally, including for
 * vetted knowledge-base templates — nothing in the knowledge base should ever
 * contain an amount, a UPI handle or an account number, so a HARD hit means
 * something is wrong and the message must not go out.
 *
 * SOFT patterns (the words "fee", "price", "discount", ...) are blocked only
 * for untrusted text. The knowledge base deliberately contains a few safe
 * payment-safety lines ("FSP never shares payment details through this chat"),
 * and those are trusted templates.
 */

type Rule = { name: string; re: RegExp };

/** Never allowed, from any source. */
const HARD: Rule[] = [
  // "₹5000", "Rs. 15,000", "INR 15000", "$500" — the separator between the
  // currency word and the digits may be a period, colon, space or nothing.
  { name: 'currency-amount', re: /(?:₹|\brs\b\.?|\binr\b\.?|\busd\b\.?|\brupees?\b|\$)[\s:.]*[\d,]+(?:\.\d{1,2})?/i },
  { name: 'amount-slash', re: /[\d,]{3,}\s*\/-/ },
  { name: 'amount-only', re: /\b[\d,]{4,}\s*(?:only|rupees|rupee)\b/i },
  {
    name: 'amount-magnitude',
    re: /\b\d+(?:\.\d+)?\s*(?:lakh|lakhs|lac|crore|crores|k)\b(?!\s*\+?\s*(?:people|participants|members|trained|professionals|students|facilitators))/i,
  },
  {
    name: 'upi-handle',
    re: /\b[\w.\-]{2,}@(?:ok(?:axis|hdfc|icici|sbi)|upi|paytm|ybl|ibl|apl|axl|airtel|sbi|hdfcbank|icici|yesbank)\b/i,
  },
  { name: 'ifsc-code', re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/ },
  { name: 'account-number', re: /\b\d{9,18}\b/ },
  { name: 'account-label', re: /\ba\/c\b|\baccount (?:no\b|number|details)|\bifsc\b|\bbeneficiary\b/i },
  {
    name: 'payment-gateway',
    re: /\b(?:razorpay|payu|ccavenue|instamojo|cashfree|paypal|stripe|billdesk|phonepe|paytm|gpay|g ?pay|bhim)\b/i,
  },
  { name: 'card-credentials', re: /\bcvv\b|\botp\b|\bcard (?:number|details)\b|\bnet ?banking\b/i },
  { name: 'qr-code', re: /\bqr\b/i },
  { name: 'pay-instruction', re: /\b(?:pay|transfer|send)\b[^.\n]{0,24}\b(?:to (?:this|the) (?:account|number|upi)|via upi|and confirm)\b/i },
  { name: 'payment-confirmed', re: /\byour payment (?:is |has been )?(?:received|confirmed|successful)\b/i },
  { name: 'payment-url', re: /https?:\/\/[^\s]*(?:pay|checkout|razorpay|payu|invoice|billing)[^\s]*/i },
];

/** Blocked for free text (manual sends, anything not a vetted template). */
const SOFT: Rule[] = [
  { name: 'fee-word', re: /\bfees?\b/i },
  { name: 'price-word', re: /\bprice\b|\bpricing\b|\bcosts?\b|\bcharges?\b/i },
  { name: 'discount-word', re: /\bdiscount\b|\boffer price\b|\bconcession\b|\bearly ?bird\b/i },
  { name: 'emi-word', re: /\bemi\b|\binstal?ments?\b/i },
  { name: 'payment-link-word', re: /\bpayment link\b|\bpay ?link\b/i },
  { name: 'upi-word', re: /\bupi\b/i },
  { name: 'bank-word', re: /\bbank\b/i },
  { name: 'refund-amount', re: /\brefund\b[^.\n]{0,20}\b\d/i },
  { name: 'guarantee', re: /\b(?:guarantee[ds]?|guaranteed|assured|100% (?:job|placement|client))\b/i },
  { name: 'named-client', re: /\b(?:tcs|infosys|wipro|hyundai|hdfc|icici|hcl|cognizant|accenture)\b/i },
  { name: 'claims-human', re: /\bi am (?:a )?human\b|\bi'?m (?:a )?(?:human|real person)\b/i },
];

/**
 * A bare number is only an amount when the sentence is about money. The
 * knowledge base legitimately says "1000+ member community" and "create 1000
 * impactful facilitators"; neither mentions money, so neither is blocked —
 * but "the fee is 15000" is caught even without a currency symbol.
 */
const MONEY_CONTEXT =
  /\bfees?\b|\bprice\b|\bpricing\b|\bcosts?\b|\bamount\b|\bcharges?\b|\bdiscount\b|\binvestment\b|\bpayment\b|\bpay\b|\btotal\b|\bbudget\b/i;
const BARE_AMOUNT = /\b\d{1,3},\d{2,3}(?:,\d{3})*\b|\b\d{4,7}\b/;

export type GuardVerdict =
  | { ok: true }
  | { ok: false; severity: 'hard' | 'soft'; pattern: string; matched: string };

export function guardOutbound(text: string, opts: { trusted?: boolean } = {}): GuardVerdict {
  const body = text || '';
  for (const r of HARD) {
    const m = r.re.exec(body);
    if (m) return { ok: false, severity: 'hard', pattern: r.name, matched: m[0].trim() };
  }
  if (MONEY_CONTEXT.test(body)) {
    const m = BARE_AMOUNT.exec(body);
    if (m) return { ok: false, severity: 'hard', pattern: 'amount-in-money-context', matched: m[0] };
  }
  if (!opts.trusted) {
    for (const r of SOFT) {
      const m = r.re.exec(body);
      if (m) return { ok: false, severity: 'soft', pattern: r.name, matched: m[0].trim() };
    }
  }
  return { ok: true };
}

export function describeVerdict(v: GuardVerdict): string {
  if (v.ok) return 'clean';
  return `${v.severity.toUpperCase()} block · ${v.pattern} · matched "${v.matched}"`;
}
