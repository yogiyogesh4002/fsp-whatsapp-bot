/** Text normalisation + WhatsApp formatting helpers. */

/** Lowercase, drop accents/punctuation, collapse whitespace. Keeps Tamil glyphs. */
export function normalize(input: string): string {
  return (input || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[^\p{L}\p{N}\s'@/.+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(input: string): string[] {
  return normalize(input).split(' ').filter(Boolean);
}

/**
 * The knowledge base is authored in markdown; WhatsApp speaks a different
 * dialect. Convert **bold** -> *bold*, _italic_ stays, strip headings and
 * blockquote markers, and normalise bullets.
 */
export function toWhatsApp(md: string): string {
  let s = md.replace(/\r\n/g, '\n');
  s = s.replace(/^\s*>\s?/gm, '');            // blockquote markers
  s = s.replace(/^\s{0,3}#{1,6}\s*/gm, '');   // headings
  s = s.replace(/\*\*(.+?)\*\*/gs, '*$1*');   // bold
  s = s.replace(/^\s*[-*]\s+/gm, '• ');       // bullets
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Fill {{name}} style slots; unknown slots collapse to a neutral phrase. */
export function fill(template: string, vars: Record<string, string | null | undefined>): string {
  let out = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '');
  // "shortly, ." -> "shortly." when a name slot was empty
  out = out.replace(/,\s*([.!?])/g, '$1');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/ +\n/g, '\n');
  return out.trim();
}

/** Split a long reply into WhatsApp-sized chunks on paragraph boundaries. */
export function chunk(text: string, limit = 1000): string[] {
  if (text.length <= limit) return [text];
  const paras = text.split(/\n\n+/);
  const out: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).trim().length > limit && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
