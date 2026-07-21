let _map = null;
let _rev = null;

const FALLBACK_MAP = ['⊡', '─', '═', '▬', '●', '■', '▲', '▼', '◆', '◀'];

async function loadMap() {
  if (_map) return;
  try {
    const { default: api } = await import('../api');
    const data = await api.getCipherMap();
    const arr = data?.mapping?.map(m => m.symbol) || [];
    if (arr.length === 10) {
      _map = arr;
      _rev = Object.fromEntries(arr.map((s, i) => [s, i]));
      return;
    }
  } catch (e) { /* fallback */ }
  _map = FALLBACK_MAP;
  _rev = Object.fromEntries(FALLBACK_MAP.map((s, i) => [s, i]));
}

function ensureMap() {
  if (!_map) {
    _map = FALLBACK_MAP;
    _rev = Object.fromEntries(FALLBACK_MAP.map((s, i) => [s, i]));
  }
}

export async function initCipher() {
  await loadMap();
}

export function encNum(num) {
  ensureMap();
  if (num == null || isNaN(num)) return _map[0].repeat(2);
  const s = Math.round(Number(num)).toString();
  return s.split('').map(d => _map[parseInt(d)]).join('');
}

export function decNum(code) {
  ensureMap();
  if (!code) return null;
  const s = code.split('').map(c => _rev[c]).join('');
  return parseInt(s);
}

export function encStr(str) {
  ensureMap();
  if (!str) return str;
  return str.split('').map(c => {
    if (c >= '0' && c <= '9') return _map[parseInt(c)];
    return c;
  }).join('');
}

export function getCipherSymbols() {
  ensureMap();
  return _map;
}
