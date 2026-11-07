// Cours : grille des modules, fiche d'un module, Notes & UE (simulateur de moyennes).
import { html, urlSure, domaine, empreinte } from '../html.js';
import { ic, anneau, ouvrirFeuille } from '../ui.js';
import { E, maintenant, moduleContenu } from '../donnees.js';
import { MODULES, CODES, UES, info, styleModule, ueDuModule, codeModule, LIBELLE_TYPE, nomProf } from '../cours.js';
import { heure, jourRelatif, dateMoyenne, echeanceLisible, majuscule, jourCourt, numeroJour, HEURE, JOUR } from '../temps.js';
import { lire, ecrire } from '../stockage.js';

const NB = ' ';
const lien = (code) => `#/cours/${encodeURIComponent(code)}`;
const estSae = (code) => /^SA[EÉ]/.test(code || '');
const fr = (n, d = 2) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const frSimple = (n) => (n == null || !Number.isFinite(n) ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));
const oui = (b) => (b ? 'true' : 'false');

// ---------- Données dérivées ----------
const aContenu = (m) => !!m && (m.etat_local ? !/aucun|vide|absent|manquant|^non/i.test(String(m.etat_local)) : (m.progression || []).length > 0);
function codesAffiches() {
  const connus = new Set(E.modules.map((m) => m.code));
  return CODES.filter((c) => connus.has(c) || ueDuModule(c).length || E.seances.some((s) => s.module === c));
}
const seancesDe = (code, t = maintenant()) => E.seances.filter((s) => s.module === code && !s.annule && s.t1 > t);
const quand = (e) => (e.type === 'eval' ? e.t0 || e.t : e.t);
const aVenir = (e, t) => !e.fait && e.statut !== 'passe' && e.t && e.t > t - 2 * HEURE;
const echeancesDe = (code) => E.echeances.filter((e) => e.module === code);
const prochaineEcheance = (code, t = maintenant()) => echeancesDe(code).filter((e) => e.type !== 'evenement' && aVenir(e, t)).sort((a, b) => quand(a) - quand(b))[0] || null;
const urgence = (ms) => (ms < JOUR ? 'c-rouge' : ms < 3 * JOUR ? 'c-orange' : 'c-gris');
function dateEcheance(e, t) {
  if (e.semaine) return `semaine du ${dateMoyenne(e.t0 || e.t)}`;
  if (e.heure_inconnue) return dateMoyenne(quand(e));
  return echeanceLisible(quand(e), t);
}
function texteSeance(s, t) {
  const type = s.type ? LIBELLE_TYPE[s.type] || s.type : '';
  const salle = s.salles.join(', ');
  if (s.t0 <= t) return ['En cours', type, salle].filter(Boolean).join(' · ');
  return [`${majuscule(jourRelatif(s.t0, t))} ${heure(s.t0)}`, type, salle].filter(Boolean).join(' · ');
}
function lireHeures(txt) {
  const m = String(txt || '').match(/(\d+(?:[.,]\d+)?)\s*h(?:\s*dont\s*(\d+(?:[.,]\d+)?)\s*h\s*(?:de\s*)?([\p{L}]+))?/u);
  return m ? { total: m[1], part: m[2] || null, quoi: m[3] || '' } : null;
}

// Liste « à maîtriser » : { empreinte du texte: horodatage } sous la clé maitrise:<code>
const cleMaitrise = (code) => `maitrise:${code}`;
function maitrise(code) {
  const v = lire(cleMaitrise(code), {});
  if (Array.isArray(v)) return Object.fromEntries(v.map((k) => [String(k), 1]));
  return v && typeof v === 'object' ? v : {};
}
function progres(code) {
  const items = moduleContenu(code)?.a_maitriser || [];
  const faits = maitrise(code);
  const n = items.filter((t) => faits[empreinte(t)]).length;
  return { n, total: items.length, p: items.length ? n / items.length : 0 };
}

// ---------- Barre du haut ----------
const barre = (i) => html`<div class="co-barre"><div class="segment co-segment" style="--n:2; --i:${i}" role="group" aria-label="Affichage">
  <button type="button" data-aller="#/cours" data-i="0" aria-pressed="${oui(i === 0)}">Modules</button>
  <button type="button" data-aller="#/cours/notes" data-i="1" aria-pressed="${oui(i === 1)}">Notes &amp; UE</button>
</div></div>`;

// ==========================================================================
// Grille des modules
// ==========================================================================
function carteModule(code, t) {
  const m = moduleContenu(code);
  const i = info(code);
  const s = seancesDe(code, t)[0];
  const e = prochaineEcheance(code, t);
  const pr = progres(code);
  const ues = ueDuModule(code);
  return html`<a class="co-carte verre lueur${aContenu(m) ? '' : ' co-discrete'}" href="${lien(code)}" style="${styleModule(code)}">
    <div class="co-carte-tete">
      <span class="icone-carree" style="--c: var(--m)">${ic(i.icone)}</span>
      <div class="co-carte-noms"><span class="co-code">${code}</span><b>${i.nom}</b></div>
      ${pr.total ? html`<div class="co-mini" aria-label="À maîtriser : ${pr.n} sur ${pr.total}">${anneau(pr.p, { taille: 26, epaisseur: 3.5, couleur: 'var(--m)' })}<span class="chiffres">${pr.n}/${pr.total}</span></div>` : ''}
    </div>
    <div class="co-carte-lignes">
      <div class="co-ligne${s ? '' : ' co-muet'}">${ic('horloge')}<span>${s ? texteSeance(s, t) : 'Aucune séance prévue'}</span></div>
      ${e ? html`<div class="co-ligne co-ech${e.type === 'eval' ? ' co-eval' : ''}">${ic(e.type === 'eval' ? 'cible' : 'coches')}<span>${e.titre}</span><span class="puce ${urgence(quand(e) - t)} chiffres" data-compte="${quand(e)}"></span></div>` : ''}
    </div>
    ${ues.length ? html`<div class="co-ues">${ues.map((u) => html`<span class="co-ue-puce" style="--c: var(--${u.couleur})">${u.comp}<b class="chiffres">${u.coefs[code]}${NB}%</b></span>`)}</div>` : ''}
  </a>`;
}

function vueGrille(t) {
  const codes = codesAffiches();
  const groupes = [['Ressources', codes.filter((c) => !estSae(c))], ['SAÉ', codes.filter(estSae)]];
  return html`${barre(0)}${groupes.filter(([, l]) => l.length).map(([titre, l]) => html`<section class="co-groupe">
    <h2 class="co-titre-groupe">${titre}<span class="chiffres">${l.length}</span></h2>
    <div class="co-grille">${l.map((c) => carteModule(c, t))}</div>
  </section>`)}`;
}

// ==========================================================================
// Fiche d'un module
// ==========================================================================
const ICONE_RES = { video: 'lecture', outil: 'terminal', exercices: 'crayon', cours: 'livre', jeu: 'cible' };
const LIB_RES = { video: 'Vidéo', outil: 'Outil', exercices: 'Exercices', cours: 'Cours', jeu: 'Jeu' };
const STATUTS = { rendu: ['Rendu', 'c-vert'], passe: ['Passé', 'c-gris'], a_verifier: ['À vérifier', 'c-orange'], a_confirmer: ['À confirmer', 'c-orange'], facultatif: ['Facultatif', 'c-gris'] };

function tete(code, m, t) {
  const i = info(code);
  const ues = ueDuModule(code);
  const pr = progres(code);
  const futures = seancesDe(code, t);
  const h = lireHeures(m?.heures);
  const urlMoodle = urlSure((E.perso?.moodle || []).find((x) => x.code === code)?.url);
  return html`<section class="co-tete verre teinte carte" style="${styleModule(code)}; --teinte: var(--m)">
    <div class="co-tete-haut">
      <span class="icone-carree co-icone-xl" style="--c: var(--m)">${ic(i.icone)}</span>
      <div class="co-tete-titres">
        <div class="co-tete-sur"><span class="co-code">${code}</span> · ${estSae(code) ? 'Situation d’apprentissage et d’évaluation' : 'Ressource'}</div>
        <h2>${m?.titre || i.nom}</h2>
      </div>
      ${urlMoodle ? html`<a class="bouton verre petit co-moodle" href="${urlMoodle}" target="_blank" rel="noopener">Moodle${ic('externe')}</a>` : ''}
    </div>
    ${m?.resume ? html`<p class="co-resume">${m.resume}</p>` : ''}
    <div class="co-stats">
      ${h ? html`<div><b class="chiffres">${h.total}<small>${NB}h</small></b><span>au semestre</span></div>` : ''}
      ${h?.part ? html`<div><b class="chiffres">${h.part}<small>${NB}h</small></b><span>de ${h.quoi || 'TP'}</span></div>` : ''}
      <div><b class="chiffres">${futures.length}</b><span>séance${futures.length > 1 ? 's' : ''} à venir</span></div>
      ${pr.total ? html`<div><b class="chiffres" data-maitrise-total>${pr.n}<small>/${pr.total}</small></b><span>notions maîtrisées</span></div>` : ''}
    </div>
    ${ues.length ? html`<div class="co-poids">
      <div class="co-mini-titre">Poids dans chaque UE</div>
      ${ues.map((u) => html`<a class="co-poids-ligne" href="#/cours/notes" style="--u: var(--${u.couleur})">
        <span class="co-poids-ue chiffres">${u.code}</span><span class="co-poids-comp">${u.comp}</span>
        <span class="barre"><i style="--p:${u.coefs[code] / 100}; --c: var(--m)"></i></span>
        <b class="chiffres">${u.coefs[code]}${NB}%</b>
      </a>`)}
    </div>` : ''}
  </section>`;
}

function carteInfos(code) {
  const infos = (E.perso?.infos_cours || []).filter((x) => x.module === code && x.info);
  if (!infos.length) return '';
  return html`<section class="co-infos verre carte" style="--c-icone: var(--m)"><div class="carte-tete">${ic('info')}À savoir</div>
    <ul class="co-puces">${infos.map((x) => html`<li>${x.info}</li>`)}</ul></section>`;
}

function carteEvaluations(code, m, t) {
  const toutes = echeancesDe(code);
  const futures = toutes.filter((e) => aVenir(e, t)).sort((a, b) => quand(a) - quand(b));
  const passees = toutes.filter((e) => !aVenir(e, t)).sort((a, b) => (quand(b) || 0) - (quand(a) || 0)).slice(0, 4);
  const notesModule = (E.perso?.notes?.modules || []).find((x) => x.code === code);
  const notes = (notesModule?.evaluations || []).filter((ev) => ev.note != null);
  const pond = (E.but?.calcul_moyennes?.ponderations_internes_connues || []).find((x) => x.module === code);
  const annoncees = m?.evaluations_connues || [];
  const ligne = (e, avenir) => {
    const u = urlSure(e.url);
    const [lib, cls] = STATUTS[e.statut] || [];
    const sous = [dateEcheance(e, t), e.lieu, e.coef ? `coef ${frSimple(+e.coef)}` : '', e.duree ? `${e.duree}${NB}min` : ''].filter(Boolean).join(' · ');
    return html`<li class="co-ev${avenir ? '' : ' co-passe'}${e.type === 'eval' ? ' co-eval' : ''}">
      <span class="co-ev-icone">${ic(e.type === 'eval' ? 'cible' : e.fait ? 'coche' : 'coches')}</span>
      <div class="grow"><div class="titre">${u ? html`<a href="${u}" target="_blank" rel="noopener">${e.titre}</a>` : e.titre}</div>
        <div class="sous">${sous}</div>
        ${avenir && (e.consignes || e.details) ? html`<div class="co-ev-details">${e.consignes || e.details}</div>` : ''}</div>
      ${avenir && e.t ? html`<span class="puce ${urgence(quand(e) - t)} chiffres" data-compte="${quand(e)}"></span>` : lib ? html`<span class="puce ${cls}">${lib}</span>` : e.fait ? html`<span class="puce c-vert">Fait</span>` : ''}
    </li>`;
  };
  const vide = !futures.length && !passees.length && !notes.length && !pond && !annoncees.length && notesModule?.moyenne == null;
  return html`<section class="co-evals verre carte" style="${styleModule(code)}; --c-icone: var(--rouge)">
    <div class="carte-tete">${ic('cible')}Évaluations et rendus${notesModule?.moyenne != null ? html`<span class="espace"></span><span class="co-moy-module chiffres">${fr(notesModule.moyenne)}<small>/20</small></span>` : ''}</div>
    ${vide ? html`<p class="vide">Aucune évaluation annoncée pour l’instant.</p>` : ''}
    ${futures.length || passees.length ? html`<ul class="liste co-evs">${futures.map((e) => ligne(e, true))}${passees.map((e) => ligne(e, false))}</ul>` : ''}
    ${annoncees.length ? html`<div class="co-mini-titre">Annoncé</div><ul class="co-puces">${annoncees.map((a) => html`<li>${typeof a === 'string' ? a : [a.titre || a.nom, a.date ? dateMoyenne(a.date) : '', a.coef ? `coef ${frSimple(+a.coef)}` : ''].filter(Boolean).join(' · ')}</li>`)}</ul>` : ''}
    ${notes.length ? html`<div class="co-mini-titre">Notes reçues</div><ul class="co-tableau">${notes.map((n) => html`<li><span>${n.titre}${n.date ? html` <small>${dateMoyenne(n.date)}</small>` : ''}</span><span class="co-t-coef chiffres">${n.coef != null ? `×${frSimple(+n.coef)}` : ''}</span><b class="chiffres">${frSimple(+n.note)}<small>/${n.sur || 20}</small></b></li>`)}</ul>` : ''}
    ${pond ? html`<div class="co-mini-titre">Calcul de la note</div><ul class="co-tableau">${pond.evaluations.map((ev) => html`<li><span>${ev.nom}</span><span></span><b class="chiffres">×${frSimple(+ev.coef)}</b></li>`)}</ul>${pond.formule ? html`<p class="co-formule chiffres">${pond.formule}</p>` : ''}` : ''}
  </section>`;
}

function carteSeances(code, t) {
  const futures = seancesDe(code, t);
  const liste = futures.slice(0, 5);
  return html`<section class="co-seances verre carte" style="${styleModule(code)}; --c-icone: var(--m)">
    <div class="carte-tete">${ic('calendrier')}Prochaines séances<span class="espace"></span><a href="#/planning">Planning</a></div>
    ${liste.length ? html`<ul class="liste co-seances-liste">${liste.map((s, k) => {
      const enCours = s.t0 <= t;
      return html`<li class="${enCours ? 'co-en-cours' : ''}">
        <div class="co-date"><span>${jourCourt(s.t0)}</span><b class="chiffres">${numeroJour(s.t0)}</b></div>
        <div class="grow"><div class="titre"><span class="chiffres">${heure(s.t0)} – ${heure(s.t1)}</span>${s.type ? html` <span class="co-type">${LIBELLE_TYPE[s.type] || s.type}</span>` : ''}</div>
          <div class="sous">${[s.salles.join(', ') || s.lieu, s.profs.map(nomProf).join(', ')].filter(Boolean).join(' · ')}</div></div>
        ${enCours ? html`<span class="puce c-vert"><span class="point"></span>En cours</span>` : k === 0 ? html`<span class="puce chiffres" data-compte="${s.t0}"></span>` : ''}
      </li>`;
    })}</ul>${futures.length > liste.length ? html`<p class="co-plus">+${NB}${futures.length - liste.length} autre${futures.length - liste.length > 1 ? 's' : ''} d’ici la fin de l’emploi du temps chargé</p>` : ''}` : html`<p class="vide">Aucune séance dans l’emploi du temps chargé.</p>`}
  </section>`;
}

function carteMaitrise(code, m) {
  const items = m?.a_maitriser || [];
  if (!items.length) return '';
  const faits = maitrise(code);
  const pr = progres(code);
  return html`<section class="co-maitrise verre carte" style="${styleModule(code)}; --c-icone: var(--m)" data-code="${code}">
    <div class="carte-tete">${ic('valide')}À maîtriser<span class="espace"></span><span class="co-maitrise-n chiffres" data-maitrise-n>${pr.n}/${pr.total}</span>${anneau(pr.p, { taille: 30, epaisseur: 4, couleur: 'var(--m)' })}</div>
    <ul class="co-coches">${items.map((txt) => {
      const k = empreinte(txt);
      return html`<li><button type="button" class="co-coche" data-maitrise="${k}" aria-pressed="${oui(!!faits[k])}">
        <span class="co-rond">${ic('coche')}</span><span class="co-coche-texte">${majuscule(txt.replace(/^savoir\s+/i, ''))}</span></button></li>`;
    })}</ul>
  </section>`;
}

function carteReviser(code, m) {
  const l = m?.comment_reviser || [];
  if (!l.length) return '';
  return html`<section class="co-reviser verre carte" style="${styleModule(code)}; --c-icone: var(--m)">
    <div class="carte-tete">${ic('lampe')}Comment réviser</div>
    <ol class="co-etapes">${l.map((x) => html`<li>${x}</li>`)}</ol>
  </section>`;
}

function cartePieges(m) {
  const l = m?.pieges || [];
  if (!l.length) return '';
  return html`<section class="co-pieges verre carte" style="--c-icone: var(--orange)">
    <div class="carte-tete">${ic('alerte')}Pièges classiques</div>
    <ul class="co-pieges-liste">${l.map((x) => html`<li>${x}</li>`)}</ul>
  </section>`;
}

function chapitre(p) {
  const [a, ...b] = String(p.titre || '').split(/\s+[-–—]\s+/);
  const label = b.length ? a : (p.type || '').toUpperCase();
  const titre = b.length ? b.join(' – ') : a;
  const notions = p.notions || [];
  return html`<details class="co-chap">
    <summary><span class="co-chap-label">${label}</span><span class="co-chap-titre">${majuscule(titre)}</span><span class="co-chap-n chiffres">${notions.length}</span>${ic('bas', 'co-chevron')}</summary>
    <ul class="co-notions">${notions.map((n) => html`<li>${n}</li>`)}</ul>
  </details>`;
}

function carteProgression(code, m) {
  const prog = m?.progression || [];
  if (!prog.length) return '';
  const groupes = [['Cours', prog.filter((p) => !/^(td|tp)$/i.test(p.type))], ['TD et TP', prog.filter((p) => /^(td|tp)$/i.test(p.type))]];
  return html`<section class="co-progression verre carte" style="${styleModule(code)}; --c-icone: var(--m)">
    <div class="carte-tete">${ic('livre')}Progression<span class="espace"></span><span class="co-compte chiffres">${prog.length}</span></div>
    ${groupes.filter(([, l]) => l.length).map(([titre, l]) => html`<div class="co-prog-groupe"><div class="co-mini-titre">${titre}</div>${l.map(chapitre)}</div>`)}
  </section>`;
}

function carteRessources(code, m) {
  const l = m?.ressources || [];
  if (!l.length) return '';
  return html`<section class="co-ressources verre carte" style="${styleModule(code)}; --c-icone: var(--m)">
    <div class="carte-tete">${ic('globe')}Ressources<span class="espace"></span><span class="co-compte chiffres">${l.length}</span></div>
    <ul class="liste co-res">${l.map((r) => {
      const u = urlSure(r.url);
      const corps = html`<span class="co-res-icone">${ic(ICONE_RES[r.type] || 'document')}</span>
        <div class="grow"><div class="titre">${r.nom}</div><div class="co-res-meta">${[LIB_RES[r.type] || r.type, u ? domaine(u) : ''].filter(Boolean).join(' · ')}</div>${r.pourquoi ? html`<div class="sous">${r.pourquoi}</div>` : ''}</div>
        ${u ? ic('externe', 'co-ext') : ''}`;
      return html`<li>${u ? html`<a class="co-res-lien" href="${u}" target="_blank" rel="noopener">${corps}</a>` : html`<div class="co-res-lien">${corps}</div>`}</li>`;
    })}</ul>
  </section>`;
}

function vueFiche(code, t) {
  const m = moduleContenu(code);
  if (!m && !MODULES[code]) {
    return html`<div class="co-nav"><a class="co-retour" href="#/cours">${ic('gauche')}Modules</a></div>
      <section class="verre carte"><p class="vide">Ce module n’existe pas dans le programme du S1.</p></section>`;
  }
  const ordre = codesAffiches();
  const k = ordre.indexOf(code);
  const prec = k > 0 ? ordre[k - 1] : null;
  const suiv = k >= 0 && k < ordre.length - 1 ? ordre[k + 1] : null;
  return html`<div class="co-nav">
      <a class="co-retour" href="#/cours">${ic('gauche')}Modules</a><span class="espace"></span>
      ${prec ? html`<a class="bouton petit verre co-voisin" href="${lien(prec)}" style="${styleModule(prec)}" aria-label="Module précédent : ${info(prec).nom}">${ic('gauche')}<span class="chiffres">${prec}</span></a>` : ''}
      ${suiv ? html`<a class="bouton petit verre co-voisin" href="${lien(suiv)}" style="${styleModule(suiv)}" aria-label="Module suivant : ${info(suiv).nom}"><span class="chiffres">${suiv}</span>${ic('droite')}</a>` : ''}
    </div>
    <div class="co-fiche">
      ${tete(code, m, t)}
      <div class="co-col co-col-principale">${carteMaitrise(code, m)}${carteReviser(code, m)}${cartePieges(m)}${carteProgression(code, m)}</div>
      <div class="co-col co-col-cote">${carteInfos(code)}${carteEvaluations(code, m, t)}${carteSeances(code, t)}${carteRessources(code, m)}</div>
    </div>`;
}

// ==========================================================================
// Notes & UE
// ==========================================================================
const notesReelles = () => Object.fromEntries((E.perso?.notes?.modules || []).filter((x) => Number.isFinite(x.moyenne)).map((x) => [x.code, x.moyenne]));
function notesSimu() { const s = lire('simu', {}); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
function notesRetenues() {
  const n = notesReelles();
  for (const [k, v] of Object.entries(notesSimu())) if (Number.isFinite(v)) n[k] = v;
  return n;
}
const absences = () => E.perso?.notes?.absences || null;
const penalite = () => Math.max(0, (+absences()?.injustifiees_h || 0) - 8) * 0.05;
const ueReelle = (u) => (E.perso?.notes?.ues || []).find((x) => x.code === u.code) || null;
const ects = (u) => ueReelle(u)?.ects ?? (E.but?.ue_s1 || []).find((x) => x.code === u.code)?.ects ?? 5;

function calculUE(u, notes) {
  let somme = 0, notes_c = 0, reste = 0;
  const manquants = [];
  for (const [code, coef] of Object.entries(u.coefs)) {
    const n = notes[code];
    if (Number.isFinite(n)) { somme += coef * n; notes_c += coef; } else { reste += coef; manquants.push(code); }
  }
  const pen = penalite();
  const total = notes_c + reste;
  const moy = notes_c ? somme / notes_c - pen : null;
  const min = reste ? ((10 + pen) * total - somme) / reste : null;
  const max = reste ? (somme + 20 * reste) / total - pen : null;
  return { moy, min, max, manquants, pen };
}
function statut(m) {
  if (m == null) return ['c-gris', 'Pas de note'];
  if (m >= 10) return ['c-vert', 'Validée'];
  if (m >= 8) return ['c-orange', 'Compensable'];
  return ['c-rouge', 'En danger'];
}
const couleurStatut = (m) => (m == null ? 'var(--gris)' : m >= 10 ? 'var(--vert)' : m >= 8 ? 'var(--orange)' : 'var(--rouge)');
function texteMin(c) {
  const noms = c.manquants.map((x) => (estSae(x) ? x : info(x).court));
  if (!c.manquants.length) {
    if (c.moy == null) return html``;
    return c.moy >= 10 ? html`Toutes les notes sont là · marge <b class="chiffres">+${fr(c.moy - 10)}</b>` : html`Toutes les notes sont là · il manque <b class="chiffres">${fr(10 - c.moy)}${NB}pt</b>`;
  }
  if (c.min <= 0) return html`Acquise même avec 0 en ${noms.join(', ')}`;
  if (c.min > 20) return html`10 hors d’atteinte : au mieux <b class="chiffres">${fr(c.max)}</b> avec 20 partout`;
  return html`Pour valider : <b class="chiffres">${fr(c.min)}</b> de moyenne en ${noms.join(', ')}`;
}

function carteUE(u, notes) {
  const c = calculUE(u, notes);
  const reelle = ueReelle(u)?.moyenne;
  const [cls, lib] = statut(c.moy ?? (Number.isFinite(reelle) ? reelle : null));
  const entrees = Object.entries(u.coefs);
  const partRes = entrees.filter(([k]) => !estSae(k)).reduce((a, [, v]) => a + v, 0);
  const partSae = entrees.filter(([k]) => estSae(k)).reduce((a, [, v]) => a + v, 0);
  return html`<article class="co-ue verre carte" data-ue="${u.code}" style="--u: var(--${u.couleur})">
    <div class="co-ue-tete"><span class="co-ue-code chiffres">${u.code}</span><span class="co-ue-ects chiffres">${ects(u)}${NB}ECTS</span><span class="espace"></span><span class="puce ${cls}" data-badge>${lib}</span></div>
    <h3 class="co-ue-comp">${u.comp}</h3>
    <div class="co-ue-moy">
      <div class="co-ue-grand"><b class="chiffres${c.moy == null ? ' co-nul' : ''}" data-sim>${fr(c.moy)}</b><span>Simulée</span></div>
      <div class="co-ue-reel"><b class="chiffres${Number.isFinite(reelle) ? '' : ' co-nul'}">${fr(Number.isFinite(reelle) ? reelle : null)}</b><span>Relevé</span></div>
    </div>
    <div class="co-jauge" data-jauge style="--p:${c.moy == null ? 0 : Math.min(Math.max(c.moy / 20, 0), 1).toFixed(4)}; --c:${couleurStatut(c.moy)}" aria-hidden="true"><i></i><span class="co-seuil" style="--s:.4"></span><span class="co-seuil co-seuil-10" style="--s:.5"></span></div>
    <div class="co-segments" aria-hidden="true">${entrees.map(([k, v]) => html`<i style="--w:${v}; --c: var(--${info(k).couleur})"></i>`)}</div>
    <div class="co-seg-legende chiffres"><span>Ressources ${partRes}${NB}%</span><span>SAÉ ${partSae}${NB}%</span></div>
    <ul class="co-ue-mods">${entrees.map(([k, v]) => html`<li style="${styleModule(k)}"><a href="${lien(k)}"><span class="co-pastille"></span>${estSae(k) ? k : info(k).court}</a><span class="co-ue-coef chiffres">${v}</span><b class="chiffres${Number.isFinite(notes[k]) ? '' : ' co-sans'}" data-note="${k}">${fr(notes[k])}</b></li>`)}</ul>
    <p class="co-ue-min" data-min>${texteMin(c)}</p>
  </article>`;
}

function resumeSimu(notes) {
  return UES.map((u) => {
    const c = calculUE(u, notes);
    return html`<span class="co-resume-ue ${statut(c.moy)[0]}" data-resume="${u.code}"><small>${u.code.replace('UE ', '')}</small><b class="chiffres">${fr(c.moy)}</b></span>`;
  });
}

function carteSimulateur() {
  const simu = notesSimu();
  const reelles = notesReelles();
  const codes = CODES.filter((c) => ueDuModule(c).length);
  const ligne = (c) => {
    const i = info(c);
    const ues = ueDuModule(c);
    return html`<li style="${styleModule(c)}">
      <span class="icone-carree co-petite-icone" style="--c: var(--m)">${ic(i.icone)}</span>
      <div class="grow"><div class="titre"><span class="co-code">${estSae(c) ? c.replace('SAÉ ', '') : c}</span> ${i.nom}</div>
        <div class="sous chiffres">${ues.map((u) => `${u.comp} ${u.coefs[c]}`).join(' · ')}${Number.isFinite(reelles[c]) ? ` · relevé ${fr(reelles[c])}` : ''}</div></div>
      <label class="co-champ"><input class="co-note chiffres" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" spellcheck="false" data-simu="${c}" value="${Number.isFinite(simu[c]) ? frSimple(simu[c]) : ''}" placeholder="${Number.isFinite(reelles[c]) ? frSimple(reelles[c]) : '—'}" aria-label="Note de ${i.nom} sur 20"><span>/20</span></label>
    </li>`;
  };
  return html`<section class="co-simu verre carte">
    <div class="carte-tete" style="--c-icone: var(--accent)">${ic('crayon')}Simulateur<span class="espace"></span><button class="lien" type="button" data-simu-raz>Tout effacer</button></div>
    <div class="co-resume-simu" data-resume-simu>${resumeSimu(notesRetenues())}</div>
    <div class="co-mini-titre">Ressources</div>
    <ul class="liste co-simu-liste">${codes.filter((c) => !estSae(c)).map(ligne)}</ul>
    <div class="co-mini-titre">SAÉ</div>
    <ul class="liste co-simu-liste">${codes.filter(estSae).map(ligne)}</ul>
    <p class="co-note-bas">Note sur 20 au pas de 0,25. Sans saisie, la moyenne du relevé est utilisée. Estimation : IUT${NB}Notes fait foi.</p>
  </section>`;
}

function carteRegles() {
  return html`<section class="co-regles verre carte" style="--c-icone: var(--indigo)">
    <div class="carte-tete">${ic('diplome')}Règles du BUT<span class="espace"></span>${E.but ? html`<button class="lien" type="button" data-regles>Détail</button>` : ''}</div>
    <ul class="co-regles-liste">
      <li><b>UE ≥ 10</b><span>acquise et capitalisée, avec ses 5${NB}ECTS.</span></li>
      <li><b>Compensation</b><span>seulement entre S1 et S2 d’une même compétence (RCUE ≥ 10).</span></li>
      <li><b>Passage en BUT2</b><span>au moins 4${NB}RCUE sur 6 à 10, aucun sous 8.</span></li>
      <li><b>Absences</b><span>−0,05${NB}pt/h sur chaque UE au-delà de 8${NB}h non justifiées ; justificatif sous 48${NB}h.</span></li>
    </ul>
  </section>`;
}

function carteAbsences() {
  const a = absences();
  if (!a) {
    return html`<section class="co-absences verre carte" style="--c-icone: var(--orange)"><div class="carte-tete">${ic('horloge')}Absences</div><p class="vide">Pas encore de relevé d’absences.</p></section>`;
  }
  const inj = +a.injustifiees_h || 0;
  const pen = penalite();
  const couleur = inj >= 8 ? 'var(--rouge)' : inj >= 5 ? 'var(--orange)' : 'var(--vert)';
  const liste = [...(a.liste || [])].sort((x, y) => String(y.debut).localeCompare(String(x.debut))).slice(0, 3);
  const h1 = (n) => (n == null ? '—' : frSimple(+n));
  return html`<section class="co-absences verre carte" style="--c-icone: var(--orange)">
    <div class="carte-tete">${ic('horloge')}Absences<span class="espace"></span>${a.periode ? html`<span class="co-periode">${a.periode}</span>` : ''}</div>
    <div class="co-abs-chiffres">
      <div class="${inj > 0 ? 'co-alerte' : ''}"><b class="chiffres">${h1(inj)}<small>${NB}h</small></b><span>non justifiées</span></div>
      <div><b class="chiffres">${h1(a.justifiees_h)}<small>${NB}h</small></b><span>justifiées</span></div>
      <div><b class="chiffres">${h1(a.retards)}</b><span>retard${+a.retards > 1 ? 's' : ''}</span></div>
      ${a.presences != null ? html`<div><b class="chiffres">${h1(a.presences)}</b><span>présences</span></div>` : ''}
    </div>
    <div class="barre co-abs-barre"><i style="--p:${Math.min(inj / 8, 1).toFixed(3)}; --c:${couleur}"></i></div>
    <div class="co-abs-legende chiffres"><span>${inj < 8 ? `${frSimple(8 - inj)}${NB}h avant pénalité` : `−${fr(pen)}${NB}pt sur chaque UE`}</span><span>tolérance 8${NB}h</span></div>
    ${liste.length ? html`<ul class="liste co-abs-liste">${liste.map((x) => html`<li style="${styleModule(x.module)}">
      <span class="module-tag">${info(x.module).court}</span>
      <div class="grow chiffres">${x.debut ? `${dateMoyenne(x.debut)} · ${heure(x.debut)}${x.fin ? ` – ${heure(x.fin)}` : ''}` : ''}</div>
      <span class="puce ${x.justifiee ? 'c-vert' : 'c-rouge'}">${x.justifiee ? 'Justifiée' : 'Non justifiée'}</span></li>`)}</ul>` : ''}
  </section>`;
}

function vueNotes() {
  const notes = notesRetenues();
  return html`${barre(1)}
    <div class="co-notes">
      <div class="co-notes-principal">
        <div class="co-ues-grille">${UES.map((u) => carteUE(u, notes))}</div>
        <div class="co-notes-bas">${carteRegles()}${carteAbsences()}</div>
      </div>
      <div class="co-notes-cote">${carteSimulateur()}</div>
    </div>`;
}

function feuilleRegles() {
  const b = E.but || {};
  const bloc = (titre, l) => (l?.length ? html`<h3 class="co-f-titre">${titre}</h3><ul class="liste co-f-liste">${l.map((r) => html`<li><div class="grow"><div class="titre">${r.titre}</div><div class="co-f-texte">${r.texte}</div>${r.source ? html`<div class="co-f-source">${r.source}</div>` : ''}</div></li>`)}</ul>` : '');
  ouvrirFeuille(html`<h2>Règles du BUT</h2><p class="co-f-sous">Semestre 1 · textes officiels de l’IUT</p>${bloc('Validation', b.regles_validation)}${bloc('Absences', b.absences)}`, { titre: 'Règles du BUT' });
}

// Mise à jour en place des cartes d'UE pendant la saisie (le champ garde le focus).
function majNotes(racine) {
  const notes = notesRetenues();
  for (const u of UES) {
    const el = racine.querySelector(`[data-ue="${u.code}"]`);
    if (!el) continue;
    const c = calculUE(u, notes);
    const [cls, lib] = statut(c.moy ?? (Number.isFinite(ueReelle(u)?.moyenne) ? ueReelle(u).moyenne : null));
    const sim = el.querySelector('[data-sim]');
    sim.textContent = fr(c.moy);
    sim.classList.toggle('co-nul', c.moy == null);
    const badge = el.querySelector('[data-badge]');
    badge.className = `puce ${cls}`; badge.textContent = lib;
    const j = el.querySelector('[data-jauge]');
    j.style.setProperty('--p', c.moy == null ? 0 : Math.min(Math.max(c.moy / 20, 0), 1).toFixed(4));
    j.style.setProperty('--c', couleurStatut(c.moy));
    el.querySelectorAll('[data-note]').forEach((n) => { const v = notes[n.dataset.note]; n.textContent = fr(v); n.classList.toggle('co-sans', !Number.isFinite(v)); });
    el.querySelector('[data-min]').innerHTML = String(texteMin(c));
    const r = racine.querySelector(`[data-resume="${u.code}"]`);
    if (r) { r.className = `co-resume-ue ${statut(c.moy)[0]}`; r.querySelector('b').textContent = fr(c.moy); }
  }
}

function lireNote(v) {
  const s = String(v).trim().replace(',', '.').replace(/\/\s*20$/, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 20) return undefined;
  return n;
}
const arrondir = (n) => Math.min(20, Math.max(0, Math.round(n * 4) / 4));

// ==========================================================================
// Vue
// ==========================================================================
function mode(params) {
  const p = params[0];
  if (!p) return { quoi: 'grille' };
  if (p === 'notes') return { quoi: 'notes' };
  return { quoi: 'fiche', code: MODULES[p] ? p : codeModule(p) || p };
}
const cleEtat = () => {
  const t = maintenant();
  return `${E.seances.find((s) => s.t1 > t)?.id}|${E.echeances.find((e) => e.t && e.t > t - 2 * HEURE)?.id}`;
};

export default {
  id: 'cours',
  titre: 'Cours',
  surtitre(_, params = []) {
    const m = mode(params);
    if (m.quoi === 'notes') return E.perso?.notes?.releve ? `Semestre 1 · ${E.perso.notes.releve.toLowerCase()}` : 'Semestre 1';
    if (m.quoi === 'fiche') return `${m.code} · ${info(m.code).court}`;
    return `Semestre 1 · ${codesAffiches().length} modules`;
  },
  rendre(_, params = []) {
    const m = mode(params);
    const t = maintenant();
    if (m.quoi === 'notes') return vueNotes();
    if (m.quoi === 'fiche') return vueFiche(m.code, t);
    return vueGrille(t);
  },
  monter(racine, _, params = []) {
    const m = mode(params);
    racine.dataset.cle = cleEtat();
    racine.dataset.mode = m.quoi;
    const clic = (e) => {
      const aller = e.target.closest('[data-aller]');
      if (aller) {
        const seg = aller.closest('.segment');
        if (location.hash === aller.dataset.aller) return;
        seg?.style.setProperty('--i', aller.dataset.i);
        seg?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', oui(b === aller)));
        const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
        setTimeout(() => { location.hash = aller.dataset.aller; }, reduit ? 0 : 200);
        return;
      }
      const coche = e.target.closest('[data-maitrise]');
      if (coche) {
        const carte = coche.closest('[data-code]');
        const code = carte.dataset.code;
        const faits = maitrise(code);
        const k = coche.dataset.maitrise;
        if (faits[k]) delete faits[k]; else faits[k] = Date.now();
        ecrire(cleMaitrise(code), faits);
        coche.setAttribute('aria-pressed', oui(!!faits[k]));
        const pr = progres(code);
        carte.querySelector('[data-maitrise-n]').textContent = `${pr.n}/${pr.total}`;
        const jauge = carte.querySelector('.anneau .jauge');
        if (jauge) jauge.setAttribute('stroke-dashoffset', (+jauge.dataset.circ * (1 - pr.p)).toFixed(2));
        const total = racine.querySelector('[data-maitrise-total]');
        if (total) total.innerHTML = String(html`${pr.n}<small>/${pr.total}</small>`);
        return;
      }
      if (e.target.closest('[data-regles]')) { feuilleRegles(); return; }
      if (e.target.closest('[data-simu-raz]')) {
        ecrire('simu', null);
        racine.querySelectorAll('[data-simu]').forEach((i) => { i.value = ''; i.classList.remove('co-invalide'); });
        majNotes(racine);
      }
    };
    const saisie = (e) => {
      const i = e.target.closest?.('[data-simu]');
      if (!i) return;
      const n = lireNote(i.value);
      i.classList.toggle('co-invalide', n === undefined);
      if (n === undefined) return;
      const simu = notesSimu();
      if (n == null) delete simu[i.dataset.simu]; else simu[i.dataset.simu] = e.type === 'change' ? arrondir(n) : n;
      if (e.type === 'change' && n != null) i.value = frSimple(arrondir(n));
      ecrire('simu', Object.keys(simu).length ? simu : null);
      majNotes(racine);
    };
    const touche = (e) => {
      const i = e.target.closest?.('[data-simu]');
      if (!i) return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const n = lireNote(i.value);
        const base = Number.isFinite(n) ? n : lireNote(i.placeholder) ?? 10;
        i.value = frSimple(arrondir((Number.isFinite(base) ? base : 10) + (e.key === 'ArrowUp' ? 0.25 : -0.25)));
        i.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const champs = [...racine.querySelectorAll('[data-simu]')];
        const suivant = champs[champs.indexOf(i) + 1];
        if (suivant) suivant.focus(); else i.blur();
      }
    };
    racine.addEventListener('click', clic);
    racine.addEventListener('input', saisie);
    racine.addEventListener('change', saisie);
    racine.addEventListener('keydown', touche);
    return () => {
      racine.removeEventListener('click', clic);
      racine.removeEventListener('input', saisie);
      racine.removeEventListener('change', saisie);
      racine.removeEventListener('keydown', touche);
    };
  },
  minute(racine) {
    if (racine.dataset.mode === 'notes') return;
    if (racine.dataset.cle !== cleEtat()) document.dispatchEvent(new CustomEvent('donnees', { detail: 'minute' }));
  },
};
