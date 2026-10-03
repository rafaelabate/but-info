// Gabarits HTML : toute valeur interpolée est échappée, sauf si elle vient elle-même de html``.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Brut {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const brut = (s) => new Brut(String(s));

function valeur(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Brut) return v.s;
  if (Array.isArray(v)) return v.map(valeur).join('');
  return esc(v);
}

export function html(chaines, ...vals) {
  let s = chaines[0];
  for (let i = 0; i < vals.length; i++) s += valeur(vals[i]) + chaines[i + 1];
  return new Brut(s);
}

// N'accepte que des liens web (pas de javascript:, data:, file:…).
export const urlSure = (u) => (typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : null);

export function domaine(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Minuscules sans accents, pour comparer et chercher.
export const normaliser = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Petit hachage stable (djb2) pour mémoriser un état attaché à un texte.
export function empreinte(s) {
  let h = 5381;
  const t = normaliser(s).replace(/\s+/g, ' ').trim();
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Pluriel simple : pl(3, 'séance') -> « 3 séances ».
export const pl = (n, mot, pluriel = mot + 's') => `${n} ${n > 1 ? pluriel : mot}`;
