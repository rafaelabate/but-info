// État global : chargement, déchiffrement, fusion des sources et synchro en direct.
import { ouvrir } from './seal.js';
import { enrichirSeance, codeModule, deviner } from './cours.js';
import { lire, ecrire } from './stockage.js';
import { cleJour, depuisCle, ajouterJours, JOUR } from './temps.js';
import { normaliser } from './html.js';

export const E = {
  pret: false,
  demo: false,
  decalage: 0,                 // mode démo : décale l'horloge
  privee: null,
  perso: null,
  seances: [],
  moodle: [],
  echeances: [],
  modules: [],
  methodes: null,
  but: null,
  sync: { ade: null, moodle: null, perso: null, verif: null, verifOk: null, adeOk: null, moodleOk: null, enLigne: navigator.onLine },
};
export const maintenant = () => Date.now() + E.decalage;
const signaler = (quoi) => document.dispatchEvent(new CustomEvent('donnees', { detail: quoi }));

async function json(url, opts = {}) {
  const r = await fetch(url, { cache: 'no-cache', ...opts });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ---------- Chargement ----------
export async function chargerPublic() {
  const [m, meth, but] = await Promise.all([
    json('data/modules.json').catch(() => null),
    json('data/methodes.json').catch(() => null),
    json('data/but.json').catch(() => null),
  ]);
  E.modules = m?.modules || [];
  E.methodes = meth;
  E.but = but;
}

async function ouvrirFichier(chemin) {
  const boite = await json(chemin).catch(() => null);
  if (!boite) return null;
  try { return { contenu: await ouvrir(boite, E.privee), maj: boite.maj || null }; } catch { return null; }
}

// data/etat.json est réécrit à chaque passage de la synchro : heure de vérification, succès de chaque
// source, empreinte de chaque fichier chiffré. ?t= et ?v= contournent le cache du CDN de GitHub Pages.
const FICHIERS = ['edt.json', 'moodle.json', 'perso.json'];
const lireEtat = () => json(`data/etat.json?t=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
function noterEtat(etat) {
  if (!etat) return;
  E.sync.verif = Date.parse(etat.verif) || null;
  E.sync.adeOk = etat.ok?.ade ?? null;
  E.sync.moodleOk = etat.ok?.moodle ?? null;
  E.sync.verifOk = E.sync.adeOk !== false && E.sync.moodleOk !== false;
}
let empreintes = null;

export async function chargerPrive(etat) {
  if (etat === undefined) etat = await lireEtat();
  noterEtat(etat);
  const v = (f) => (etat?.fichiers?.[f] ? `?v=${etat.fichiers[f]}` : '');
  const lus = await Promise.all(FICHIERS.map((f) => ouvrirFichier(`data/${f}${v(f)}`)));
  // Un fichier annoncé mais pas lu (réseau) : on garde l'ancienne empreinte pour réessayer au prochain passage.
  if (lus.every((l, i) => l || !etat?.fichiers?.[FICHIERS[i]])) empreintes = JSON.stringify(etat?.fichiers ?? null);
  const [edt, moodle, perso] = lus;
  appliquer({ edt, moodle, perso });
}

function appliquer({ edt, moodle, perso }) {
  if (perso) { E.perso = perso.contenu; E.sync.perso = perso.contenu?.maj || perso.maj; }
  if (edt) { E.seances = (edt.contenu.evenements || []).map(enrichirSeance).sort((a, b) => a.t0 - b.t0); E.sync.ade = edt.contenu.maj || edt.maj; }
  if (moodle) { E.moodle = moodle.contenu.evenements || []; E.sync.moodle = moodle.contenu.maj || moodle.maj; }
  E.echeances = fusionnerEcheances();
  E.pret = true;
}

// Mode démo (?demo) : faux emploi du temps en clair pour tester l'affichage, jamais tes vraies données.
export async function chargerDemo() {
  E.demo = true;
  const d = await json('data/demo.json');
  // L'horloge de démo est calée sur la date de référence du fichier (heure réelle conservée).
  if (d.reference) E.decalage = depuisCle(d.reference) - depuisCle(cleJour(Date.now()));
  E.perso = d.perso;
  E.seances = d.seances.map(enrichirSeance).sort((a, b) => a.t0 - b.t0);
  E.moodle = d.moodle || [];
  E.sync = { ...E.sync, ade: d.maj, moodle: d.maj, perso: d.maj, verif: Date.now(), verifOk: true };
  E.echeances = fusionnerEcheances();
  E.pret = true;
}

// ---------- Échéances : relevé perso (avec statuts) + calendrier Moodle en direct ----------
// « Rendu Semaine 1 doit être rendu » → « Rendu Semaine 1 » ; « Quiz SQL ferme » → « Quiz SQL · fermeture ».
const MOMENT = { ouvre: 'ouverture', "s'ouvre": 'ouverture', ferme: 'fermeture', 'se ferme': 'fermeture' };
const titreMoodle = (t) => t.replace(/\s+(doit être rendu|est dû|est à rendre|ouvre|ferme|s'ouvre|se ferme)\s*$/i, (_, fin) => {
  const m = MOMENT[fin.toLowerCase()];
  return m ? ` · ${m}` : '';
}).trim();
function fusionnerEcheances() {
  const faites = lire('faites', {});
  const releve = (E.perso?.echeances || []).map((e) => ({
    ...e,
    t: e.limite ? Date.parse(e.limite) : null,
    t0: e.debut ? Date.parse(e.debut) : null,
    source: 'releve',
  }));
  const direct = E.moodle.map((m) => {
    const t = Date.parse(m.debut);
    const t1 = Date.parse(m.fin);
    const module = codeModule(m.cours) || deviner(m.titre) || (/but informatique/i.test(m.cours) ? 'BUT' : null);
    const devoir = /(doit être rendu|est dû|rendu|dépôt|devoir)/i.test(m.titre);
    return {
      id: 'moodle:' + m.id, module, titre: titreMoodle(m.titre), type: devoir ? 'devoir' : 'evenement',
      t: devoir ? t : (t1 > t ? t1 : t), t0: devoir ? null : t, statut: null, details: m.desc || '', url: m.url || null, source: 'moodle',
    };
  });
  // Même module + même heure limite (± 20 min) = même échéance : on garde le statut du relevé et l'heure de Moodle.
  const res = [...releve];
  for (const d of direct) {
    const i = res.findIndex((r) => r.t && d.t && Math.abs(r.t - d.t) < 20 * 60_000 && (r.module === d.module || normaliser(r.titre).includes(normaliser(d.titre).slice(0, 14))));
    if (i >= 0) res[i] = { ...res[i], t: d.t, enDirect: true, url: res[i].url || d.url };
    else res.push({ ...d, statut: d.type === 'devoir' ? 'a_verifier' : null, enDirect: true });
  }
  for (const e of res) e.fait = !!faites[e.id] || e.statut === 'rendu';
  return res.sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
}
export function basculerFait(id) {
  const faites = lire('faites', {});
  if (faites[id]) delete faites[id]; else faites[id] = Date.now();
  ecrire('faites', faites);
  E.echeances = fusionnerEcheances();
  signaler('echeances');
}

// ---------- Requêtes pratiques pour les vues ----------
export const seancesEntre = (t0, t1) => E.seances.filter((s) => s.t1 > t0 && s.t0 < t1);
export function seancesDuJour(cle) { const d = depuisCle(cle).getTime(); return seancesEntre(d, depuisCle(ajouterJours(cle, 1)).getTime()); }
export const seanceEnCours = (t = maintenant()) => E.seances.find((s) => !s.annule && s.t0 <= t && t < s.t1) || null;
export const prochaineSeance = (t = maintenant()) => E.seances.find((s) => !s.annule && s.t0 > t) || null;
export const aujourdhui = () => cleJour(maintenant());
export const echeancesAVenir = (horizon = 60 * JOUR) => E.echeances.filter((e) => e.t && e.t > maintenant() - 6 * 3600_000 && e.t < maintenant() + horizon);
export const controles = () => E.echeances.filter((e) => e.type === 'eval' && e.t && e.t > maintenant() - 2 * 3600_000);
export const moduleContenu = (code) => E.modules.find((m) => m.code === code) || null;

// ---------- Synchro en direct ----------
// GitHub Actions (dépôt privé) relève ADE et Moodle, chiffre, puis publie le site avec data/etat.json.
// Ici on relit etat.json : si une empreinte a changé, on recharge les données sans recharger la page.
export async function verifierMaj() {
  if (E.demo || !E.privee) return;
  E.sync.enLigne = navigator.onLine;
  if (!navigator.onLine) { signaler('sync'); return; }
  const etat = await lireEtat();
  if (etat) {
    noterEtat(etat);
    if (JSON.stringify(etat.fichiers ?? null) !== empreintes) {
      const avant = JSON.stringify([E.sync.ade, E.sync.moodle, E.sync.perso]);
      await chargerPrive(etat).catch(() => { /* réseau capricieux : on réessaiera */ });
      if (JSON.stringify([E.sync.ade, E.sync.moodle, E.sync.perso]) !== avant) signaler('maj');
    }
  }
  signaler('sync');
}
export function surveiller() {
  verifierMaj();
  setInterval(verifierMaj, 4 * 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verifierMaj(); });
  addEventListener('online', verifierMaj);
  addEventListener('offline', () => { E.sync.enLigne = false; signaler('sync'); });
}
