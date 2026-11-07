// Réviser : minuteur Pomodoro, plan de révision espacée avant chaque contrôle, méthodes validées par la recherche.
import { html, urlSure, domaine, empreinte } from '../html.js';
import { ic, ile, vibrer, ouvrirFeuille } from '../ui.js';
import { E, maintenant, controles, moduleContenu, seancesDuJour } from '../donnees.js';
import { cleJour, depuisCle, ajouterJours, heure, dateMoyenne, jourRelatif, parts, jourCourt, numeroJour, jourSemaine, ecartJours, majuscule, pad, MIN } from '../temps.js';
import { info, styleModule, CODES } from '../cours.js';
import { lire, ecrire } from '../stockage.js';

// Le mode démo a sa propre mémoire : il ne touche jamais aux vraies sessions.
const K = (k) => `reviser:${E.demo ? 'demo:' : ''}${k}`;
const TITRE_ONGLET = 'Réviser · BUT Info';
let racineMontee = null;

// ==========================================================================
// Minuteur Pomodoro
// ==========================================================================
const pomo = () => E.methodes?.pomodoro || {};
function formule(i) {
  const p = pomo();
  const t = p.travail_min || 25, c = p.pause_min || 5, l = p.longue_pause_min || 15;
  return [{ t, c, l }, { t: 50, c: 10, l: p.longue_pause_max_min || 30 }, { t: 15, c: 3, l }][i] || { t, c, l };
}
const FORMULES = [0, 1, 2];
const nCycles = () => pomo().cycles_avant_longue || 4;
const PHASES = { travail: 'Travail', pause: 'Pause', longue: 'Longue pause' };
const ETAT0 = { phase: 'travail', cycle: 0, preset: 0, module: null, fin: null, reste: null };

let etat = null;
function lireEtat() {
  if (!etat) {
    const s = lire(K('pomodoro'), {});
    etat = { ...ETAT0, ...(s && typeof s === 'object' ? s : {}) };
    if (!PHASES[etat.phase]) etat.phase = 'travail';
  }
  return etat;
}
const sauver = () => ecrire(K('pomodoro'), etat);
function dureePhase(s) {
  const f = formule(s.preset);
  return (s.phase === 'travail' ? f.t : s.phase === 'pause' ? f.c : f.l) * MIN;
}
const restant = (s, now = Date.now()) => (s.fin ? Math.max(0, s.fin - now) : Math.min(s.reste ?? Infinity, dureePhase(s)));

// Couleur de la phase : le module travaillé, sinon l'orange du minuteur iOS ; vert pour les pauses.
function couleurs(s) {
  if (s.phase === 'pause') return ['var(--vert)', 'var(--vert-encre)'];
  if (s.phase === 'longue') return ['var(--menthe)', 'var(--menthe-encre)'];
  if (s.module) { const c = info(s.module).couleur; return [`var(--${c})`, `var(--${c}-encre)`]; }
  return ['var(--orange)', 'var(--orange-encre)'];
}

// ---------- Son discret (WebAudio) ----------
let audio = null;
function preparerSon() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}
function bip(n = 1) {
  try {
    preparerSon();
    if (!audio) return;
    const t0 = audio.currentTime + 0.03;
    for (let i = 0; i < n; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = i ? 1318.5 : 987.8;
      const t = t0 + i * 0.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.45);
    }
  } catch { /* pas de son : tant pis */ }
}

// ---------- Journal des pomodoros ----------
function journalDemo() {
  const auj = cleJour(maintenant());
  const motif = [['R1.01', 'R1.01'], [], ['R1.02', 'R1.02', 'R1.05'], ['R1.03'], ['R1.01', 'R1.02', 'R1.02', 'R1.10'], ['R1.05', 'R1.02'], ['R1.02']];
  return motif.flatMap((mods, i) => mods.map((m, n) => ({ t: depuisCle(ajouterJours(auj, i - 6), 17, 0).getTime() + n * 30 * MIN, m, d: 25 })));
}
function journal() {
  const j = lire(K('sessions'), null);
  if (Array.isArray(j)) return j;
  return E.demo ? journalDemo() : [];
}
function noter(module, d, t) {
  const j = journal();
  j.push({ t, m: module || null, d });
  ecrire(K('sessions'), j.filter((x) => x.t > t - 70 * 86400_000));
}

// ---------- Actions ----------
let minuterie = null;
function planifierFin() {
  clearTimeout(minuterie);
  const s = lireEtat();
  if (s.fin) minuterie = setTimeout(() => terminer(), Math.min(Math.max(0, s.fin - Date.now()) + 40, 2 ** 31 - 1));
}
function demarrer() {
  const s = lireEtat();
  if (s.fin) return;
  preparerSon();
  s.fin = Date.now() + restant(s);
  s.reste = null;
  sauver(); planifierFin(); vibrer(8);
}
function mettreEnPause() {
  const s = lireEtat();
  if (!s.fin) return;
  s.reste = Math.max(0, s.fin - Date.now());
  s.fin = null;
  sauver(); planifierFin(); vibrer(8);
}
const basculer = () => (lireEtat().fin ? mettreEnPause() : demarrer());
function reinitialiser() {
  const s = lireEtat();
  if (!s.fin && s.reste == null) { s.phase = 'travail'; s.cycle = 0; }
  s.fin = null; s.reste = null;
  sauver(); planifierFin(); vibrer(8);
}
function passer() {
  const s = lireEtat();
  if (s.phase === 'travail') s.phase = 'pause';
  else { if (s.phase === 'longue') s.cycle = 0; s.phase = 'travail'; }
  s.fin = null; s.reste = null;
  sauver(); planifierFin(); vibrer(8);
}
function terminer() {
  const s = lireEtat();
  if (!s.fin || s.fin > Date.now()) return false;
  const fin = s.fin;
  const retard = Date.now() - fin;
  const finie = s.phase;
  if (finie === 'travail') {
    noter(s.module, Math.round(dureePhase(s) / MIN), maintenant() - retard);
    s.cycle += 1;
    s.phase = s.cycle >= nCycles() ? 'longue' : 'pause';
  } else {
    if (finie === 'longue') s.cycle = 0;
    s.phase = 'travail';
  }
  s.fin = null; s.reste = null;
  sauver(); planifierFin();
  if (retard < 90_000) { bip(finie === 'travail' ? 2 : 1); vibrer([60, 90, 60]); }
  const min = Math.round(dureePhase(s) / MIN);
  const message = finie === 'travail'
    ? `${retard < 90_000 ? 'Pomodoro terminé' : `Pomodoro terminé à ${heure(fin)}`} · ${s.phase === 'longue' ? 'longue pause' : 'pause'} de ${min} min`
    : `${finie === 'longue' ? 'Longue pause' : 'Pause'} terminée · ${min} min de travail`;
  ile(message, {
    icone: finie === 'travail' ? 'tasse' : 'cible',
    couleur: couleurs(s)[0],
    action: { libelle: 'Lancer', faire: () => { demarrer(); rafraichir(); } },
    duree: 9000,
  });
  rafraichir();
  return true;
}

// Minuteur déjà lancé (rechargement de la page) : on reprend là où il en était.
setTimeout(() => { if (!E.pret) return; if (!terminer()) planifierFin(); }, 0);
addEventListener('storage', (e) => {
  if (!e.key || !e.key.endsWith(K('pomodoro'))) return;
  etat = null; planifierFin(); rafraichir();
});

// ---------- Rendu du minuteur ----------
const R = 92;
const CIRC = 2 * Math.PI * R;
function vueEtat(now = Date.now()) {
  const s = lireEtat();
  const total = dureePhase(s);
  const reste = restant(s, now);
  const etatM = s.fin ? 'marche' : s.reste != null && s.reste < total ? 'pause' : 'repos';
  const sec = Math.ceil(reste / 1000);
  const [c, ce] = couleurs(s);
  const f = formule(s.preset);
  return {
    s, total, reste, etat: etatM, c, ce, f,
    temps: `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`,
    etiquette: s.phase === 'travail' && s.module ? `Travail · ${info(s.module).court}` : PHASES[s.phase],
    offset: CIRC * (1 - reste / total),
  };
}
function finHTML(v, now = Date.now()) {
  if (v.etat === 'marche') return html`${ic('cloche')}<span class="chiffres">${heure(now + v.reste)}</span>`;
  if (v.etat === 'pause') return html`${ic('pause')}<span>En pause</span>`;
  const suite = v.s.phase === 'travail' ? `puis ${v.s.cycle + 1 >= nCycles() ? v.f.l : v.f.c} min de pause` : `puis ${v.f.t} min de travail`;
  return html`<span>${suite}</span>`;
}
function points(s) {
  return Array.from({ length: nCycles() }, (_, i) => html`<i class="${i < s.cycle ? 'fait' : i === s.cycle && s.phase === 'travail' ? 'encours' : ''}"></i>`);
}
function conseil(s, etatM) {
  const l = pomo().conseils || [];
  const trouver = (re) => l.find((x) => re.test(x));
  if (s.phase !== 'travail') return trouver(/pendant la pause/i) || '';
  if (etatM === 'marche') return trouver(/parasite/i) || trouver(/téléphone/i) || '';
  return trouver(/objectif/i) || l[0] || '';
}
const libellePrincipal = (e) => (e === 'marche' ? 'Pause' : e === 'pause' ? 'Reprendre' : 'Démarrer');

function modulesProposes() {
  const s = lireEtat();
  const vus = [];
  const ajouter = (c) => { if (c && info(c) && !vus.includes(c) && c !== 'BUT') vus.push(c); };
  ajouter(s.module);
  controles().forEach((c) => ajouter(c.module));
  journal().slice(-30).reverse().forEach((x) => ajouter(x.m));
  CODES.forEach(ajouter);
  return vus;
}

function graduations() {
  const r = 80, c = 2 * Math.PI * r;
  return html`<circle class="rv-grad" cx="100" cy="100" r="${r}" stroke-dasharray="0.7 ${(c / 60 - 0.7).toFixed(3)}" stroke-dashoffset="0.35"/>
    <circle class="rv-grad fort" cx="100" cy="100" r="${r}" stroke-dasharray="1.2 ${(c / 12 - 1.2).toFixed(3)}" stroke-dashoffset="0.6"/>`;
}

function minuteur() {
  const v = vueEtat();
  const { s } = v;
  return html`<section class="rv-minuteur verre fort carte" data-etat="${v.etat}" data-phase="${s.phase}" style="--rv-c: ${v.c}; --rv-ce: ${v.ce}">
    <div class="segment rv-formules" style="--n: 3; --i: ${s.preset}" role="group" aria-label="Durées de travail et de pause">
      ${FORMULES.map((i) => { const x = formule(i); return html`<button type="button" data-rv="formule" data-arg="${i}" aria-pressed="${i === s.preset}" aria-label="${x.t} min de travail, ${x.c} min de pause"><span class="chiffres">${x.t}<small>/${x.c}</small></span></button>`; })}
    </div>
    <div class="rv-cadran">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        ${graduations()}
        <circle class="rv-piste" cx="100" cy="100" r="${R}"/>
        <circle class="rv-jauge" cx="100" cy="100" r="${R}" stroke-dasharray="${CIRC.toFixed(2)}" stroke-dashoffset="${v.offset.toFixed(2)}"/>
      </svg>
      <div class="rv-centre" role="timer" aria-live="off">
        <div class="rv-phase" data-rv-phase>${v.etiquette}</div>
        <div class="rv-temps chiffres" data-rv-temps>${v.temps}</div>
        <div class="rv-fin" data-rv-fin>${finHTML(v)}</div>
      </div>
    </div>
    <div class="rv-commandes">
      <button class="rv-rond gris" type="button" data-rv="reinit" aria-label="Réinitialiser le minuteur" ${v.etat === 'repos' && s.phase === 'travail' && !s.cycle ? 'disabled' : ''}>Annuler</button>
      <div class="rv-milieu">
        <div class="rv-cycles" data-rv-cycles role="img" aria-label="${s.cycle} pomodoro${s.cycle > 1 ? 's' : ''} sur ${nCycles()} avant la longue pause">${points(s)}</div>
        <button class="rv-passer" type="button" data-rv="passer">Passer${ic('droite')}</button>
      </div>
      <button class="rv-rond ${v.etat === 'marche' ? 'orange' : 'vert'}" type="button" data-rv="basculer" data-rv-principal>${libellePrincipal(v.etat)}</button>
    </div>
    <div class="rv-puces" role="group" aria-label="Module travaillé">
      <button class="rv-puce" type="button" data-rv="module" data-arg="" aria-pressed="${!s.module}">Libre</button>
      ${modulesProposes().map((c) => html`<button class="rv-puce" type="button" data-rv="module" data-arg="${c}" style="${styleModule(c)}" aria-pressed="${s.module === c}" title="${info(c).nom}">${info(c).court}</button>`)}
    </div>
    <p class="rv-conseil" data-rv-conseil>${conseil(s, v.etat)}</p>
  </section>`;
}

function majMinuteur(r) {
  const el = r?.querySelector('.rv-minuteur');
  if (!el) return;
  const v = vueEtat();
  const { s } = v;
  el.dataset.etat = v.etat;
  el.dataset.phase = s.phase;
  el.style.setProperty('--rv-c', v.c);
  el.style.setProperty('--rv-ce', v.ce);
  const t = el.querySelector('[data-rv-temps]');
  if (t.textContent !== v.temps) t.textContent = v.temps;
  const p = el.querySelector('[data-rv-phase]');
  if (p.textContent !== v.etiquette) p.textContent = v.etiquette;
  const fin = String(finHTML(v));
  const f = el.querySelector('[data-rv-fin]');
  if (f.dataset.v !== fin) { f.innerHTML = fin; f.dataset.v = fin; }
  el.querySelector('.rv-jauge').setAttribute('stroke-dashoffset', v.offset.toFixed(2));
  const b = el.querySelector('[data-rv-principal]');
  b.textContent = libellePrincipal(v.etat);
  b.className = `rv-rond ${v.etat === 'marche' ? 'orange' : 'vert'}`;
  el.querySelector('[data-rv="reinit"]').disabled = v.etat === 'repos' && s.phase === 'travail' && !s.cycle;
  const cy = el.querySelector('[data-rv-cycles]');
  const pts = String(html`${points(s)}`);
  if (cy.dataset.v !== pts) { cy.innerHTML = pts; cy.dataset.v = pts; }
  const seg = el.querySelector('.rv-formules');
  seg.style.setProperty('--i', s.preset);
  seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.arg === s.preset)));
  el.querySelectorAll('.rv-puce').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.arg || null) === (s.module || null))));
  const c = el.querySelector('[data-rv-conseil]');
  const txt = conseil(s, v.etat);
  if (c.textContent !== txt) c.textContent = txt;
  document.title = v.etat === 'marche' ? `${v.temps} · ${PHASES[s.phase]}` : TITRE_ONGLET;
}

function rafraichir() {
  const r = racineMontee;
  if (!r || !r.isConnected) return;
  majMinuteur(r);
  const st = r.querySelector('.rv-stats');
  if (st) st.outerHTML = String(stats());
}

// ---------- Statistiques ----------
const tempsCourt = (min) => (min >= 60 ? html`${Math.floor(min / 60)}<small>h</small>${pad(min % 60)}` : html`${min}<small>min</small>`);
function stats() {
  const j = journal();
  const auj = cleJour(maintenant());
  const jours = Array.from({ length: 7 }, (_, i) => ajouterJours(auj, i - 6));
  const parJour = Object.fromEntries(jours.map((k) => [k, []]));
  for (const x of j) { const k = cleJour(x.t); if (parJour[k]) parJour[k].push(x); }
  const duJour = parJour[auj];
  const semaine = jours.flatMap((k) => parJour[k]);
  const avecSession = new Set(j.map((x) => cleJour(x.t)));
  let serie = 0;
  for (let k = avecSession.has(auj) ? auj : ajouterJours(auj, -1); avecSession.has(k); k = ajouterJours(k, -1)) serie++;
  const rep = {};
  for (const x of semaine) { const m = x.m || ''; rep[m] ||= { n: 0, d: 0 }; rep[m].n++; rep[m].d += x.d; }
  const lignes = Object.entries(rep).sort((a, b) => b[1].d - a[1].d);
  const ordre = lignes.map(([m]) => m);
  const max = Math.max(4, ...jours.map((k) => parJour[k].length));
  const maxD = Math.max(1, ...lignes.map(([, x]) => x.d));
  const HMAX = 88;
  return html`<section class="rv-stats verre carte">
    <div class="carte-tete" style="--c-icone: var(--orange)">${ic('flamme')}Pomodoros<span class="espace"></span><span class="rv-note">7 derniers jours</span></div>
    <div class="rv-chiffres">
      <div><b class="chiffres">${duJour.length}</b><span>aujourd’hui</span></div>
      <div><b class="chiffres">${tempsCourt(duJour.reduce((a, x) => a + x.d, 0))}</b><span>de travail</span></div>
      <div><b class="chiffres">${semaine.length}</b><span>sur 7 jours</span></div>
      <div><b class="chiffres">${serie}<small>j</small></b><span>d’affilée</span></div>
    </div>
    <div class="rv-graph" role="img" aria-label="${jours.map((k) => `${jourCourt(depuisCle(k))} ${parJour[k].length}`).join(', ')}">
      ${jours.map((k) => {
        const l = parJour[k];
        const segs = ordre.map((m) => [m, l.filter((x) => (x.m || '') === m).length]).filter(([, n]) => n);
        return html`<div class="rv-jour ${k === auj ? 'auj' : ''}">
          <b class="chiffres">${l.length || ''}</b>
          <div class="rv-pile ${l.length ? '' : 'vide'}" style="height:${l.length ? Math.max(8, Math.round(HMAX * l.length / max)) : 4}px">${segs.map(([m, n]) => html`<i style="${styleModule(m || null)}; flex:${n}"></i>`)}</div>
          <span>${k === auj ? 'auj.' : jourCourt(depuisCle(k))}</span></div>`;
      })}
    </div>
    ${lignes.length ? html`<ul class="rv-repartition">${lignes.slice(0, 5).map(([m, x]) => html`<li style="${styleModule(m || null)}">
      <span class="rv-rep-nom">${m ? info(m).court : 'Libre'}</span>
      <span class="rv-rep-barre"><i style="--p:${(x.d / maxD).toFixed(3)}"></i></span>
      <span class="rv-rep-val chiffres">${x.n} · ${x.d >= 60 ? `${Math.floor(x.d / 60)} h ${pad(x.d % 60)}` : `${x.d} min`}</span></li>`)}</ul>`
      : html`<p class="vide">Aucun pomodoro cette semaine.</p>`}
  </section>`;
}

// ==========================================================================
// Plan de révision espacée
// ==========================================================================
const ETAPES = [
  { j: 10, nom: 'Feuille blanche', min: 25, src: 'm' },
  { j: 7, nom: 'Sujet blanc', min: 50, src: 'r' },
  { j: 4, nom: 'Points fragiles', min: 25, src: 'm' },
  { j: 2, nom: 'Exercices mélangés', min: 50, src: 'r' },
  { j: 1, nom: 'Dernier rappel', min: 25, src: 'm' },
];
const RE_ACTIF = /refai|sans (le |regarder|corrig|ordinateur|aide|tes notes)|de mémoire|feuille blanche|chrono|écris|entraîne|teste|dessine|déroule|explique|récite|interroge/i;
const ancre = (c) => c.t0 || c.t;
const faitsPlan = () => lire(K('plan'), {}) || {};

function taches(c) {
  const m = moduleContenu(c.module);
  const maitriser = (m?.a_maitriser || []).map((x) => majuscule(String(x).replace(/^savoir\s+/i, '').trim()));
  const reviser = (m?.comment_reviser || []).filter((x) => RE_ACTIF.test(x));
  const secours = (E.methodes?.principes || []).find((p) => p.id === 'rappel-actif')?.comment || ['Refais les exercices de TD sans le corrigé.'];
  const dec = parseInt(empreinte(c.id || c.titre), 36) || 0;
  const piocher = (l, i) => (l.length ? l[(dec + i) % l.length] : secours[(dec + i) % secours.length]);
  return ETAPES.map((e, i) => (e.src === 'r' && reviser.length ? piocher(reviser, i) : piocher(maitriser.length ? maitriser : reviser, i)));
}

// Créneau proposé : après le dernier cours du jour (au plus tôt 17:30), 10:00 le week-end.
function creneau(cle) {
  const js = jourSemaine(cle);
  if (js === 0 || js === 6) return [10, 0];
  const fin = seancesDuJour(cle).filter((s) => !s.annule).reduce((a, s) => Math.max(a, s.t1), 0);
  let min = 17 * 60 + 30;
  if (fin) { const p = parts(fin); min = Math.max(min, p.h * 60 + p.mi + 30); }
  min = Math.min(Math.ceil(min / 15) * 15, 21 * 60);
  return [Math.floor(min / 60), min % 60];
}

function plan() {
  const auj = cleJour(maintenant());
  return controles().filter((c) => !c.fait).sort((a, b) => ancre(a) - ancre(b)).map((c) => {
    const jourC = cleJour(ancre(c));
    const t = taches(c);
    const seances = ETAPES.map((e, i) => {
      const cle = ajouterJours(jourC, -e.j);
      const [h, mi] = creneau(cle);
      const t0 = depuisCle(cle, h, mi).getTime();
      return { id: `${c.id}|J-${e.j}`, cle, t0, t1: t0 + e.min * MIN, etape: e, tache: t[i], c };
    }).filter((x) => x.cle >= auj && x.cle < jourC);
    return { c, seances };
  });
}

function dateControle(c) {
  const a = ancre(c);
  if (c.semaine) return `semaine du ${dateMoyenne(a)}`;
  if (c.heure_inconnue) return `${dateMoyenne(a)} · heure à confirmer`;
  return `${majuscule(jourRelatif(a, maintenant()))} · ${heure(a)}`;
}
function jourSeance(cle, auj) {
  const n = ecartJours(auj, cle);
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Demain';
  const d = depuisCle(cle, 12);
  return `${majuscule(jourCourt(d))} ${numeroJour(d)}`;
}

function planCarte() {
  const groupes = plan();
  const faits = faitsPlan();
  const auj = cleJour(maintenant());
  const aVenir = groupes.flatMap((g) => g.seances).filter((x) => x.t1 > maintenant());
  const corps = groupes.length ? groupes.map((g, i) => {
    const { c, seances } = g;
    const n = seances.filter((x) => faits[x.id]).length;
    const proche = seances.some((x) => ecartJours(auj, x.cle) <= 3);
    return html`<details class="rv-groupe" style="${styleModule(c.module)}" ${i < 2 || proche ? 'open' : ''}>
      <summary>
        <div class="grow">
          <div class="rv-g-titre"><span class="module-tag">${info(c.module).court}</span> ${c.titre}</div>
          <div class="rv-g-sous">${dateControle(c)} · <span class="chiffres" data-compte="${ancre(c)}"></span>${c.statut === 'a_confirmer' ? ' · à confirmer' : ''}</div>
        </div>
        ${seances.length ? html`<span class="rv-g-compte chiffres" data-rv-compte>${n}/${seances.length}</span>` : ''}
        ${ic('droite', 'rv-chevron')}
      </summary>
      ${seances.length ? html`<ul class="rv-seances">${seances.map((x) => {
        const fait = !!faits[x.id];
        return html`<li class="${fait ? 'fait' : ''} ${x.cle === auj ? 'rv-auj' : ''}">
          <button class="rv-case" type="button" data-rv="case" data-arg="${x.id}" aria-pressed="${fait}" aria-label="Séance « ${x.etape.nom} » faite">${ic('coche')}</button>
          <div class="rv-quand"><b>${jourSeance(x.cle, auj)}</b><span class="chiffres">${heure(x.t0)} · J-${x.etape.j}</span></div>
          <div class="rv-tache-bloc">
            <div class="rv-tache-nom">${x.etape.nom}<span class="chiffres">${x.etape.min} min</span></div>
            <p class="rv-tache" data-rv="deplier">${x.tache}</p>
          </div>
        </li>`;
      })}</ul>` : html`<p class="rv-g-vide">${ecartJours(auj, cleJour(ancre(c))) <= 0 ? 'C’est aujourd’hui : lis tout le sujet et commence par ce que tu sais faire.' : 'Plus de séance possible avant : fais un dernier rappel actif ce soir.'}</p>`}
    </details>`;
  }) : html`<p class="vide">Aucun contrôle annoncé.</p>`;
  return html`<section class="rv-plan verre carte">
    <div class="carte-tete" style="--c-icone: var(--rouge)">${ic('cible')}Plan de révision<span class="espace"></span>${aVenir.length ? html`<button class="lien rv-ics" type="button" data-rv="ics">${ic('telecharger')}Ajouter à mon agenda</button>` : ''}</div>
    ${corps}
  </section>`;
}

// ---------- Export .ics (dates en UTC) ----------
const dateICS = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const echapICS = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function plier(ligne) {
  const enc = new TextEncoder();
  let res = '', cur = '', n = 0;
  for (const ch of ligne) {
    const b = enc.encode(ch).length;
    if (n + b > 74) { res += `${cur}\r\n `; cur = ''; n = 1; }
    cur += ch; n += b;
  }
  return res + cur;
}
function ics(seances) {
  const tampon = dateICS(Date.now());
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BUT Info//Reviser//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Révisions BUT Info'];
  for (const x of seances) {
    l.push('BEGIN:VEVENT',
      `UID:${x.id.replace(/[^A-Za-z0-9-]/g, '-')}@but-info`,
      `DTSTAMP:${tampon}`,
      `DTSTART:${dateICS(x.t0)}`,
      `DTEND:${dateICS(x.t1)}`,
      `SUMMARY:${echapICS(`Révision ${info(x.c.module).court} · ${x.etape.nom}`)}`,
      `DESCRIPTION:${echapICS(`${x.tache}\n\nPour : ${x.c.titre} (${dateControle(x.c)}).`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${echapICS(`Révision ${info(x.c.module).court}`)}`, 'TRIGGER:-PT10M', 'END:VALARM',
      'END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.map(plier).join('\r\n') + '\r\n';
}
function telechargerICS() {
  const seances = plan().flatMap((g) => g.seances).filter((x) => x.t1 > maintenant());
  if (!seances.length) return;
  const url = URL.createObjectURL(new Blob([ics(seances)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'revisions-but-info.ics';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  ile(`${seances.length} séance${seances.length > 1 ? 's' : ''} prête${seances.length > 1 ? 's' : ''} pour ton agenda`, { icone: 'calendrier', couleur: 'var(--accent)' });
}

// ==========================================================================
// Routine, méthodes, pièges, outils
// ==========================================================================
const ROUTINE = [['chaque_jour', 'Chaque jour'], ['chaque_semaine', 'Chaque semaine'], ['j_moins_7', 'J-7'], ['veille', 'Veille'], ['jour_j', 'Jour J']];
let routineChoisie = null;
function contexteRoutine() {
  const auj = cleJour(maintenant());
  const p = controles().filter((c) => !c.fait).map((c) => ({ c, n: ecartJours(auj, cleJour(ancre(c))) })).filter((x) => x.n >= 0).sort((a, b) => a.n - b.n)[0];
  if (p && p.n === 0) return ['jour_j', p];
  if (p && p.n === 1) return ['veille', p];
  if (p && p.n <= 7) return ['j_moins_7', p];
  if (jourSemaine(auj) === 0) return ['chaque_semaine', null];
  return ['chaque_jour', null];
}
function itemRoutine(t) {
  const m = String(t).match(/\s*\(((?:\d+\s*(?:à|-)\s*)?\d+\s*min)\)/);
  const texte = m ? String(t).replace(m[0], '') : String(t);
  return html`<li><span class="rv-r-texte">${texte}</span>${m ? html`<span class="puce chiffres">${m[1]}</span>` : ''}</li>`;
}
function listeRoutine(cle, ctx) {
  const r = E.methodes?.routine || {};
  const [cleCtx, p] = ctx;
  const note = cle === cleCtx && p ? html`<div class="rv-r-ctx" style="${styleModule(p.c.module)}"><span class="module-tag">${info(p.c.module).court}</span>${p.c.titre} · ${p.n === 0 ? 'aujourd’hui' : p.n === 1 ? 'demain' : `dans ${p.n} jours`}</div>` : '';
  return html`${note}<ol class="rv-r-liste">${(r[cle] || []).map(itemRoutine)}</ol>`;
}
function routine() {
  const r = E.methodes?.routine;
  if (!r) return '';
  const ctx = contexteRoutine();
  const choisie = routineChoisie || ctx[0];
  return html`<section class="rv-routine verre carte">
    <div class="carte-tete" style="--c-icone: var(--indigo)">${ic('horloge')}Routine</div>
    <div class="rv-frise" role="tablist" aria-label="Moments de la routine">
      ${ROUTINE.map(([k, nom]) => html`<button class="rv-noeud ${k === ctx[0] ? 'ici' : ''}" type="button" role="tab" data-rv="routine" data-arg="${k}" aria-selected="${k === choisie}"><i></i><span>${nom}</span></button>`)}
    </div>
    <div class="rv-r-corps" data-rv-routine>${listeRoutine(choisie, ctx)}</div>
  </section>`;
}

const rangEff = (p) => (p.efficacite === 'élevée' ? 0 : p.efficacite === 'modérée' ? 1 : 2);
const decouper = (t) => { const i = String(t).indexOf(' : '); return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t, '']; };
const puceEff = (e) => html`<span class="puce ${e === 'élevée' ? 'c-vert' : 'c-jaune'}">${majuscule(e || '')}</span>`;
function methodes() {
  const l = [...(E.methodes?.principes || [])].sort((a, b) => rangEff(a) - rangEff(b));
  if (!l.length) return '';
  return html`<section class="rv-methodes verre carte">
    <div class="carte-tete" style="--c-icone: var(--violet)">${ic('lampe')}Méthodes qui marchent<span class="espace"></span><span class="rv-note">efficacité mesurée</span></div>
    <ul class="liste rv-lignes">${l.map((p) => html`<li><button class="rv-ligne" type="button" data-rv="principe" data-arg="${p.id}">
      <span class="icone-carree" style="--c: var(--violet)">${ic(p.icone)}</span>
      <span class="grow"><span class="titre">${decouper(p.titre)[0]}</span><span class="sous">${p.accroche}</span></span>
      ${puceEff(p.efficacite)}${ic('droite', 'rv-chevron')}</button></li>`)}</ul>
  </section>`;
}
function eviter() {
  const l = E.methodes?.a_eviter || [];
  if (!l.length) return '';
  return html`<section class="rv-eviter verre carte">
    <div class="carte-tete" style="--c-icone: var(--rouge)">${ic('alerte')}À éviter</div>
    <ul class="liste rv-lignes">${l.map((a, i) => html`<li><button class="rv-ligne" type="button" data-rv="eviter" data-arg="${i}">
      <span class="rv-interdit">${ic('fermer')}</span>
      <span class="grow"><span class="titre">${a.titre}</span><span class="sous"><b>À la place</b> ${premierePhrase(a.a_la_place)}</span></span>
      ${ic('droite', 'rv-chevron')}</button></li>`)}</ul>
  </section>`;
}
const premierePhrase = (t) => { const s = String(t || ''); const i = s.search(/[.!?](\s|$)/); return i > 0 ? s.slice(0, i + 1) : s; };

const codesOutil = (m) => (!m || m === 'tous' ? [] : String(m).split('/').map((x) => x.trim()).filter(Boolean));
const styleCode = (c) => (c === 'SAÉ' ? '--m: var(--sae); --m-encre: var(--sae-encre)' : styleModule(c));
const nomCode = (c) => (c === 'SAÉ' ? 'SAÉ' : info(c).court);
function outils() {
  const l = E.methodes?.outils || [];
  if (!l.length) return '';
  const codes = [...new Set(l.flatMap((o) => codesOutil(o.module)))];
  // Par défaut : les outils du module du prochain contrôle.
  let filtre = lire(K('outils'), null) ?? prochainControle()?.module ?? 'tous';
  if (!codes.includes(filtre)) filtre = 'tous';
  const visibles = filtre === 'tous' ? l : l.filter((o) => codesOutil(o.module).includes(filtre));
  return html`<section class="rv-outils verre carte">
    <div class="carte-tete" style="--c-icone: var(--cyan)">${ic('puzzle')}Outils<span class="espace"></span><span class="rv-note chiffres">${visibles.length}</span></div>
    <div class="rv-puces rv-puces-outils" role="group" aria-label="Filtrer par module">
      <button class="rv-puce sans-point" type="button" data-rv="outils" data-arg="tous" aria-pressed="${filtre === 'tous'}">Tous</button>
      ${codes.map((c) => html`<button class="rv-puce" type="button" data-rv="outils" data-arg="${c}" style="${styleCode(c)}" aria-pressed="${filtre === c}">${nomCode(c)}</button>`)}
    </div>
    <ul class="liste rv-lignes rv-liste-outils">${visibles.map((o) => {
      const u = urlSure(o.url);
      const cs = codesOutil(o.module);
      const corps = html`<span class="rv-mono" style="${cs.length ? styleCode(cs[0]) : '--m: var(--gris); --m-encre: var(--encre-2)'}">${String(o.nom).trim()[0] || '·'}</span>
        <span class="grow"><span class="titre">${o.nom}${u ? html` <span class="rv-dom">${domaine(u)}</span>` : ''}</span><span class="sous">${o.usage}</span></span>
        ${u ? ic('externe', 'rv-chevron') : ''}`;
      return html`<li>${u ? html`<a class="rv-ligne" href="${u}" target="_blank" rel="noopener">${corps}</a>` : html`<div class="rv-ligne">${corps}</div>`}</li>`;
    })}</ul>
  </section>`;
}

// ---------- Feuilles de détail ----------
function sources(l) {
  const ok = (l || []).filter((s) => s?.titre);
  if (!ok.length) return '';
  return html`<h3 class="rv-f-h">Sources</h3><ul class="rv-sources">${ok.map((s) => {
    const u = urlSure(s.url);
    return html`<li>${u ? html`<a href="${u}" target="_blank" rel="noopener"><span>${s.titre}</span><small>${domaine(u)}${ic('externe')}</small></a>` : html`<span>${s.titre}</span>`}</li>`;
  })}</ul>`;
}
function enBut(t) {
  const morceaux = String(t || '').split(/(?<=[.!?])\s+(?=(?:R1\.(?:\d{2}|AL)|SAÉ\s?1\.\d{2})\b)/).filter(Boolean);
  return html`<ul class="rv-enbut">${morceaux.map((m) => {
    const x = m.match(/^(R1\.(?:\d{2}|AL)|SAÉ\s?1\.\d{2})\s*(\([^)]*\))?\s*:\s*/);
    if (!x) return html`<li><p>${m}</p></li>`;
    const code = x[1].replace(/^SAÉ\s?/, 'SAÉ ');
    return html`<li><span class="module-tag" style="${styleModule(code)}">${info(code).court}${x[2] ? ` ${x[2]}` : ''}</span><p>${majuscule(m.slice(x[0].length))}</p></li>`;
  })}</ul>`;
}
function feuillePrincipe(p) {
  const [nom, sous] = decouper(p.titre);
  ouvrirFeuille(html`<div class="rv-feuille">
    <div class="rv-f-tete"><span class="icone-carree" style="--c: var(--violet)">${ic(p.icone)}</span>
      <div><h2>${nom}</h2>${sous ? html`<p class="rv-f-sous">${majuscule(sous)}</p>` : ''}</div></div>
    <div class="rv-f-eff">${puceEff(p.efficacite)}<span>${p.efficacite_note || ''}</span></div>
    <h3 class="rv-f-h">Comment faire</h3>
    <ol class="rv-etapes">${(p.comment || []).map((c) => html`<li>${c}</li>`)}</ol>
    ${p.en_but_info ? html`<h3 class="rv-f-h">En BUT info</h3>${enBut(p.en_but_info)}` : ''}
    ${p.pourquoi ? html`<h3 class="rv-f-h">Pourquoi ça marche</h3><p class="rv-f-texte">${p.pourquoi}</p>` : ''}
    ${sources(p.sources)}
  </div>`, { titre: nom });
}
function feuilleEviter(a) {
  ouvrirFeuille(html`<div class="rv-feuille">
    <div class="rv-f-tete"><span class="rv-interdit grand">${ic('fermer')}</span><div><h2>${a.titre}</h2></div></div>
    <h3 class="rv-f-h">À la place</h3>
    <p class="rv-f-alaplace">${a.a_la_place}</p>
    <h3 class="rv-f-h">Pourquoi</h3>
    <p class="rv-f-texte">${a.pourquoi}</p>
    ${sources(a.sources)}
  </div>`, { titre: a.titre });
}

// ==========================================================================
// Vue
// ==========================================================================
function prochainControle() {
  return controles().filter((c) => !c.fait && ancre(c) > maintenant() - 2 * 3600_000).sort((a, b) => ancre(a) - ancre(b))[0] || null;
}

export default {
  id: 'reviser',
  titre: 'Réviser',
  surtitre: () => {
    const c = prochainControle();
    return c ? `${info(c.module).court} · contrôle ${jourRelatif(ancre(c), maintenant())}` : `${journal().filter((x) => cleJour(x.t) === cleJour(maintenant())).length} pomodoro(s) aujourd’hui`;
  },
  rendre: () => html`<div class="rv-grille">
    <div class="rv-col">${minuteur()}${stats()}${methodes()}${eviter()}</div>
    <div class="rv-col">${planCarte()}${routine()}${outils()}</div>
  </div>`,
  monter(racine) {
    racineMontee = racine;
    terminer();
    const clic = (e) => {
      const b = e.target.closest('[data-rv]');
      if (!b || !racine.contains(b)) return;
      const arg = b.dataset.arg;
      switch (b.dataset.rv) {
        case 'basculer': basculer(); majMinuteur(racine); break;
        case 'reinit': reinitialiser(); majMinuteur(racine); break;
        case 'passer': passer(); majMinuteur(racine); break;
        case 'formule': {
          const s = lireEtat();
          if (s.fin) return;
          s.preset = +arg || 0; s.reste = null;
          sauver(); vibrer(6); majMinuteur(racine);
          break;
        }
        case 'module': lireEtat().module = arg || null; sauver(); vibrer(6); majMinuteur(racine); break;
        case 'case': {
          e.preventDefault();
          const f = faitsPlan();
          if (f[arg]) delete f[arg]; else f[arg] = Date.now();
          ecrire(K('plan'), f);
          const oui = !!f[arg];
          b.setAttribute('aria-pressed', String(oui));
          b.closest('li')?.classList.toggle('fait', oui);
          if (oui) vibrer(10);
          const g = b.closest('.rv-groupe');
          const compte = g?.querySelector('[data-rv-compte]');
          if (compte) compte.textContent = `${g.querySelectorAll('.rv-case[aria-pressed="true"]').length}/${g.querySelectorAll('.rv-case').length}`;
          break;
        }
        case 'deplier': b.classList.toggle('deplie'); break;
        case 'ics': telechargerICS(); break;
        case 'principe': { const p = (E.methodes?.principes || []).find((x) => x.id === arg); if (p) feuillePrincipe(p); break; }
        case 'eviter': { const a = (E.methodes?.a_eviter || [])[+arg]; if (a) feuilleEviter(a); break; }
        case 'routine': {
          routineChoisie = arg;
          const sec = b.closest('.rv-routine');
          sec.querySelectorAll('.rv-noeud').forEach((n) => n.setAttribute('aria-selected', String(n === b)));
          sec.querySelector('[data-rv-routine]').innerHTML = String(listeRoutine(arg, contexteRoutine()));
          break;
        }
        case 'outils': {
          ecrire(K('outils'), arg);
          const sec = b.closest('.rv-outils');
          if (sec) sec.outerHTML = String(outils());
          break;
        }
        default: break;
      }
    };
    const touche = (e) => {
      if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, button, a, summary, [contenteditable]')) return;
      e.preventDefault();
      basculer(); majMinuteur(racine);
    };
    racine.addEventListener('click', clic);
    document.addEventListener('keydown', touche);
    majMinuteur(racine);
    return () => {
      racine.removeEventListener('click', clic);
      document.removeEventListener('keydown', touche);
      if (racineMontee === racine) racineMontee = null;
      document.title = TITRE_ONGLET;
    };
  },
  tic(racine) {
    const s = lireEtat();
    if (s.fin && s.fin <= Date.now()) { terminer(); return; }
    majMinuteur(racine);
  },
};
