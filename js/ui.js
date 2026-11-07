// Briques d'interface : icônes, feuille modale, île dynamique, reflets du verre, verre liquide.
import { html, esc } from './html.js';

// ---------- Icônes (traits 24×24, inspirées de SF Symbols) ----------
const P = {
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  lune: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  calendrier: '<rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01"/>',
  coches: '<path d="M3.5 6.5 5 8l3-3M3.5 12.5 5 14l3-3M3.5 18.5 5 20l3-3"/><path d="M11.5 7h9M11.5 13h9M11.5 19h9"/>',
  livre: '<path d="M4.5 5A2 2 0 0 1 6.5 3H19.5v15H6.5a2 2 0 0 0-2 2z"/><path d="M4.5 20a2 2 0 0 0 2 2h13v-4M9 7.5h6"/>',
  lampe: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a6.2 6.2 0 0 0-3.7 11.2c.7.5 1.2 1.3 1.2 2.2v.1h5v-.1c0-.9.5-1.7 1.2-2.2A6.2 6.2 0 0 0 12 2.5z"/>',
  horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  epingle: '<path d="M12 21.5s-6.5-5.7-6.5-11.3a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11.3-6.5 11.3z"/><circle cx="12" cy="10.2" r="2.3"/>',
  personne: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  groupe: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.9-3.4 3.4-5.2 6.5-5.2s5.6 1.8 6.5 5.2"/><path d="M15.5 4.8a3.4 3.4 0 0 1 0 6.4M17.8 14.9c2 .6 3.3 2.3 3.9 5.1"/>',
  cadenas: '<rect x="5" y="10.5" width="14" height="10.5" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  ouvert: '<rect x="5" y="10.5" width="14" height="10.5" rx="3"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.6"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  gauche: '<path d="M15 5l-7 7 7 7"/>',
  droite: '<path d="M9 5l7 7-7 7"/>',
  bas: '<path d="M5 9l7 7 7-7"/>',
  reglages: '<path d="M4 7h9M18 7h2M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.4"/><circle cx="8.5" cy="17" r="2.4"/>',
  externe: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  synchro: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
  nuage: '<path d="M7 18h10.5a4 4 0 0 0 .9-7.9A6 6 0 0 0 7.2 8.6 4.5 4.5 0 0 0 7 18z"/><path d="M3.5 3.5l17 17"/>',
  drapeau: '<path d="M5 21.5V4m0 0h11.5l-2 4 2 4H5"/>',
  graphique: '<path d="M5 20V11M11 20V5M17 20v-6M3 20.5h18"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><path d="M14 14h2.5v2.5H14zM20.5 14v.01M14 20.5h.01M17.5 17.5h3v3h-3"/>',
  fermer: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lecture: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.8-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  reinit: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>',
  cloche: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>',
  eclair: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
  cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  tasse: '<path d="M4 8.5h13V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2.5M12 3v2.5"/>',
  document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.5l8 6 8-6"/>',
  diplome: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-4.5M21.5 9.5V15"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  bdd: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  puce: '<rect x="6" y="6" width="12" height="12" rx="2.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  sigma: '<path d="M18 5H6.5l6 7-6 7H18"/>',
  fonction: '<path d="M14 4.5c-1.8-.6-3.4.3-3.8 2.3L8 18.5c-.4 2-2 2.9-3.8 2.3M6.5 10h7M14.5 13l5.5 5.5M20 13l-5.5 5.5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/>',
  langue: '<path d="M4 5.5h9M8.5 3.5v2M6 5.5c.5 3.5 2.5 6.5 6 8M11 5.5c-.5 3-2.5 6-6.5 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
  bulle: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.3-4A8 8 0 1 1 20 11.5z"/>',
  boussole: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  feuille: '<path d="M5 19.5C5 11.5 10 5 20 5c0 10-6 15-14 15"/><path d="M5 19.5c3-4 6-6.5 9-8"/>',
  mallette: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  puzzle: '<path d="M10 4a2 2 0 1 1 4 0v1h4a1 1 0 0 1 1 1v4h-1a2 2 0 1 0 0 4h1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 1 0-4 0v1H6a1 1 0 0 1-1-1v-4h1a2 2 0 1 0 0-4H5V6a1 1 0 0 1 1-1h4z"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  valide: '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8 5.4-5.6"/>',
  alerte: '<path d="M12 4.5 21 20H3z"/><path d="M12 10v4.5M12 17.2v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/>',
  oeil: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  telephone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>',
  megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  sablier: '<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>',
  recherche: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  etincelles: '<path d="M11 3l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  repeter: '<path d="M17 2.5l3 3-3 3"/><path d="M4 11.5V10a4.5 4.5 0 0 1 4.5-4.5H20M7 21.5l-3-3 3-3"/><path d="M20 12.5V14a4.5 4.5 0 0 1-4.5 4.5H4"/>',
  melanger: '<path d="M3.5 7H7c3 0 4.5 1.5 5.5 5s2.5 5 5.5 5h2.5M17.5 14l3 3-3 3M3.5 17H7c1.3 0 2.3-.3 3.1-.9M17.5 4l3 3-3 3M20.5 7H19c-1.3 0-2.3.3-3.1.9"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 15.5l-5-5-9 9.5"/>',
  cerveau: '<path d="M9 4.5a3 3 0 0 0-3 3v.2A3 3 0 0 0 4 10.5a3 3 0 0 0 .8 2A3.2 3.2 0 0 0 6.5 18 3 3 0 0 0 9 19.5a3 3 0 0 0 3-1.5V6a3 3 0 0 0-3-1.5z"/><path d="M15 4.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 2.8 3 3 0 0 1-.8 2 3.2 3.2 0 0 1-1.7 5.5 3 3 0 0 1-2.5 1.5 3 3 0 0 1-3-1.5V6a3 3 0 0 1 3-1.5z"/>',
  crayon: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
  maison: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v10.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9"/>',
  trophee: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5.5H5a3 3 0 0 0 3 3.5M16 5.5h3a3 3 0 0 1-3 3.5M12 13v4M8.5 20.5h7M9.5 17h5"/>',
  telecharger: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
  flamme: '<path d="M12 21.5c-3.9 0-6.5-2.6-6.5-6.2 0-4.8 5-6.8 5.2-11.8 3.3 2 7.8 6.2 7.8 11.8 0 3.6-2.6 6.2-6.5 6.2z"/><path d="M12 21.5c-1.6 0-2.8-1.2-2.8-2.9 0-2.2 2.8-3.4 2.8-5.6 1.6 1.2 2.8 3.2 2.8 5.6 0 1.7-1.2 2.9-2.8 2.9z"/>',
};
// Alias pour les identifiants d'icônes des fichiers de contenu
const ALIAS = { brain: 'cerveau', repeat: 'repeter', shuffle: 'melanger', lightbulb: 'lampe', book: 'livre', moon: 'lune', clock: 'horloge', code: 'code', users: 'groupe', image: 'image', pencil: 'crayon', target: 'cible' };

export function injecterIcones() {
  if (document.getElementById('icones')) return;
  const syms = Object.entries(P).map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${d}</symbol>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg id="icones" width="0" height="0" style="position:absolute" aria-hidden="true">${syms}</svg>`);
}
export const ic = (nom, classe = '') => {
  const id = P[nom] ? nom : (ALIAS[nom] && P[ALIAS[nom]] ? ALIAS[nom] : 'etincelles');
  return html`<svg class="ic ${classe}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
};

// ---------- Retour haptique (Android ; ignoré ailleurs) ----------
export const vibrer = (motif = 8) => { try { navigator.vibrate?.(motif); } catch { /* rien */ } };

// ---------- Île dynamique ----------
let minuterieIle;
export function ile(message, { icone = 'valide', couleur = 'var(--vert)', action = null, duree = 3200 } = {}) {
  let el = document.getElementById('ile');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ile'; el.className = 'ile'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  el.style.setProperty('--c', couleur);
  el.innerHTML = String(html`<span class="rond">${ic(icone)}</span><span>${message}</span>${action ? html`<button type="button">${action.libelle}</button>` : ''}`);
  if (action) el.querySelector('button').onclick = () => { action.faire(); cacher(); };
  const cacher = () => el.classList.remove('visible');
  requestAnimationFrame(() => el.classList.add('visible'));
  clearTimeout(minuterieIle);
  minuterieIle = setTimeout(cacher, duree);
}

// ---------- Feuille modale ----------
let feuilleOuverte = null;
export function ouvrirFeuille(contenu, { titre = '', surFermeture = null, apres = null } = {}) {
  fermerFeuille(true);
  const voile = document.createElement('div');
  voile.className = 'voile';
  const f = document.createElement('section');
  f.className = 'feuille verre';
  f.setAttribute('role', 'dialog');
  f.setAttribute('aria-modal', 'true');
  if (titre) f.setAttribute('aria-label', titre);
  f.innerHTML = String(html`<div class="poignee"></div><button class="bouton rond petit fermer" type="button" aria-label="Fermer">${ic('fermer')}</button>`) + String(contenu);
  document.body.append(voile, f);
  const precedent = document.activeElement;
  const fermer = () => fermerFeuille();
  voile.onclick = fermer;
  f.querySelector('.fermer').onclick = fermer;
  // Glisser vers le bas pour fermer (mobile)
  let y0 = null, dy = 0;
  f.addEventListener('touchstart', (e) => { if (f.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; f.style.transition = 'none'; } }, { passive: true });
  f.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 0) f.style.transform = `translate(-50%, ${dy}px)`; }, { passive: true });
  f.addEventListener('touchend', () => { if (y0 == null) return; f.style.transition = ''; f.style.transform = ''; if (dy > 110) fermer(); y0 = null; });
  feuilleOuverte = { voile, f, surFermeture, precedent };
  document.addEventListener('keydown', echapFeuille);
  requestAnimationFrame(() => { voile.classList.add('ouvert'); f.classList.add('ouvert'); f.querySelector('.fermer').focus({ preventScroll: true }); });
  apres?.(f);
  return f;
}
function echapFeuille(e) { if (e.key === 'Escape') fermerFeuille(); }
export function fermerFeuille(immediat = false) {
  if (!feuilleOuverte) return;
  const { voile, f, surFermeture, precedent } = feuilleOuverte;
  feuilleOuverte = null;
  document.removeEventListener('keydown', echapFeuille);
  voile.classList.remove('ouvert'); f.classList.remove('ouvert');
  const retirer = () => { voile.remove(); f.remove(); };
  if (immediat) retirer(); else setTimeout(retirer, 450);
  surFermeture?.();
  precedent?.focus?.({ preventScroll: true });
}

// ---------- Reflet qui suit le pointeur sur le verre ----------
export function activerReflets() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let cible = null, x = 0, y = 0, prevu = false;
  document.addEventListener('pointermove', (e) => {
    cible = e.target.closest?.('.verre.lueur');
    if (!cible) return;
    x = e.clientX; y = e.clientY;
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      if (!cible) return;
      const r = cible.getBoundingClientRect();
      cible.style.setProperty('--mx', `${x - r.left}px`);
      cible.style.setProperty('--my', `${y - r.top}px`);
    });
  }, { passive: true });
}

// ---------- Verre liquide (réfraction sur les bords) : Chrome/Edge uniquement ----------
const estChromium = () => !!navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand)) && !/iPhone|iPad/.test(navigator.userAgent);
let nFiltre = 0;
export function verreLiquide(el, { bord = 20, force = 44, flou = 5 } = {}) {
  if (!el || !estChromium() || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 20 || h < 20) return;
  const rayon = Math.min(h / 2, w / 2, parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(w, h);
  const d = im.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + .5 - w / 2, py = y + .5 - h / 2;
      const qx = Math.abs(px) - (w / 2 - rayon), qy = Math.abs(py) - (h / 2 - rayon);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      const sdf = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rayon;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = (ox / l) * Math.sign(px); ny = (oy / l) * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
      const t = Math.min(Math.max(-sdf / bord, 0), 1);
      const m = (1 - t) ** 2.2;
      const i = (y * w + x) * 4;
      d[i] = 128 - nx * m * 127;
      d[i + 1] = 128 - ny * m * 127;
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(im, 0, 0);
  const id = `liquide-${++nFiltre}`;
  let defs = document.getElementById('filtres-liquides');
  if (!defs) {
    document.body.insertAdjacentHTML('afterbegin', '<svg id="filtres-liquides" width="0" height="0" style="position:absolute" aria-hidden="true"><defs></defs></svg>');
    defs = document.getElementById('filtres-liquides');
  }
  defs.querySelector(`#${el.dataset.filtre}`)?.remove();
  defs.querySelector('defs').insertAdjacentHTML('beforeend', `
    <filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feImage href="${c.toDataURL()}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="carte"/>
      <feDisplacementMap in="SourceGraphic" in2="carte" scale="${force}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`);
  el.dataset.filtre = id;
  el.style.backdropFilter = `url(#${id}) blur(${flou}px) saturate(185%) brightness(1.04)`;
  el.classList.add('liquide');
}

// ---------- Anneau SVG ----------
export function anneau(p, { taille = 64, epaisseur = 7, couleur = 'var(--accent)', centre = '', attrs = '' } = {}) {
  const r = 50 - epaisseur / 2 * (100 / taille);
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.min(Math.max(p, 0), 1));
  return html`<div class="anneau" style="--taille:${taille}px; --epaisseur:${epaisseur * 100 / taille}; --c:${couleur}" ${brutAttrs(attrs)}>
    <svg viewBox="0 0 100 100"><circle class="piste" cx="50" cy="50" r="${r}" style="stroke-width:${epaisseur * 100 / taille}"/><circle class="jauge" cx="50" cy="50" r="${r}" style="stroke-width:${epaisseur * 100 / taille}" stroke-dasharray="${circ}" stroke-dashoffset="${off}" data-circ="${circ}"/></svg>
    <div class="centre">${centre}</div></div>`;
}
const brutAttrs = (a) => ({ toString: () => a, s: a, __proto__: html``.constructor.prototype });

export { esc };
