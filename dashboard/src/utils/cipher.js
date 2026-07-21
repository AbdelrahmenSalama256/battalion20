const DIGIT_MAP = ['⊡', '─', '═', '▬', '●', '■', '▲', '▼', '◆', '◀'];
const DIGIT_REV = Object.fromEntries(DIGIT_MAP.map((s, i) => [s, i]));

export function encNum(num) {
  if (num == null || isNaN(num)) return '⊡⊡';
  const s = Math.round(Number(num)).toString();
  return s.split('').map(d => DIGIT_MAP[parseInt(d)]).join('');
}

export function decNum(code) {
  if (!code) return null;
  const s = code.split('').map(c => DIGIT_REV[c]).join('');
  return parseInt(s);
}

export function encStr(str) {
  if (!str) return str;
  return str.split('').map(c => {
    if (c >= '0' && c <= '9') return DIGIT_MAP[parseInt(c)];
    return c;
  }).join('');
}

export function getDecoderData() {
  return {
    mapping: DIGIT_MAP.map((sym, i) => ({ symbol: sym, digit: i, label: `الرقم ${i}` })),
    examples: [
      { value: 0, encoded: encNum(0) },
      { value: 10, encoded: encNum(10) },
      { value: 25, encoded: encNum(25) },
      { value: 50, encoded: encNum(50) },
      { value: 75, encoded: encNum(75) },
      { value: 85, encoded: encNum(85) },
      { value: 100, encoded: encNum(100) },
    ],
    hint: "كل رقم من score يتم تحويله لرمز حسب الجدول. مثال: 85 → " + encNum(85) + " (8=◆, 5=■)",
  };
}