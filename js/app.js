// Démarrage, routeur, horloge temps réel et coque (en-tête, onglets, synchro).
import { injecterIcones, ic, activerReflets, verreLiquide, ile } from './ui.js';
import { E, maintenant, chargerPublic, chargerPrive, chargerDemo, surveiller } from './donnees.js';
import { essaiAuto, montrerVerrou, ouvrirVerrou } from './verrou.js';
import { heure, relatif, decompte, pad, parts } from './temps.js';
import { lire, ecrire } from './stockage.js';
import { html } from './html.js';
// Chaque vue est chargée à la demande : une vue absente ou en erreur n'empêche pas les autres de marcher.
const CHARGEURS = {
  aujourdhui: () => import('./vues/aujourdhui.js'),
  planning: () => import('./vues/planning.js'),
  afaire: () => import('./vues/afaire.js'),
  cours: () => import('./vues/cours.js'),
  reviser: () => import('./vues/reviser.js'),
};
const TITRES = { aujourdhui: 'Aujourd’hui', planning: 'Planning', afaire: 'À faire', cours: 'Cours', reviser: 'Réviser' };
const ORDRE = Object.keys(CHARGEURS);
const VUES = {};
async function chargerVue(id) {
  if (!VUES[id]) {
    try { VUES[id] = (await CHARGEURS[id]()).default; } catch (err) {
      console.error(err);
      VUES[id] = { id, titre: TITRES[id], rendre: () => html`<div class="carte verre" style="margin-top:4px"><p class="vide">Cette section arrive dans quelques minutes.</p></div>` };
    }
  }
  return VUES[id];
}
const ouvrirReglages = (section) => import('./vues/reglages.js').then((m) => m.ouvrirReglages(section)).catch((e) => console.error(e));
const $ = (s) => document.querySelector(s);
const racine = () => $('#vue');

// ---------- Thème & fond selon l'heure (palette Côte d'Azur) ----------
export function appliquerTheme(t = lire('theme', 'auto')) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const sombre = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]')?.setAttribute('content', sombre ? '#060913' : '#e8eef8');
}
const PALETTES = {
  nuit: ['#1d3f99', '#4a2c95', '#0c7482', '#27206a'],
  aube: ['#ffb38a', '#9ec8ff', '#ffd9a3', '#ff9fb8'],
  jour: ['#56b6ff', '#2fd3c6', '#b9e4ff', '#ffe2a1'],
  soir: ['#ff8a5b', '#b25cff', '#ffc46b', '#4d6cff'],
};
function peindreFond() {
  const h = parts(maintenant()).h;
  const p = h >= 21 || h < 6 ? PALETTES.nuit : h < 9 ? PALETTES.aube : h < 17 ? PALETTES.jour : PALETTES.soir;
  p.forEach((c, i) => document.documentElement.style.setProperty(`--b${i + 1}`, c));
}

// ---------- Routeur ----------
function route() {
  const [, vue = 'aujourdhui', ...params] = location.hash.replace(/^#\/?/, '#/').split('/');
  return { vue: CHARGEURS[vue] ? vue : 'aujourdhui', params: params.map(decodeURIComponent) };
}
let vueCourante = null;
let nettoyer = null;
export async function rendre({ transition = false } = {}) {
  if (!E.pret) return;
  const { vue, params } = route();
  const V = await chargerVue(vue);
  if (route().vue !== vue) return;
  const faire = () => {
    nettoyer?.();
    const el = racine();
    el.innerHTML = String(V.rendre(E, params));
    el.className = transition ? 'vue entree' : 'vue';
    el.dataset.vue = vue;
    $('#titre').textContent = V.titre;
    $('#titre-compact').textContent = V.titre;
    $('#surtitre').textContent = V.surtitre?.(E, params) || '';
    document.title = `${V.titre} · BUT Info`;
    nettoyer = V.monter?.(el, E, params) || null;
    tic();
  };
  const changement = vueCourante !== vue;
  vueCourante = vue;
  majOnglets(vue);
  if (transition && changement && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(faire);
  else faire();
  if (changement) scrollTo({ top: 0 });
}

function majOnglets(vue) {
  const barre = $('#onglets');
  let actif = null;
  barre.querySelectorAll('a[data-vue]').forEach((a) => {
    const oui = a.dataset.vue === vue;
    if (oui) { a.setAttribute('aria-current', 'page'); actif = a; } else a.removeAttribute('aria-current');
  });
  if (actif) {
    barre.style.setProperty('--x', `${actif.offsetLeft - 6}px`);
    barre.style.setProperty('--w', `${actif.offsetWidth}px`);
  }
  const urgentes = E.echeances.filter((e) => !e.fait && e.t && e.t > maintenant() && e.t - maintenant() < 3 * 86400_000 && e.type !== 'evenement').length;
  const pastille = barre.querySelector('[data-vue="afaire"] .pastille');
  pastille.textContent = urgentes || '';
  pastille.hidden = !urgentes;
}

// ---------- Temps réel : éléments déclaratifs mis à jour chaque seconde ----------
//  data-compte="<ms>"                → « dans 12 min » / « il y a 3 h »
//  data-decompte="<ms>"              → enfants [data-j] [data-h] [data-m] [data-s]
//  data-progres="<ms début>,<ms fin>" → variable CSS --p entre 0 et 1 (+ data-reste : « encore 34 min »)
//  data-horloge                      → HH:MM
function tic() {
  const t = maintenant();
  const el = racine();
  if (!el) return;
  el.querySelectorAll('[data-compte]').forEach((n) => { n.textContent = relatif(+n.dataset.compte, t); });
  el.querySelectorAll('[data-decompte]').forEach((n) => {
    const d = decompte(+n.dataset.decompte - t);
    for (const k of ['j', 'h', 'm', 's']) { const c = n.querySelector(`[data-${k}]`); if (c) c.textContent = k === 'j' ? d.j : pad(d[k]); }
  });
  el.querySelectorAll('[data-progres]').forEach((n) => {
    const [a, b] = n.dataset.progres.split(',').map(Number);
    const p = Math.min(Math.max((t - a) / (b - a), 0), 1);
    n.style.setProperty('--p', p.toFixed(4));
    const reste = n.querySelector('[data-reste]');
    if (reste) reste.textContent = relatif(b, t).replace('dans ', 'encore ');
    const jauge = n.querySelector('.jauge[data-circ]');
    if (jauge) jauge.setAttribute('stroke-dashoffset', (+jauge.dataset.circ * (1 - p)).toFixed(2));
  });
  document.querySelectorAll('[data-horloge]').forEach((n) => { n.textContent = heure(t); });
  VUES[vueCourante]?.tic?.(el, E, t);
}
let minutePrecedente = -1;
function boucle() {
  tic();
  const m = Math.floor(maintenant() / 60_000);
  if (m !== minutePrecedente) {
    if (minutePrecedente !== -1) { VUES[vueCourante]?.minute?.(racine(), E); majOnglets(vueCourante); }
    if (m % 10 === 0) peindreFond();
    minutePrecedente = m;
    majSynchro();
  }
}

// ---------- Pastille de synchro ----------
function majSynchro() {
  const b = $('#synchro');
  if (!b) return;
  const s = E.sync;
  let texte, classe = '';
  if (E.demo) { texte = 'Démo'; classe = 'attention'; }
  else if (!s.enLigne) { texte = 'Hors ligne'; classe = 'hors-ligne'; }
  else if (!s.ade) { texte = 'ADE en attente'; classe = 'attention'; }
  else if (s.adeOk === false) { texte = 'ADE injoignable'; classe = 'attention'; }
  else if (s.moodleOk === false) { texte = 'Moodle injoignable'; classe = 'attention'; }
  else if (s.verif) {
    // Plus de 3 h sans passage de la synchro (même la nuit elle tourne chaque heure) : quelque chose cloche.
    texte = `À jour · ${relatif(s.verif, Date.now()).replace('il y a ', '')}`;
    classe = Date.now() - s.verif < 3 * 3600_000 ? 'vivant' : 'attention';
  }
  else { texte = 'Synchronisé'; classe = 'vivant'; }
  b.className = `synchro verre ${classe}`;
  b.querySelector('span:last-child').textContent = texte;
}

// ---------- Démarrage ----------
async function demarrer() {
  injecterIcones();
  appliquerTheme();
  peindreFond();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => appliquerTheme());
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('onglet-cache', document.hidden));
  if (lire('fondFixe', false)) document.documentElement.classList.add('fond-fixe');
  activerReflets();

  const demo = new URLSearchParams(location.search).has('demo');
  const publics = chargerPublic();
  if (demo) {
    await Promise.all([publics, chargerDemo()]);
    document.documentElement.classList.remove('verrouille');
    $('#verrou').hidden = true;
  } else {
    const cles = await fetch('data/cles.json', { cache: 'no-cache' }).then((r) => r.json());
    let privee = await essaiAuto(cles);
    if (!privee) privee = await montrerVerrou(cles);
    E.privee = privee;
    await Promise.all([publics, chargerPrive()]);
    ouvrirVerrou();
    surveiller();
  }
  document.documentElement.classList.remove('verrouille');
  await rendre({ transition: false });
  ORDRE.forEach((id) => chargerVue(id));
  const nav = $('#onglets');
  requestAnimationFrame(() => { majOnglets(vueCourante); verreLiquide(nav); });
  addEventListener('resize', () => { majOnglets(vueCourante); clearTimeout(demarrer.t); demarrer.t = setTimeout(() => verreLiquide(nav), 250); });
  addEventListener('hashchange', () => rendre({ transition: true }));
  document.addEventListener('donnees', (e) => {
    if (e.detail === 'sync') { majSynchro(); return; }
    if (e.detail === 'maj') ile('Emploi du temps mis à jour', { icone: 'synchro', couleur: 'var(--accent)' });
    const y = scrollY;
    rendre().then(() => scrollTo({ top: y }));
  });
  addEventListener('scroll', () => document.documentElement.classList.toggle('defile', scrollY > 56), { passive: true });
  $('#avatar').onclick = () => ouvrirReglages();
  $('#synchro').onclick = () => ouvrirReglages('synchro');
  const initiales = ((E.perso?.etudiant?.prenom || 'B')[0] + (E.perso?.etudiant?.nom || 'I')[0]).toUpperCase();
  $('#avatar').textContent = initiales;
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = '12345'.indexOf(e.key);
    if (i >= 0) location.hash = `#/${ORDRE[i]}`;
  });
  majSynchro();
  setInterval(boucle, 1000);
  if ('serviceWorker' in navigator && !demo && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

demarrer().catch((err) => {
  console.error(err);
  const v = racine();
  if (v) v.innerHTML = String(html`<div class="carte verre" style="margin-top:20px"><div class="carte-tete">${ic('alerte')}Impossible de charger le tableau de bord</div><p class="vide">${String(err.message || err)}</p></div>`);
});

export { tic };
