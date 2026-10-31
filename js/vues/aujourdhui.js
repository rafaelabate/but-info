// Aujourd'hui : cours en cours ou suivant, journée, prochain contrôle, rendus, semaine, annonces, raccourcis.
import { html, brut, urlSure, normaliser } from '../html.js';
import { ic, ile, vibrer } from '../ui.js';
import { E, maintenant, seancesDuJour, seanceEnCours, prochaineSeance, aujourdhui, controles, basculerFait } from '../donnees.js';
import {
  heure, dateLongue, dateMoyenne, dateCourte, nomJour, jourCourt, numeroJour, majuscule,
  echeanceLisible, relatif, duree, decompte, pad, ajouterJours, lundi, jourSemaine, depuisCle,
  ecartJours, cleJour, MIN, HEURE, JOUR,
} from '../temps.js';
import { info, styleModule, titreSeance, precisionSeance, LIBELLE_TYPE, nomProf } from '../cours.js';

const APPS = [
  ['moodle', 'Moodle', 'diplome', 'orange'],
  ['notes', 'Notes', 'graphique', 'vert'],
  ['mail', 'Mail', 'mail', 'bleu'],
  ['ade', 'ADE', 'calendrier', 'rouge'],
  ['intranet', 'Intranet', 'globe', 'indigo'],
];
const NB = ' ';          // espace insécable
const FINE = ' ';        // espace fine insécable
const TIRET = `${FINE}–${FINE}`;

// ---------- Petits utilitaires ----------
const enVacances = (cle) => (E.but?.calendrier || []).find((c) => c.type === 'vacances' && c.debut <= cle && cle <= c.fin);
const libType = (s) => (s.type ? LIBELLE_TYPE[s.type] || s.type : '');
const plage = (s) => `${heure(s.t0)}${TIRET}${heure(s.t1)}`;
const urgence = (ms) => (ms < JOUR ? 'c-rouge' : ms < 3 * JOUR ? 'c-orange' : 'c-gris');
const avancement = (s, t) => Math.min(Math.max((t - s.t0) / (s.t1 - s.t0), 0), 1).toFixed(4);
const joindre = (morceaux) => morceaux.filter(Boolean).flatMap((m, i) => (i ? [' · ', m] : [m]));

// « 7 h », « 5 h 30 »
function heures(h) {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}${NB}h${NB}${pad(mm)}` : `${hh}${NB}h`;
}
// « Aujourd’hui », « Demain », « Lundi », « Jeu 8 oct »
function jourDe(d, t) {
  const n = ecartJours(cleJour(t), cleJour(d));
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Demain';
  if (n > 1 && n < 7) return majuscule(nomJour(d));
  return majuscule(dateMoyenne(d));
}
// Même chose mais toujours avec la date au-delà de demain (contrôles)
function jourDate(d, t) {
  const n = ecartJours(cleJour(t), cleJour(d));
  if (n === 0) return 'Aujourd’hui';
  if (n === 1) return 'Demain';
  return majuscule(dateMoyenne(d));
}

// « Salle TP 402 » → petit « Salle TP » + gros « 402 » ; « Amphi A » → « Amphi » + « A »
const RE_SALLE = /^(.+?)\s+([A-Z]{0,3}[-.]?\d[\w.-]{0,5}|[A-Z])$/;
function salleDe(s) {
  const liste = s.salles?.length ? s.salles : s.lieu?.trim() ? [s.lieu.trim()] : [];
  if (!liste.length) return { pre: '', num: 'Salle non communiquée', taille: 's', complet: '' };
  const morceaux = liste.map((x) => { const m = x.match(RE_SALLE); return m ? { pre: m[1], num: m[2] } : { pre: '', num: x }; });
  const memePre = morceaux.every((m) => m.pre === morceaux[0].pre);
  const pre = memePre ? morceaux[0].pre : '';
  const num = memePre ? morceaux.map((m) => m.num).join(' · ') : liste.join(' · ');
  const taille = num.length <= 4 ? 'xl' : num.length <= 8 ? 'l' : num.length <= 18 ? 'm' : 's';
  return { pre, num, taille, complet: liste.join(', ') };
}

// ---------- Héros : maintenant / ensuite ----------
const heroVide = (icone, texte) => html`<section class="auj-heros auj-heros-vide verre carte">
  <span class="auj-vide-icone">${ic(icone)}</span><p>${texte}</p></section>`;

function ensuite(x, t) {
  const sx = salleDe(x);
  const quand = cleJour(x.t0) === cleJour(t) ? heure(x.t0) : `${jourDe(x.t0, t)} ${heure(x.t0)}`;
  return html`<div class="auj-ensuite" style="${styleModule(x.module)}">
    <span class="auj-ensuite-lib">Ensuite</span>
    <span class="auj-ensuite-h chiffres">${quand}</span>
    <span class="auj-point" aria-hidden="true"></span>
    <span class="auj-ensuite-nom">${titreSeance(x)}</span>
    ${sx.complet ? html`<span class="auj-ensuite-salle">${sx.complet}</span>` : ''}
  </div>`;
}

function heros() {
  const t = maintenant();
  if (!E.seances.length) return heroVide('synchro', 'Emploi du temps en attente d’ADE. La synchro réessaie toute seule.');
  const s = seanceEnCours(t);
  const c = s || prochaineSeance(t);
  if (!c) return heroVide('calendrier', 'Aucun cours à venir dans l’emploi du temps.');
  const suite = s ? prochaineSeance(t) : null;
  const sa = salleDe(c);
  const type = libType(c);
  const p = precisionSeance(c);
  const precision = p && normaliser(p) !== normaliser(type) ? p : '';
  const profs = (c.profs || []).map(nomProf).join(', ');
  const dejaEu = seancesDuJour(aujourdhui()).some((x) => !x.annule && x.t0 <= t);
  const etat = s ? 'En cours' : cleJour(c.t0) !== cleJour(t) ? jourDe(c.t0, t) : dejaEu ? 'Ensuite' : 'Premier cours';
  return html`<section class="auj-heros verre teinte lueur ${s ? 'en-cours' : 'a-venir'}" style="${styleModule(c.module)}; --teinte: var(--m)">
    <div class="auj-heros-lueur" aria-hidden="true"></div>
    <div class="auj-heros-haut">
      <span class="auj-etat">${s ? html`<span class="auj-direct" aria-hidden="true"></span>` : ''}${etat}</span>
      <span class="auj-horaire chiffres">${plage(c)}</span>
    </div>
    <div class="auj-heros-corps">
      <div class="auj-heros-cours">
        <h2 class="auj-module">${titreSeance(c)}</h2>
        ${type || precision ? html`<div class="auj-details">${type ? html`<span class="auj-type${c.type === 'eval' ? ' eval' : ''}">${type}</span>` : ''}${precision ? html`<span>${precision}</span>` : ''}</div>` : ''}
        ${profs ? html`<div class="auj-profs">${ic('personne')}<span>${profs}</span></div>` : ''}
        ${s ? '' : html`<div class="auj-compte chiffres" data-compte="${c.t0}">${relatif(c.t0, t)}</div>`}
      </div>
      <div class="auj-salle t-${sa.taille}" title="${sa.complet}">
        ${sa.pre ? html`<span class="auj-salle-pre">${sa.pre}</span>` : ''}<span class="auj-salle-num chiffres">${sa.num}</span>
      </div>
    </div>
    ${s ? html`<div class="auj-progres" data-progres="${s.t0},${s.t1}" style="--p:${avancement(s, t)}">
      <div class="barre"><i></i></div><span class="auj-reste chiffres" data-reste>${relatif(s.t1, t).replace('dans ', 'encore ')}</span>
    </div>` : ''}
    ${suite ? ensuite(suite, t) : ''}
  </section>`;
}

// ---------- Journée (frise) ----------
function frise() {
  const t = maintenant();
  const cle = aujourdhui();
  let jour = cle;
  let liste = seancesDuJour(cle);
  // Journée finie (ou sans cours) : on montre le prochain jour de cours.
  if (!liste.some((s) => s.t1 > t && !s.annule)) {
    const n = prochaineSeance(t);
    if (n && ecartJours(cle, cleJour(n.t0)) <= 7) { jour = cleJour(n.t0); liste = seancesDuJour(jour); }
  }
  const auj = jour === cle;
  const actives = liste.filter((s) => !s.annule);
  const fin = actives.length ? Math.max(...actives.map((s) => s.t1)) : 0;
  const titre = auj ? 'Aujourd’hui' : jourDe(depuisCle(jour), t);
  const resume = actives.length ? `${actives.length}${NB}cours · fin ${heure(fin)}` : '';
  let corps;
  if (!liste.length) {
    corps = html`<p class="vide">Pas de cours aujourd’hui.</p>`;
  } else {
    const maintenantLi = html`<li class="auj-maintenant" aria-hidden="true"><span data-horloge>${heure(t)}</span><i></i></li>`;
    const items = [];
    let marque = !auj || actives.some((s) => s.t0 <= t && t < s.t1);
    let finMax = 0;
    for (const s of liste) {
      const passe = s.t1 <= t;
      const actuelle = !s.annule && s.t0 <= t && t < s.t1;
      if (finMax && s.t0 - finMax >= 45 * MIN) items.push(html`<li class="auj-pause"><span class="chiffres">Pause ${duree(s.t0 - finMax)}</span></li>`);
      if (!marque && s.t0 > t) { marque = true; items.push(maintenantLi); }
      const sx = salleDe(s);
      const prof = s.profs?.length ? nomProf(s.profs[0]) + (s.profs.length > 1 ? ` +${s.profs.length - 1}` : '') : '';
      const type = libType(s);
      const classes = ['auj-seance', passe && 'passe', actuelle && 'actuelle', s.annule && 'annule', s.type === 'eval' && 'eval'].filter(Boolean).join(' ');
      items.push(html`<li class="${classes}" style="${styleModule(s.module)}${actuelle ? `; --p:${avancement(s, t)}` : ''}"${actuelle ? brut(` data-progres="${s.t0},${s.t1}"`) : ''}>
        <div class="auj-heures chiffres"><b>${heure(s.t0)}</b><span>${heure(s.t1)}</span></div>
        <div class="auj-trait" aria-hidden="true"></div>
        <div class="auj-infos">
          <div class="auj-nom"><span class="n">${titreSeance(s)}</span>${type ? html`<span class="auj-type">${type}</span>` : ''}</div>
          <div class="auj-lieu">${joindre([s.annule && html`<b class="auj-annule">Annulé</b>`, sx.complet && html`<b>${sx.complet}</b>`, prof])}</div>
        </div>
      </li>`);
      finMax = Math.max(finMax, s.t1);
    }
    if (!marque) items.push(maintenantLi);
    corps = html`<ol class="auj-frise-liste">${items}</ol>`;
  }
  return html`<section class="auj-frise verre carte">
    <div class="carte-tete">${ic('calendrier')}${titre}${resume ? html`<span class="auj-tete-info chiffres">${resume}</span>` : ''}<span class="espace"></span><a href="#/planning">Planning</a></div>
    ${corps}
  </section>`;
}

// ---------- Prochain contrôle ----------
function controle() {
  const t = maintenant();
  const [c, apres] = controles();
  const tete = html`<div class="carte-tete" style="--c-icone: var(--rouge)">${ic('cible')}Prochain contrôle<span class="espace"></span>${c ? html`<a href="#/afaire">Tout voir</a>` : ''}</div>`;
  if (!c) return html`<section class="auj-controle verre carte">${tete}<p class="vide">Aucun contrôle annoncé.</p></section>`;
  const cible = c.t0 || c.t;
  const d = decompte(cible - t);
  const quand = c.semaine ? `Semaine du ${dateMoyenne(cible)}` : c.heure_inconnue ? `${jourDate(cible, t)} · heure à confirmer` : `${jourDate(cible, t)} · ${heure(cible)}`;
  const meta = [quand, c.lieu, c.duree ? duree(c.duree * MIN) : '', c.coef ? `coef${NB}${String(c.coef).replace('.', ',')}` : ''].filter(Boolean).join(' · ');
  return html`<section class="auj-controle verre carte" style="${styleModule(c.module)}">
    ${tete}
    ${cible > t ? html`<div class="auj-decompte chiffres${cible - t < JOUR ? ' urgent' : ''}" data-decompte="${cible}" role="timer">
      <div><b data-j>${d.j}</b><span>j</span></div><div><b data-h>${pad(d.h)}</b><span>h</span></div><div><b data-m>${pad(d.m)}</b><span>min</span></div><div class="sec"><b data-s>${pad(d.s)}</b><span>s</span></div>
    </div>` : html`<div class="auj-decompte-fini"><span class="auj-direct" aria-hidden="true"></span>En ce moment</div>`}
    <div class="auj-controle-titre"><span class="module-tag">${info(c.module).court}</span><b>${c.titre}</b></div>
    <div class="auj-controle-meta chiffres">${meta}${c.statut === 'a_confirmer' ? html`<span class="puce c-orange">À confirmer</span>` : ''}</div>
    ${c.consignes ? html`<p class="auj-consigne">${ic('info')}<span>${c.consignes}</span></p>` : ''}
    ${apres ? html`<a class="auj-controle-suite" href="#/afaire" style="${styleModule(apres.module)}">
      <span class="auj-suite-lib">Puis</span><span class="module-tag">${info(apres.module).court}</span>
      <span class="auj-suite-titre">${apres.titre}</span><span class="auj-suite-date chiffres">${dateMoyenne(apres.t0 || apres.t)}</span>
    </a>` : ''}
  </section>`;
}

// ---------- À rendre ----------
const aRendre = (t) => E.echeances.filter((e) => e.type === 'devoir' && !e.fait && (!e.t || e.t > t - JOUR));
function rendus() {
  const t = maintenant();
  const tous = aRendre(t);
  const liste = tous.slice(0, 5);
  const corps = liste.length ? html`<ul class="liste auj-rendus-liste">${liste.map((e) => {
    const u = urlSure(e.url);
    return html`<li style="${styleModule(e.module)}">
      <button class="auj-case" type="button" data-fait="${e.id}" data-titre="${e.titre}" aria-label="Marquer «${NB}${e.titre}${NB}» comme fait">${ic('coche')}</button>
      <div class="grow">
        <div class="titre">${u ? html`<a href="${u}" target="_blank" rel="noopener">${e.titre}</a>` : e.titre}</div>
        <div class="sous"><span class="module-tag">${info(e.module).court}</span><span>${e.t ? echeanceLisible(e.t, t) : 'Sans date limite'}</span>${e.statut === 'a_verifier' ? html`<span class="auj-verifier">à vérifier</span>` : ''}</div>
      </div>
      ${e.t ? html`<span class="puce ${urgence(e.t - t)} chiffres" data-compte="${e.t}">${relatif(e.t, t)}</span>` : ''}
    </li>`;
  })}</ul>` : html`<p class="vide">Rien à rendre pour l’instant.</p>`;
  return html`<section class="auj-rendus verre carte">
    <div class="carte-tete" style="--c-icone: var(--orange)">${ic('coches')}À rendre${tous.length ? html`<span class="auj-tete-info chiffres">${tous.length}</span>` : ''}<span class="espace"></span><a href="#/afaire">Tout voir</a></div>
    ${corps}
  </section>`;
}

// ---------- Semaine ----------
function semaine() {
  const t = maintenant();
  const cle = aujourdhui();
  const js = jourSemaine(cle);
  const debut = lundi(js === 6 || js === 0 ? ajouterJours(cle, 2) : cle);
  const jours = [0, 1, 2, 3, 4].map((i) => {
    const k = ajouterJours(debut, i);
    const ss = seancesDuJour(k).filter((s) => !s.annule);
    return { k, ss, h: ss.reduce((a, s) => a + (s.t1 - s.t0), 0) / HEURE };
  });
  const max = Math.max(8, ...jours.map((j) => j.h)) * 1.08;
  const total = jours.reduce((a, j) => a + j.h, 0);
  const t0 = Math.max(t, depuisCle(debut).getTime());
  const t1 = depuisCle(ajouterJours(debut, 7)).getTime();
  const dans = E.echeances.filter((e) => !e.fait && e.t && e.t >= t0 && e.t < t1);
  const nR = dans.filter((e) => e.type === 'devoir').length;
  const nC = dans.filter((e) => e.type === 'eval').length;
  const pied = nR || nC
    ? html`${joindre([nR && html`<b>${nR}</b> rendu${nR > 1 ? 's' : ''}`, nC && html`<b>${nC}</b> contrôle${nC > 1 ? 's' : ''}`])} d’ici dimanche`
    : 'Rien à rendre d’ici dimanche';
  return html`<section class="auj-semaine verre carte">
    <div class="carte-tete" style="--c-icone: var(--indigo)">${ic('graphique')}${debut === lundi(cle) ? 'Cette semaine' : 'Semaine prochaine'}<span class="espace"></span><span class="auj-total chiffres">${heures(total)}</span></div>
    <div class="auj-barres">${jours.map((j) => {
      const date = depuisCle(j.k);
      return html`<a href="#/planning/${j.k}" class="auj-jour${j.k === cle ? ' auj' : ''}${j.k < cle ? ' passe' : ''}" aria-label="${majuscule(nomJour(date))} ${numeroJour(date)}${NB}: ${heures(j.h)} de cours">
        <span class="auj-jour-h">${j.h ? heures(j.h) : ''}</span>
        <span class="auj-colonne" aria-hidden="true">${j.ss.map((s) => html`<i style="${styleModule(s.module)}; --p:${((s.t1 - s.t0) / HEURE / max).toFixed(4)}"></i>`)}</span>
        <span class="auj-jour-nom">${jourCourt(date)} <b class="chiffres">${numeroJour(date)}</b></span>
      </a>`;
    })}</div>
    <div class="auj-semaine-pied">${pied}</div>
  </section>`;
}

// ---------- Annonces ----------
function quandAnnonce(d, t) {
  const n = ecartJours(cleJour(d), cleJour(t));
  if (n <= 0) return heure(d);
  if (n === 1) return 'Hier';
  if (n < 7) return majuscule(nomJour(d));
  return dateCourte(d);
}
function annonces() {
  const t = maintenant();
  const liste = [...(E.perso?.annonces || [])].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).slice(0, 3);
  if (!liste.length) return '';
  return html`<section class="auj-annonces verre carte">
    <div class="carte-tete" style="--c-icone: var(--cyan)">${ic('megaphone')}Annonces</div>
    <ul class="liste">${liste.map((a) => {
      const u = urlSure(a.url);
      const d = Date.parse(a.date);
      const contenu = html`<div class="auj-annonce-haut"><span class="module-tag">${info(a.module).court}</span>${a.auteur ? html`<span class="auj-annonce-auteur">${a.auteur}</span>` : ''}${d ? html`<span class="auj-annonce-date chiffres">${quandAnnonce(d, t)}</span>` : ''}</div>
        <div class="titre">${a.titre}</div>${a.resume ? html`<p class="auj-annonce-resume">${a.resume}</p>` : ''}`;
      return html`<li style="${styleModule(a.module)}">${u ? html`<a class="auj-annonce" href="${u}" target="_blank" rel="noopener">${contenu}</a>` : html`<div class="auj-annonce">${contenu}</div>`}</li>`;
    })}</ul>
  </section>`;
}

// ---------- Raccourcis ----------
function apps() {
  const l = E.perso?.liens || {};
  const dispo = APPS.filter(([k]) => urlSure(l[k]));
  if (!dispo.length) return '';
  return html`<nav class="auj-apps verre carte" aria-label="Raccourcis"><div class="auj-grille-apps">${dispo.map(([k, nom, icone, c]) => html`
    <a class="auj-app" href="${urlSure(l[k])}" target="_blank" rel="noopener"><span class="icone-carree" style="--c: var(--${c})">${ic(icone)}</span><span>${nom}</span></a>`)}</div></nav>`;
}

// ---------- Méthode du jour ----------
function methode() {
  const p = E.methodes?.principes || [];
  if (!p.length) return '';
  const n = ecartJours('2026-01-01', aujourdhui());
  const m = p[((n % p.length) + p.length) % p.length];
  return html`<a class="auj-methode verre carte lueur" href="#/reviser">
    <span class="icone-carree" style="--c: var(--violet)">${ic(m.icone)}</span>
    <div class="grow"><div class="auj-methode-lib">Méthode du jour</div><div class="auj-methode-titre">${m.titre}</div>${m.accroche ? html`<div class="auj-methode-texte">${m.accroche}</div>` : ''}</div>
    ${ic('droite', 'auj-chevron')}
  </a>`;
}

// ---------- Vacances ----------
function bandeau() {
  const vac = enVacances(aujourdhui());
  if (!vac) return '';
  return html`<div class="auj-bandeau verre">${ic('soleil')}<div class="auj-bandeau-texte"><b>${vac.libelle}</b>${vac.reprise ? html`<span>reprise ${dateLongue(depuisCle(vac.reprise))}</span>` : ''}</div></div>`;
}

// Ce qui, en changeant, impose de redessiner la vue (fin de cours, bascule d'urgence…)
const cleEtat = () => {
  const t = maintenant();
  const r = aRendre(t).slice(0, 5).map((e) => (e.t ? urgence(e.t - t) : '-')).join('');
  return `${seanceEnCours(t)?.id}|${prochaineSeance(t)?.id}|${aujourdhui()}|${controles()[0]?.id}|${r}`;
};

export default {
  id: 'aujourdhui',
  titre: 'Aujourd’hui',
  surtitre: () => dateLongue(maintenant()),
  rendre: () => html`${bandeau()}<div class="auj-grille">
    ${heros()}${controle()}
    <div class="auj-col">${frise()}${methode()}</div>
    <div class="auj-col">${rendus()}${apps()}</div>
    <div class="auj-col">${semaine()}${annonces()}</div>
  </div>`,
  monter(racine) {
    racine.dataset.cle = cleEtat();
    const clic = (e) => {
      const b = e.target.closest('[data-fait]');
      if (!b || b.classList.contains('coche')) return;
      b.classList.add('coche');
      b.closest('li')?.classList.add('fini');
      vibrer(10);
      const id = b.dataset.fait;
      const titre = b.dataset.titre || 'Échéance';
      setTimeout(() => {
        basculerFait(id);
        ile(`«${NB}${titre}${NB}» fait`, { icone: 'coche', action: { libelle: 'Annuler', faire: () => basculerFait(id) }, duree: 4500 });
      }, 320);
    };
    racine.addEventListener('click', clic);
    return () => racine.removeEventListener('click', clic);
  },
  tic(racine, _E, t) {
    const d = racine.querySelector('.auj-decompte');
    if (d) d.classList.toggle('urgent', +d.dataset.decompte - t < JOUR);
  },
  minute(racine) {
    if (racine.dataset.cle !== cleEtat()) document.dispatchEvent(new CustomEvent('donnees', { detail: 'minute' }));
  },
};
