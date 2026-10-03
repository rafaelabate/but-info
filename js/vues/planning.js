// Planning : grille de la semaine, bande + frise du jour, agenda des 14 prochains jours.
import { html } from '../html.js';
import { ic, ouvrirFeuille, fermerFeuille, vibrer } from '../ui.js';
import { E, maintenant, seancesEntre, seancesDuJour, aujourdhui } from '../donnees.js';
import {
  TZ, MIN, HEURE, pad, cleJour, depuisCle, ajouterJours, lundi, jourSemaine, minutesDuJour, ecartJours,
  numeroSemaine, heure, dateLongue, dateMoyenne, jourCourt, numeroJour, majuscule, relatif, echeanceLisible,
} from '../temps.js';
import { MODULES, info, styleModule, titreSeance, precisionSeance, LIBELLE_TYPE, nomProf } from '../cours.js';
import { lire, ecrire } from '../stockage.js';

const MODES = ['jour', 'semaine', 'liste'];
const NOMS = { jour: 'Jour', semaine: 'Semaine', liste: 'Liste' };
const PAS = { jour: 1, semaine: 7, liste: 14 };
const FLECHES = {
  jour: ['Jour précédent', 'Jour suivant'],
  semaine: ['Semaine précédente', 'Semaine suivante'],
  liste: ['Quinze jours plus tôt', 'Quinze jours plus tard'],
};
const MEMOIRE = 'planning.mode';
const LETTRES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const ROUGE = '--m: var(--rouge); --m-encre: var(--rouge-encre)';
const fCourt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' });

// Navigation interne : hash visé, sens du glissement, mode quitté (segment animé), focus à rendre.
const nav = { hash: null, sens: 0, avant: null, focus: null, semaine: null };

// ---------- Petits outils ----------
const midi = (k) => depuisCle(k, 12);
const debutJour = (k) => depuisCle(k).getTime();
const court = (k) => fCourt.format(midi(k));
const estCle = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && ajouterJours(k, 0) === k;
const plage = (a, b) => (a.slice(0, 7) === b.slice(0, 7) ? `${+a.slice(8)} – ${court(b)}` : `${court(a)} – ${court(b)}`);
const salle = (s) => (s.salles || []).join(', ') || s.lieu || '';
const libType = (s) => (s.type ? LIBELLE_TYPE[s.type] || s.type : '');
const weekend = (k) => jourSemaine(k) % 6 === 0;
const calendrier = () => E.but?.calendrier || [];
const conge = (k) => calendrier().find((c) => c.type === 'vacances' && c.debut <= k && k <= c.fin);
const nb = (n, un, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;
function heures(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${pad(m % 60)}` : `${m / 60} h`;
}
const coef = (c) => `coef ${String(c).replace('.', ',')}`;

function lireMode(params) {
  if (MODES.includes(params?.[1])) return params[1];
  const m = lire(MEMOIRE, null);
  if (MODES.includes(m)) return m;
  return matchMedia('(min-width: 760px)').matches ? 'semaine' : 'jour';
}
function lireCle(params, mode) {
  if (estCle(params?.[0])) return params[0];
  const k = aujourdhui();
  // Le week-end, la semaine « courante » est celle qui arrive (sauf cours encore prévus ce week-end).
  if (mode === 'semaine' && weekend(k)) {
    const suivant = lundi(ajouterJours(k, 2));
    if (!seancesEntre(maintenant(), debutJour(suivant)).length) return suivant;
  }
  return k;
}
const debutPeriode = (k, m) => (m === 'semaine' ? lundi(k) : k);
function joursVisibles(k) {
  const l = lundi(k);
  const n = seancesDuJour(ajouterJours(l, 6)).length ? 7 : seancesDuJour(ajouterJours(l, 5)).length ? 6 : 5;
  return Array.from({ length: n }, (_, i) => ajouterJours(l, i));
}

// ---------- Échéances ----------
// Un contrôle du relevé qui tombe sur une séance « évaluation » d'ADE : on les fusionne.
function echeanceDeSeance(s) {
  if (s.type !== 'eval' && s.type !== 'soutenance') return null;
  return E.echeances.find((e) => e.type === 'eval' && !e.semaine && e.module && e.module === s.module && e.t
    && (e.t0 ?? e.t) < s.t1 + 2 * HEURE && e.t > s.t0 - 2 * HEURE) || null;
}
function idsLies(seances) {
  const ids = new Set();
  for (const s of seances) { const e = echeanceDeSeance(s); if (e) ids.add(e.id); }
  return ids;
}
function echeancesDuJour(k, lies) {
  const a = debutJour(k), b = debutJour(ajouterJours(k, 1));
  return E.echeances.filter((e) => e.t && e.t >= a && e.t < b && !e.semaine && !lies.has(e.id));
}
// Contrôles annoncés « dans la semaine », sans date précise.
function evalsSemaine(k0, k1) {
  const a = debutJour(k0), b = debutJour(ajouterJours(k1, 1));
  return E.echeances.filter((e) => e.semaine && e.t && (e.t0 ?? e.t) < b && e.t >= a);
}
const styleEch = (e) => (e.type === 'eval' ? ROUGE : styleModule(e.module));
// Un rendu se lit à son heure limite ; un contrôle ou un événement à son heure de début.
const instantEch = (e) => (e.type === 'devoir' ? e.t : (e.t0 ?? e.t));
const quandEch = (e) => (e.heure_inconnue ? '' : heure(instantEch(e)));
function libelleEch(e) {
  if (e.type === 'eval') return 'Contrôle';
  if (e.type === 'devoir') return e.fait ? 'Rendu' : 'À rendre';
  return 'Échéance';
}

// ---------- Statistiques de la période ----------
function statistiques(seances, mode) {
  const actives = seances.filter((s) => !s.annule);
  const ctrl = actives.filter((s) => s.type === 'eval').length;
  const rouge = ctrl ? html`<span class="pl-rouge"><b>${ctrl}</b> ${ctrl > 1 ? 'contrôles' : 'contrôle'}</span>` : '';
  if (!actives.length) return html`<span>Pas de cours</span>`;
  if (mode === 'jour') {
    const fin = Math.max(...actives.map((s) => s.t1));
    return html`<span><b>${heure(actives[0].t0)}</b> – <b>${heure(fin)}</b></span><span><b>${actives.length}</b> cours</span>${rouge}`;
  }
  const ms = actives.reduce((a, s) => a + (s.t1 - s.t0), 0);
  return html`<span><b>${actives.length}</b> cours</span><span><b>${heures(ms)}</b>${mode === 'liste' ? ' sur 14 jours' : ''}</span>${rouge}`;
}

// ---------- Barre d'outils ----------
function barre(mode, stats, calme) {
  const i = MODES.indexOf(mode);
  const avant = MODES.indexOf(nav.avant && nav.avant !== mode ? nav.avant : mode);
  return html`<div class="pl-barre ${calme ? 'pl-calme' : ''}">
    <div class="pl-nav verre">
      <button type="button" class="pl-fl" data-nav="-1" aria-label="${FLECHES[mode][0]}">${ic('gauche')}</button>
      <button type="button" class="pl-auj-btn" data-nav="0">Aujourd’hui</button>
      <button type="button" class="pl-fl" data-nav="1" aria-label="${FLECHES[mode][1]}">${ic('droite')}</button>
    </div>
    <div class="pl-stats chiffres">${stats}</div>
    <div class="segment pl-modes" role="group" aria-label="Affichage" style="--n:3; --i:${avant}" data-i="${i}">${MODES.map((m) => html`<button type="button" data-mode="${m}" aria-pressed="${m === mode ? 'true' : 'false'}">${NOMS[m]}</button>`)}</div>
  </div>`;
}

// ---------- Grille horaire (semaine et jour) ----------
function bornes(parJour) {
  let h0 = 8, h1 = 18;
  for (const { k, seances } of parJour) {
    const d = debutJour(k);
    for (const s of seances) {
      h0 = Math.min(h0, Math.floor(Math.max(0, (s.t0 - d) / HEURE)));
      h1 = Math.max(h1, Math.ceil(Math.min(24, (s.t1 - d) / HEURE)));
    }
  }
  return [h0, h1];
}
// Chevauchements : groupes de séances qui se touchent, puis voies côte à côte
// (les séances maintenues d'abord, les annulées sur la droite).
function voies(seances) {
  const items = seances.map((s) => ({ s, a: s.t0, b: Math.max(s.t1, s.t0 + 15 * MIN) }))
    .sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  const groupes = [];
  let g = null, fin = -Infinity;
  for (const it of items) {
    if (!g || it.a >= fin) { g = []; groupes.push(g); fin = -Infinity; }
    g.push(it);
    fin = Math.max(fin, it.b);
  }
  for (const groupe of groupes) {
    const places = [];
    for (const it of [...groupe.filter((x) => !x.s.annule), ...groupe.filter((x) => x.s.annule)]) {
      let v = 0;
      while (places.some((p) => p.voie === v && p.a < it.b && it.a < p.b)) v++;
      it.voie = v;
      places.push(it);
    }
    const n = Math.max(...groupe.map((x) => x.voie)) + 1;
    for (const x of groupe) x.n = n;
  }
  return items;
}

function bloc(s, p, { t, jour }) {
  const passe = s.t1 <= t, enCours = s.t0 <= t && t < s.t1;
  const min = (s.t1 - s.t0) / MIN;
  const ev = s.type === 'eval';
  const e = ev ? echeanceDeSeance(s) : null;
  const precision = e?.titre || precisionSeance(s);
  const type = libType(s);
  const lieu = salle(s);
  const cls = ['pl-bloc', passe && 'pl-passe', enCours && 'pl-encours', s.annule && 'pl-annule', ev && 'pl-eval', min < 50 && 'pl-court'].filter(Boolean).join(' ');
  const etiquette = [ev ? 'Contrôle' : '', titreSeance(s), precision, ev ? '' : type, `${heure(s.t0)} – ${heure(s.t1)}`, lieu, s.annule ? 'annulé' : ''].filter(Boolean).join(', ');
  const profs = s.profs?.length ? s.profs.map(nomProf).join(', ') : '';
  return html`<button type="button" class="${cls}" data-seance="${s.id}" aria-label="${etiquette}" style="${styleModule(s.module)}; --y:${p.y.toFixed(5)}; --l:${p.l.toFixed(5)}; --v:${p.v}; --n:${p.n}" ${enCours ? html`data-progres="${s.t0},${s.t1}"` : ''}>
    ${ev ? html`<span class="pl-b-ctrl">Contrôle</span>` : ''}
    <span class="pl-b-nom">${titreSeance(s)}${jour && precision ? html`<em> · ${precision}</em>` : ''}${jour && type && !ev ? html` <i class="pl-b-type">${type}</i>` : ''}</span>
    ${jour
      ? html`<span class="pl-b-meta"><span class="chiffres">${heure(s.t0)} – ${heure(s.t1)}</span>${lieu ? html`<span class="pl-b-lieu">${lieu}</span>` : ''}${profs ? html`<span class="pl-b-prof">${profs}</span>` : ''}</span>`
      : html`<span class="pl-b-meta">${type && !ev ? html`<i class="pl-b-type">${type}</i>` : ''}${lieu ? html`<span class="pl-b-lieu">${lieu}</span>` : ''}</span>
    <span class="pl-b-heure chiffres">${heure(s.t0)} – ${heure(s.t1)}</span>`}
    ${s.annule ? html`<span class="pl-b-annule">Annulé</span>` : ''}
  </button>`;
}

function grille(jours, { jour = false } = {}) {
  const t = maintenant(), auj = aujourdhui();
  const parJour = jours.map((k) => ({ k, seances: seancesDuJour(k) }));
  const [h0, h1] = bornes(parJour);
  const total = (h1 - h0) * 60;
  const mn = minutesDuJour(t);
  const ny = (mn - h0 * 60) / total;
  const avecMaintenant = jours.includes(auj) && ny >= 0 && ny <= 1;
  const graduations = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  return html`<div class="pl-rangee pl-corps ${avecMaintenant ? '' : 'pl-sans-maintenant'}" style="--h:${h1 - h0}; --ny:${ny.toFixed(5)}" data-h0="${h0}" data-h1="${h1}">
    <div class="pl-axe" aria-hidden="true">${graduations.map((h) => html`<span class="pl-h chiffres ${avecMaintenant && Math.abs(h * 60 - mn) < 14 ? 'pl-cache' : ''}" data-m="${h * 60}" style="--hy:${((h - h0) / (h1 - h0)).toFixed(5)}">${pad(h)}:00</span>`)}<span class="pl-nh chiffres">${heure(t)}</span></div>
    ${parJour.map(({ k, seances }) => {
      const d = debutJour(k);
      return html`<div class="pl-col ${k === auj ? 'pl-auj' : ''} ${conge(k) ? 'pl-conge' : ''} ${weekend(k) ? 'pl-we' : ''}" data-cle="${k}">
        ${voies(seances).map((it) => bloc(it.s, { y: ((it.a - d) / MIN - h0 * 60) / total, l: (it.b - it.a) / MIN / total, v: it.voie, n: it.n }, { t, jour }))}
        ${k === auj ? html`<div class="pl-maintenant" aria-hidden="true"></div>` : ''}
      </div>`;
    })}
    <div class="pl-trace" aria-hidden="true"></div>
  </div>`;
}

// Bandeaux « journée entière » : vacances, jours fériés, dates du département, contrôles de la semaine.
function bandeaux(jours) {
  const k0 = jours[0], k1 = jours.at(-1);
  const res = [];
  calendrier().forEach((c, i) => {
    if (c.fin < k0 || c.debut > k1) return;
    const a = jours.findIndex((k) => k >= c.debut), b = jours.findLastIndex((k) => k <= c.fin);
    if (a < 0 || b < a) return;
    const ferie = c.sous_type === 'ferie';
    const classe = c.type === 'vacances' ? 'pl-tj-vac' : ferie ? 'pl-tj-ferie' : 'pl-tj-autre';
    res.push(html`<button type="button" class="pl-tj ${classe}" style="--c0:${a + 1}; --c1:${b + 2}" data-cal="${i}">${ic(c.type === 'vacances' ? 'soleil' : ferie ? 'drapeau' : 'info')}<span>${c.libelle}</span></button>`);
  });
  for (const e of evalsSemaine(k0, k1)) {
    const d0 = cleJour(e.t0 ?? e.t), d1 = cleJour(e.t);
    const a = Math.max(0, jours.findIndex((k) => k >= d0)), b = jours.findLastIndex((k) => k <= d1);
    if (b < a) continue;
    res.push(html`<button type="button" class="pl-tj pl-tj-eval" style="--c0:${a + 1}; --c1:${b + 2}" data-ech="${e.id}">${ic('cible')}<span><b>Contrôle dans la semaine</b> · ${info(e.module).court} · ${e.titre}${e.statut === 'a_confirmer' ? ' · date à confirmer' : ''}</span></button>`);
  }
  return res;
}

function marque(e) {
  const q = quandEch(e);
  return html`<button type="button" class="pl-marque ${e.fait ? 'pl-m-fait' : ''}" style="${styleEch(e)}" data-ech="${e.id}" title="${e.titre}" aria-label="${libelleEch(e)} : ${e.titre}${q ? `, ${q}` : ''}"><i></i><span>${q ? html`<b class="chiffres">${q}</b> ` : ''}${e.titre}</span></button>`;
}

// État vide : vacances, horizon d'ADE dépassé, ou simplement pas de cours.
function repos(k0, k1, { jour = false } = {}) {
  const fin = debutJour(ajouterJours(k1, 1));
  const suivante = E.seances.find((s) => !s.annule && s.t0 >= fin);
  const derniere = E.seances.at(-1);
  const vac = calendrier().find((c) => c.type === 'vacances' && c.debut <= k1 && c.fin >= k0);
  const auDela = !!derniere && debutJour(k0) > derniere.t1;
  const titre = vac ? vac.libelle : auDela ? 'Rien de publié sur ADE pour l’instant' : jour ? (weekend(k0) ? 'Week-end' : 'Pas de cours') : 'Aucun cours cette semaine';
  const sous = vac?.reprise ? `Reprise ${dateLongue(midi(vac.reprise))}` : auDela ? `L’emploi du temps s’arrête au ${dateLongue(derniere.t0)}.` : '';
  return html`<div class="pl-repos">
    <b>${titre}</b>${sous ? html`<span>${sous}</span>` : ''}
    ${suivante ? html`<button type="button" class="bouton verre petit" data-aller="${cleJour(suivante.t0)}"><span>Prochain cours · <span class="chiffres">${dateMoyenne(suivante.t0)} ${heure(suivante.t0)}</span></span>${ic('droite')}</button>` : ''}
  </div>`;
}

// ---------- Semaine ----------
function vueSemaine(cle, anim) {
  const jours = joursVisibles(cle);
  const auj = aujourdhui();
  const seances = jours.flatMap((k) => seancesDuJour(k));
  const lies = idsLies(seances);
  const barres = bandeaux(jours);
  return {
    stats: statistiques(seances, 'semaine'),
    corps: html`<section class="pl-carte pl-semaine verre ${anim}" style="--nj:${jours.length}" data-glisse="7">
      <div class="pl-rangee pl-tetes"><div class="pl-coin"></div>${jours.map((k) => {
        const ech = echeancesDuJour(k, lies);
        return html`<div class="pl-tete ${k === auj ? 'pl-auj' : ''}">
          <button type="button" class="pl-t-date" data-aller="${k}" data-vers="jour" aria-label="${majuscule(dateLongue(midi(k)))}, afficher la journée"><span class="pl-t-nom">${jourCourt(midi(k))}</span><b class="pl-t-num chiffres">${numeroJour(midi(k))}</b></button>
          ${ech.length ? html`<div class="pl-marques">${ech.map(marque)}</div>` : ''}
        </div>`;
      })}</div>
      ${barres.length ? html`<div class="pl-rangee pl-journee"><div class="pl-coin"></div><div class="pl-tj-zone">${barres}</div></div>` : ''}
      ${seances.length ? grille(jours) : repos(jours[0], jours.at(-1))}
    </section>`,
  };
}

// ---------- Jour ----------
function vueJour(cle, anim, animBande) {
  const l = lundi(cle), auj = aujourdhui();
  const semaine = Array.from({ length: 7 }, (_, i) => ajouterJours(l, i));
  const seances = seancesDuJour(cle);
  const lies = idsLies(seances);
  const ech = echeancesDuJour(cle, lies);
  const barres = bandeaux([cle]);
  const tout = [...barres, ...ech.map((e) => {
    const q = quandEch(e);
    return html`<button type="button" class="pl-tj pl-tj-ech ${e.fait ? 'pl-m-fait' : ''}" style="${styleEch(e)}; --c0:1; --c1:2" data-ech="${e.id}">${ic(e.type === 'eval' ? 'cible' : 'drapeau')}<span>${q ? html`<b class="chiffres">${q}</b> · ` : ''}${e.titre}<em> · ${info(e.module).court} · ${libelleEch(e)}</em></span></button>`;
  })];
  return {
    stats: statistiques(seances, 'jour'),
    corps: html`<nav class="pl-bande verre ${animBande}" aria-label="Jours de la semaine" data-glisse="7">
      <div class="pl-bande-jours">${semaine.map((k) => {
        const ss = seancesDuJour(k).filter((s) => !s.annule);
        return html`<button type="button" class="pl-bj ${k === auj ? 'pl-auj' : ''} ${weekend(k) ? 'pl-we' : ''}" data-aller="${k}" ${k === cle ? html`aria-current="date"` : ''} aria-label="${majuscule(dateLongue(midi(k)))}${ss.length ? `, ${ss.length} cours` : ''}">
          <span>${LETTRES[jourSemaine(k)]}</span><b class="chiffres">${numeroJour(midi(k))}</b>
          <i class="pl-points">${ss.slice(0, 6).map((s) => html`<i style="${s.type === 'eval' ? ROUGE : styleModule(s.module)}"></i>`)}</i>
        </button>`;
      })}</div>
    </nav>
    <section class="pl-carte pl-jourgrille verre ${anim}" style="--nj:1" data-glisse="1">
      ${tout.length ? html`<div class="pl-rangee pl-journee"><div class="pl-coin"></div><div class="pl-tj-zone">${tout}</div></div>` : ''}
      ${seances.length ? grille([cle], { jour: true }) : repos(cle, cle, { jour: true })}
    </section>`,
  };
}

// ---------- Liste (agenda) ----------
function ligneSeance(s, t, auj) {
  const passe = s.t1 <= t, enCours = s.t0 <= t && t < s.t1, ev = s.type === 'eval';
  const e = ev ? echeanceDeSeance(s) : null;
  const precision = e?.titre || precisionSeance(s);
  const sous = [salle(s), (s.profs || []).map(nomProf).join(', ')].filter(Boolean).join(' · ');
  const aVenir = cleJour(s.t0) === auj && !passe && !enCours && !s.annule;
  const etiquette = ev ? html`<span class="pl-a-ctrl">Contrôle</span>` : s.annule ? html`<span class="pl-a-type pl-a-gris">Annulé</span>` : s.type ? html`<span class="pl-a-type">${libType(s)}</span>` : '';
  return html`<li class="pl-a ${passe ? 'pl-passe' : ''} ${enCours ? 'pl-encours' : ''} ${ev ? 'pl-eval' : ''} ${s.annule ? 'pl-annule' : ''}" style="${styleModule(s.module)}" ${enCours ? html`data-progres="${s.t0},${s.t1}"` : ''}>
    <button type="button" class="pl-a-btn" data-seance="${s.id}">
      <span class="pl-a-h chiffres"><b>${heure(s.t0)}</b><span>${heure(s.t1)}</span></span>
      <span class="pl-a-barre"></span>
      <span class="pl-a-txt"><span class="pl-a-nom">${titreSeance(s)}${precision ? html`<em> · ${precision}</em>` : ''}</span>${sous ? html`<span class="pl-a-sous">${sous}</span>` : ''}</span>
      <span class="pl-a-fin">${etiquette}${enCours ? html`<span class="pl-a-live chiffres" data-reste></span>` : aVenir ? html`<span class="pl-a-live chiffres" data-compte="${s.t0}"></span>` : ''}</span>
    </button></li>`;
}
function ligneEcheance(e) {
  const q = quandEch(e);
  return html`<li class="pl-a pl-a-ech ${e.fait ? 'pl-fait' : ''} ${e.type === 'eval' ? 'pl-eval' : ''}" style="${styleEch(e)}">
    <button type="button" class="pl-a-btn" data-ech="${e.id}">
      <span class="pl-a-h chiffres"><b>${q || '–'}</b><span>${q ? 'limite' : ''}</span></span>
      <span class="pl-a-barre"></span>
      <span class="pl-a-txt"><span class="pl-a-nom">${e.titre}</span><span class="pl-a-sous">${info(e.module).court} · ${libelleEch(e)}${q ? '' : ' · heure à confirmer'}</span></span>
      <span class="pl-a-fin">${ic(e.type === 'eval' ? 'cible' : 'drapeau')}</span>
    </button></li>`;
}
function ligneBandeau(texte, sous, attr, classe, icone) {
  return html`<li class="pl-a pl-a-cal ${classe}"><button type="button" class="pl-a-btn" ${attr}>
    <span class="pl-a-h">${ic(icone)}</span><span class="pl-a-txt"><span class="pl-a-nom">${texte}</span>${sous ? html`<span class="pl-a-sous">${sous}</span>` : ''}</span></button></li>`;
}

function vueListe(cle, anim) {
  const t = maintenant(), auj = aujourdhui();
  const jours = Array.from({ length: 14 }, (_, i) => ajouterJours(cle, i));
  const toutes = [];
  const groupes = [];
  for (const k of jours) {
    const seances = seancesDuJour(k);
    toutes.push(...seances);
    const lies = idsLies(seances);
    const ech = echeancesDuJour(k, lies);
    const premier = k === jours[0];
    const cal = calendrier().map((c, i) => ({ c, i })).filter(({ c }) => c.debut === k || (premier && c.debut < k && c.fin >= k));
    const sem = evalsSemaine(k, k).filter((e) => cleJour(e.t0 ?? e.t) === k || (premier && (e.t0 ?? e.t) < debutJour(k)));
    if (!seances.length && !ech.length && !cal.length && !sem.length) continue;
    const lignes = [
      ...cal.map(({ c, i }) => ({ t: -2, h: ligneBandeau(c.libelle, c.fin > c.debut ? `Jusqu’au ${dateLongue(midi(c.fin))}` : '', html`data-cal="${i}"`, c.type === 'vacances' ? 'pl-a-vac' : '', c.type === 'vacances' ? 'soleil' : 'drapeau') })),
      ...sem.map((e) => ({ t: -1, h: ligneBandeau(`Contrôle dans la semaine · ${e.titre}`, `${info(e.module).court}${e.statut === 'a_confirmer' ? ' · date à confirmer' : ''}`, html`data-ech="${e.id}"`, 'pl-a-sem', 'cible') })),
      ...seances.map((s) => ({ t: s.t0, h: ligneSeance(s, t, auj) })),
      ...ech.map((e) => ({ t: instantEch(e), h: ligneEcheance(e) })),
    ].sort((a, b) => a.t - b.t);
    const actives = seances.filter((s) => !s.annule);
    const rel = k === auj ? 'Aujourd’hui' : k === ajouterJours(auj, 1) ? 'Demain' : k === ajouterJours(auj, -1) ? 'Hier' : '';
    groupes.push(html`<div class="pl-a-jour ${k === auj ? 'pl-a-auj' : ''}">
      <h3 class="pl-a-tete"><span class="pl-a-rel">${rel || majuscule(dateLongue(midi(k)))}</span>${rel ? html`<span class="pl-a-date">${dateLongue(midi(k))}</span>` : ''}${actives.length ? html`<span class="pl-a-bilan chiffres">${heure(actives[0].t0)} – ${heure(Math.max(...actives.map((s) => s.t1)))}</span>` : ''}</h3>
      <ul class="liste verre pl-a-groupe">${lignes.map((l) => l.h)}</ul>
    </div>`);
  }
  return {
    stats: statistiques(toutes, 'liste'),
    corps: groupes.length
      ? html`<section class="pl-agenda ${anim}" data-glisse="14">${groupes}</section>`
      : html`<section class="pl-carte verre ${anim}" data-glisse="14">${repos(jours[0], jours.at(-1))}</section>`,
  };
}

// ---------- Emploi du temps pas encore reçu ----------
function attente() {
  return html`<section class="pl-attente verre">
    <div class="pl-fantome" aria-hidden="true">${[0, 1, 2, 3, 4].map(() => html`<div><i class="squelette"></i><i class="squelette"></i><i class="squelette"></i></div>`)}</div>
    <p><b>Emploi du temps en attente d’ADE.</b> La synchro réessaie toute seule.</p>
  </section>`;
}

// ---------- Feuilles de détail ----------
const fermerSurLien = (f) => f.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) fermerFeuille(); });

function feuilleSeance(s) {
  const t = maintenant();
  const i = info(s.module);
  const e = echeanceDeSeance(s);
  const precision = precisionSeance(s);
  const enCours = s.t0 <= t && t < s.t1;
  const type = libType(s);
  const titre = s.module ? i.nom : titreSeance(s);
  const lignes = [
    ['epingle', (s.salles || []).length > 1 ? 'Salles' : 'Salle', salle(s) || 'Non précisée'],
    s.profs?.length && ['personne', s.profs.length > 1 ? 'Enseignants' : 'Enseignant', s.profs.map(nomProf).join(', ')],
    s.groupes?.length && ['groupe', s.groupes.length > 1 ? 'Groupes' : 'Groupe', s.groupes.join(', ')],
    ['calendrier', 'Intitulé ADE', s.titre],
  ].filter(Boolean);
  const detailsCtrl = e ? [e.coef ? coef(e.coef) : '', e.duree ? `${e.duree} min` : '', e.lieu || ''].filter(Boolean).join(' · ') : '';
  const contenu = html`<div class="pl-f ${s.annule ? 'pl-f-annule' : ''}" style="${styleModule(s.module)}">
    <div class="pl-f-tags">${s.module ? html`<span class="module-tag">${s.module}</span>` : ''}${s.type === 'eval' ? html`<span class="puce pleine c-rouge">Contrôle</span>` : type ? html`<span class="puce pl-f-type">${type}</span>` : ''}${s.annule ? html`<span class="puce c-gris">Annulé</span>` : ''}</div>
    <h2>${titre}</h2>
    ${precision && precision !== e?.titre ? html`<p class="pl-f-precision">${precision}</p>` : ''}
    <div class="pl-f-quand">
      <div class="pl-f-heures chiffres"><b>${heure(s.t0)}</b><span class="pl-f-tiret">–</span><b>${heure(s.t1)}</b><span class="pl-f-duree">${heures(s.t1 - s.t0)}</span></div>
      <div class="pl-f-date">${majuscule(dateLongue(s.t0))} · ${enCours ? html`<span data-pl-reste="${s.t1}">${relatif(s.t1, t).replace('dans ', 'encore ')}</span>` : html`<span data-pl-compte="${s.t0}">${relatif(s.t0, t)}</span>`}</div>
      ${enCours ? html`<div class="barre pl-f-barre" data-pl-progres="${s.t0},${s.t1}" style="--c: var(--m); --p:${((t - s.t0) / (s.t1 - s.t0)).toFixed(4)}"><i></i></div>` : ''}
    </div>
    ${e ? html`<div class="pl-f-ctrl"><b>${e.titre}</b>${detailsCtrl ? html`<span>${detailsCtrl}</span>` : ''}${e.consignes ? html`<p>${e.consignes}</p>` : ''}${e.details ? html`<p>${e.details}</p>` : ''}</div>` : ''}
    <ul class="liste pl-f-liste">${lignes.map(([icone, lib, val]) => html`<li><span class="pl-f-ic">${ic(icone)}</span><div class="grow"><div class="sous">${lib}</div><div class="titre ${icone === 'calendrier' ? 'pl-f-brut' : ''}">${val}</div></div></li>`)}</ul>
    ${s.module && MODULES[s.module] ? html`<a class="bouton plein pl-f-lien" href="#/cours/${encodeURIComponent(s.module)}">Voir le module${ic('droite')}</a>` : ''}
  </div>`;
  ouvrirFeuille(contenu, { titre, apres: fermerSurLien });
}

function feuilleEcheance(e) {
  const t = maintenant();
  const quand = e.semaine ? `Semaine du ${dateMoyenne(e.t0 ?? e.t)}` : e.heure_inconnue ? `${majuscule(dateLongue(e.t))} · heure à confirmer` : majuscule(echeanceLisible(instantEch(e), t));
  const extra = [e.coef ? coef(e.coef) : '', e.duree ? `${e.duree} min` : '', e.lieu || ''].filter(Boolean).join(' · ');
  const contenu = html`<div class="pl-f" style="${styleEch(e)}">
    <div class="pl-f-tags"><span class="module-tag" style="${styleModule(e.module)}">${info(e.module).court}</span><span class="puce ${e.type === 'eval' ? 'pleine c-rouge' : e.fait ? 'c-vert' : 'c-orange'}">${libelleEch(e)}</span>${e.statut === 'a_confirmer' ? html`<span class="puce c-gris">À confirmer</span>` : ''}</div>
    <h2>${e.titre}</h2>
    <div class="pl-f-quand">
      <div class="pl-f-quand-txt">${quand}</div>
      <div class="pl-f-date chiffres"><span data-pl-compte="${instantEch(e)}">${relatif(instantEch(e), t)}</span>${extra ? ` · ${extra}` : ''}</div>
    </div>
    ${e.details ? html`<p class="pl-f-texte">${e.details}</p>` : ''}
    ${e.consignes ? html`<p class="pl-f-texte pl-f-consigne">${e.consignes}</p>` : ''}
    <a class="bouton plein pl-f-lien" href="#/afaire">Ouvrir dans À faire${ic('droite')}</a>
  </div>`;
  ouvrirFeuille(contenu, { titre: e.titre, apres: fermerSurLien });
}

function feuilleCalendrier(c) {
  const dates = c.fin > c.debut ? `Du ${dateLongue(midi(c.debut))} au ${dateLongue(midi(c.fin))}` : majuscule(dateLongue(midi(c.debut)));
  const contenu = html`<div class="pl-f" style="--m: var(--${c.type === 'vacances' ? 'vert' : 'indigo'}); --m-encre: var(--${c.type === 'vacances' ? 'vert' : 'indigo'}-encre)">
    <div class="pl-f-tags"><span class="puce" style="--c: var(--m); --c-encre: var(--m-encre)">${c.type === 'vacances' ? 'Vacances' : c.sous_type === 'ferie' ? 'Jour férié' : 'Département'}</span></div>
    <h2>${c.libelle}</h2>
    <div class="pl-f-quand"><div class="pl-f-quand-txt">${dates}</div>${c.reprise ? html`<div class="pl-f-date">Reprise ${dateLongue(midi(c.reprise))}</div>` : ''}</div>
    ${c.detail ? html`<p class="pl-f-texte">${c.detail}</p>` : ''}
  </div>`;
  ouvrirFeuille(contenu, { titre: c.libelle });
}

// ---------- « Maintenant » : ligne rouge, recalée chaque minute ----------
const etat = () => {
  const t = maintenant();
  return `${aujourdhui()}|${E.seances.filter((s) => s.t0 <= t && t < s.t1).map((s) => s.id).join(',')}`;
};
function majMaintenant(racine) {
  const t = maintenant(), mn = minutesDuJour(t), auj = aujourdhui();
  racine.querySelectorAll('.pl-corps').forEach((c) => {
    const h0 = +c.dataset.h0, h1 = +c.dataset.h1;
    const y = (mn - h0 * 60) / ((h1 - h0) * 60);
    const ok = y >= 0 && y <= 1 && !!c.querySelector(`.pl-col[data-cle="${auj}"]`);
    c.classList.toggle('pl-sans-maintenant', !ok);
    c.style.setProperty('--ny', y.toFixed(5));
    const n = c.querySelector('.pl-nh');
    if (n) n.textContent = heure(t);
    c.querySelectorAll('.pl-h').forEach((h) => h.classList.toggle('pl-cache', ok && Math.abs(+h.dataset.m - mn) < 14));
  });
}

// ---------- Vue ----------
export default {
  id: 'planning',
  titre: 'Planning',
  surtitre(_E, params) {
    const mode = lireMode(params), cle = lireCle(params, mode);
    if (mode === 'jour') return `${dateLongue(midi(cle))} · semaine ${numeroSemaine(cle)}`;
    if (mode === 'liste') return plage(cle, ajouterJours(cle, 13));
    const j = joursVisibles(cle);
    return `Semaine ${numeroSemaine(j[0])} · ${plage(j[0], j.at(-1))}`;
  },
  rendre(_E, params) {
    if (!E.seances.length && !E.sync.ade) return attente();
    const mode = lireMode(params), cle = lireCle(params, mode);
    const interne = nav.hash !== null && nav.hash === location.hash;
    const anim = interne ? (nav.sens > 0 ? 'pl-depuis-droite' : nav.sens < 0 ? 'pl-depuis-gauche' : 'pl-fondu') : '';
    const memeSemaine = interne && nav.semaine === lundi(cle) && !nav.avant;
    const vue = mode === 'jour' ? vueJour(cle, anim, memeSemaine ? 'pl-calme' : anim)
      : mode === 'liste' ? vueListe(cle, anim) : vueSemaine(cle, anim);
    const sortie = html`${barre(mode, vue.stats, interne)}${vue.corps}`;
    nav.hash = null; nav.sens = 0; nav.avant = null;
    nav.semaine = lundi(cle);
    return sortie;
  },
  monter(racine, _E, params) {
    const mode = lireMode(params), cle = lireCle(params, mode);
    racine.dataset.plEtat = etat();
    majMaintenant(racine);

    // Le segment part de l'ancien mode et glisse vers le nouveau.
    const seg = racine.querySelector('.pl-modes');
    if (seg && seg.style.getPropertyValue('--i').trim() !== seg.dataset.i) {
      requestAnimationFrame(() => requestAnimationFrame(() => seg.style.setProperty('--i', seg.dataset.i)));
    }
    if (nav.focus) { racine.querySelector(nav.focus)?.focus({ preventScroll: true }); nav.focus = null; }

    const naviguer = (hash, sens = 0, focus = null, avant = null) => {
      if (location.hash === hash) return false;
      Object.assign(nav, { hash, sens, focus, avant });
      location.hash = hash;
      return true;
    };
    const aller = (k, vers = mode, focus = null) => {
      const sens = vers === mode ? Math.sign(ecartJours(debutPeriode(cle, mode), debutPeriode(k, mode))) : 0;
      naviguer(`#/planning/${k}/${vers}`, sens, focus, vers === mode ? null : mode);
    };
    const decaler = (n, focus = null) => aller(ajouterJours(cle, n * PAS[mode]), mode, focus);
    const versAujourdhui = () => {
      ecrire(MEMOIRE, mode);
      const cible = lireCle([], mode);
      const sens = Math.sign(ecartJours(debutPeriode(cle, mode), debutPeriode(cible, mode)));
      if (!naviguer('#/planning', sens, '[data-nav="0"]')) {
        const ligne = racine.querySelector('.pl-maintenant, .pl-a-auj');
        ligne?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    };
    const cibleMode = (m) => {
      const auj = aujourdhui();
      const fin = mode === 'semaine' ? ajouterJours(lundi(cle), 6) : mode === 'liste' ? ajouterJours(cle, 13) : cle;
      const debut = debutPeriode(cle, mode);
      if (auj >= debut && auj <= fin) return auj;
      return m === 'semaine' ? cle : debut;
    };

    const clic = (ev) => {
      const el = ev.target.closest('button, a');
      if (!el || !racine.contains(el)) return;
      const d = el.dataset;
      if (d.nav != null) {
        vibrer(6);
        const n = +d.nav;
        if (n === 0) versAujourdhui(); else decaler(n, `[data-nav="${n}"]`);
      } else if (d.mode) {
        if (d.mode === mode) return;
        vibrer(6);
        ecrire(MEMOIRE, d.mode);
        aller(cibleMode(d.mode), d.mode, `[data-mode="${d.mode}"]`);
      } else if (d.aller) {
        aller(d.aller, d.vers || mode);
      } else if (d.seance) {
        const s = E.seances.find((x) => x.id === d.seance);
        if (s) { vibrer(6); feuilleSeance(s); }
      } else if (d.ech) {
        const e = E.echeances.find((x) => x.id === d.ech);
        if (e) { vibrer(6); feuilleEcheance(e); }
      } else if (d.cal) {
        const c = calendrier()[+d.cal];
        if (c) feuilleCalendrier(c);
      }
    };
    racine.addEventListener('click', clic);

    const touche = (ev) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey || ev.shiftKey) return;
      if (ev.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.feuille')) return;
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); decaler(ev.key === 'ArrowLeft' ? -1 : 1); }
      else if (ev.key === 't' || ev.key === 'T') versAujourdhui();
    };
    addEventListener('keydown', touche);

    // Balayage au doigt : la zone suit le doigt, puis on change de jour (ou de semaine sur la bande).
    let geste = null;
    const debut = (ev) => {
      if (ev.touches.length !== 1) { geste = null; return; }
      const p = ev.touches[0];
      geste = { x: p.clientX, y: p.clientY, el: ev.currentTarget, dir: null, dx: 0 };
    };
    const bouge = (ev) => {
      if (!geste) return;
      const p = ev.touches[0];
      const dx = p.clientX - geste.x, dy = p.clientY - geste.y;
      if (!geste.dir) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) geste.dir = 'h';
        else if (Math.abs(dy) > 12) geste.dir = 'v';
      }
      if (geste.dir === 'h') {
        geste.dx = dx;
        geste.el.style.transition = 'none';
        geste.el.style.transform = `translateX(${(dx * 0.4).toFixed(1)}px)`;
      }
    };
    const fin = () => {
      if (!geste) return;
      const { el, dir, dx } = geste;
      geste = null;
      el.style.transition = '';
      el.style.transform = '';
      if (dir === 'h' && Math.abs(dx) > 60) {
        vibrer(8);
        const pas = +el.dataset.glisse || PAS[mode];
        aller(ajouterJours(cle, (dx < 0 ? 1 : -1) * pas), mode);
      }
    };
    racine.querySelectorAll('[data-glisse]').forEach((z) => {
      z.addEventListener('touchstart', debut, { passive: true });
      z.addEventListener('touchmove', bouge, { passive: true });
      z.addEventListener('touchend', fin);
      z.addEventListener('touchcancel', fin);
    });

    return () => {
      racine.removeEventListener('click', clic);
      removeEventListener('keydown', touche);
      delete racine.dataset.plEtat;
    };
  },
  tic(_racine, _E, t) {
    // Les feuilles vivent hors de la vue : on tient leurs compteurs à jour ici.
    document.querySelectorAll('.pl-f [data-pl-compte]').forEach((n) => { n.textContent = relatif(+n.dataset.plCompte, t); });
    document.querySelectorAll('.pl-f [data-pl-reste]').forEach((n) => { n.textContent = relatif(+n.dataset.plReste, t).replace('dans ', 'encore '); });
    document.querySelectorAll('.pl-f [data-pl-progres]').forEach((n) => {
      const [a, b] = n.dataset.plProgres.split(',').map(Number);
      n.style.setProperty('--p', Math.min(Math.max((t - a) / (b - a), 0), 1).toFixed(4));
    });
  },
  minute(racine) {
    if (racine.dataset.plEtat && racine.dataset.plEtat !== etat()) {
      document.dispatchEvent(new CustomEvent('donnees', { detail: 'minute' }));
      return;
    }
    majMaintenant(racine);
  },
};
