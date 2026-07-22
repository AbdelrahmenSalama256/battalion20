const FRANCO_TO_ARABIC = {
  '2': 'ا', '3': 'ع', '4': 'ظ', '5': 'خ', '6': 'ت', '7': 'ح', '8': 'ق', '9': 'ص', '0': 'ض',
  'a': 'ا', 'b': 'ب', 'c': 'ك', 'd': 'د', 'e': 'ي', 'f': 'ف', 'g': 'ج',
  'h': 'ه', 'i': 'ي', 'j': 'ج', 'k': 'ك', 'l': 'ل', 'm': 'م', 'n': 'ن',
  'o': 'و', 'p': 'ب', 'q': 'ق', 'r': 'ر', 's': 'س', 't': 'ت', 'u': 'و',
  'v': 'ف', 'w': 'و', 'x': 'خ', 'y': 'ي', 'z': 'ز',
};

export function francoToArabic(text) {
  return text.split('').map(ch => FRANCO_TO_ARABIC[ch.toLowerCase()] || ch).join('');
}

const ARABIC_EQUIVALENTS = { 'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'إ': 'ا', 'أ': 'ا', 'آ': 'ا', 'ئ': 'ي' };

function normalizeArabic(text) {
  let t = text.toLowerCase().trim();
  for (const [from, to] of Object.entries(ARABIC_EQUIVALENTS)) {
    t = t.split(from).join(to);
  }
  return t;
}

export function smartMatch(search, name) {
  if (!search || !name) return false;
  const q = normalizeArabic(search);
  const n = normalizeArabic(name);
  if (n.includes(q)) return true;
  const transliterated = francoToArabic(search);
  const qNorm = normalizeArabic(transliterated);
  if (n.includes(qNorm)) return true;
  const nameToLatin = arabicToFranco(n);
  if (nameToLatin.includes(q.toLowerCase())) return true;
  if (nameToLatin.includes(qNorm)) return true;
  return false;
}

const ARABIC_TO_FRANCO = {};
for (const [f, a] of Object.entries(FRANCO_TO_ARABIC)) {
  if (a.length === 1 && !ARABIC_TO_FRANCO[a]) ARABIC_TO_FRANCO[a] = f;
}
ARABIC_TO_FRANCO['ة'] = '7';
ARABIC_TO_FRANCO['ئ'] = 'e';

export function arabicToFranco(text) {
  return text.split('').map(ch => ARABIC_TO_FRANCO[ch] || ch).join('');
}
