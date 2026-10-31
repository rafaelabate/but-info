// À faire : rendus groupés façon Rappels, contrôles à venir, agenda, filtres par module.
import { html, urlSure, pl } from '../html.js';
import { ic, vibrer, ile } from '../ui.js';
import { E, maintenant, basculerFait, controles } from '../donnees.js';
import {
  TZ, MIN, HEURE, JOUR, heure, duree, echeanceLisible, jourRelatif, dateMoyenne, dateCourte, dateLongue,
  nomJour, jourCourt, numeroJour, ecartJours, cleJour, ajouterJours, depuisCle, lundi, majuscule,
} from '../temps.js';
import { info, styleModule, MODULES } from '../cours.js';
import { lire, ecrire } from '../stockage.js';

const CLE_FILTRE = 'afaire:filtre';
const CLE_REPLIS = 'afaire:replis';
const ORDRE_MODULES = Object.keys(MODULES);
const GROUPES = [
  ['retard', 'En retard'],
  ['proche', 'Aujourd’hui et demain'],
  ['semaine', 'Cette semaine'],
  ['plustard', 'Plus tard'],
  ['sansdate', 'Sans date'],
  ['faits', 'Faits'],
];
const fmtMois = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, month: 'short' });
const mois = (d) => fmtMois.format(new Date(d)).replace('.', '');

const ouverts = new Set();      // lignes dépliées : survivent aux re-rendus
const enAttente = new Map();    // coches en cours d'animation (id -> minuterie)
let defilFiltres = null;        // position horizontale des filtres entre deux rendus

// ---------- Calculs ----------
function bornes(t) {
  const auj = cleJour(t);
  return {
    finDemain: depuisCle(ajouterJours(auj, 2)).getTime(),
    finSemaine: depuisCle(ajouterJours(lundi(auj), 7)).getTime(),
  };
}
const RETARD_MAX = 30 * JOUR;
function groupeDe(e, t, b) {
  if (e.fait) return 'faits';
  if (!e.t) return 'sansdate';
  if (e.t <= t) return e.statut === 'facultatif' || t - e.t > RETARD_MAX ? 'faits' : 'retard';
  if (e.t < b.finDemain) return 'proche';
  if (e.t < b.finSemaine) return 'semaine';
  return 'plustard';
}
const devoirs = () => E.echeances.filter((e) => e.type === 'devoir');
const enRetard = (t) => devoirs().filter((e) => !e.fait && e.t && e.t <= t && e.statut !== 'facultatif' && t - e.t <= RETARD_MAX);
const evenements = (t) => E.echeances.filter((e) => e.type === 'evenement' && (!e.t || e.t > t - 6 * HEURE));
function estOuverte(e, t) {
  if (e.type === 'devoir') return !e.fait;
  if (e.type === 'eval') return !!e.t && e.t > t - 2 * HEURE;
  return !!e.t && e.t > t;
}
function filtreActif() {
  const f = lire(CLE_FILTRE, 'tout');
  return f !== 'tout' && E.echeances.some((e) => e.module === f) ? f : 'tout';
}
const urgence = (ms) => (ms < JOUR ? 'af-rouge' : ms < 3 * JOUR ? 'af-orange' : '');
function texteReste(ms) {
  const a = Math.abs(ms);
  const s = a < MIN ? '< 1 min' : duree(a);
  return ms < 0 ? `−${s}` : s;
}
const coef = (c) => String(c).replace('.', ',');

function quand(e, t) {
  if (!e.t) return e.t0 && e.t0 <= t ? `ouvert depuis le ${dateCourte(e.t0)}` : 'sans date limite';
  if (e.semaine) return `semaine du ${dateMoyenne(e.t0 || e.t)}`;
  if (e.heure_inconnue) return `${jourRelatif(e.t, t)} · heure à confirmer`;
  const n = ecartJours(cleJour(t), cleJour(e.t));
  return n >= 2 && n < 7 ? `${jourCourt(e.t)} ${heure(e.t)}` : echeanceLisible(e.t, t);
}
function ouvre(t0, t) {
  const n = ecartJours(cleJour(t), cleJour(t0));
  if (n === 0) return `Ouvre à ${heure(t0)}`;
  if (n < 7) return `Ouvre ${jourRelatif(t0, t)}`;
  return `Ouvre le ${dateCourte(t0)}`;
}
function puceStatut(e, t) {
  if (e.fait) return e.statut === 'rendu'
    ? html`<span class="puce c-vert">${ic('coche')}Rendu</span>`
    : html`<span class="puce c-vert">Fait</span>`;
  if (e.t0 && e.t0 > t) return html`<span class="puce contour">${ouvre(e.t0, t)}</span>`;
  switch (e.statut) {
    case 'a_verifier': return html`<span class="puce c-orange" title="Vu sur Moodle, pas encore dans ton relevé">À vérifier</span>`;
    case 'facultatif': return html`<span class="puce c-gris">Facultatif</span>`;
    case 'a_confirmer': return html`<span class="puce c-orange">À confirmer</span>`;
    case 'passe': return html`<span class="puce c-gris">Clos</span>`;
    default: return html`<span class="puce af-deposer">À déposer</span>`;
  }
}

// ---------- Blocs ----------
function resume(t) {
  const n7 = devoirs().filter((e) => !e.fait && e.t && e.t > t && e.t <= t + 7 * JOUR).length;
  const nc = controles().length;
  const nr = enRetard(t).length;
  const tuile = (n, libelle, cible, classe = '') => html`<button class="af-kpi ${n ? classe : 'nul'}" type="button" data-aller="${cible}">
    <b class="chiffres">${n}</b><span>${libelle}</span></button>`;
  return html`<section class="af-resume verre" aria-label="En bref">
    ${tuile(n7, 'à rendre sous 7 jours', 'af-rendus')}
    ${tuile(nc, nc > 1 ? 'contrôles à venir' : 'contrôle à venir', 'af-controles')}
    ${tuile(nr, 'en retard', 'af-g-retard', 'alerte')}
  </section>`;
}

function filtres(f, t) {
  const presents = ORDRE_MODULES.filter((c) => E.echeances.some((e) => e.module === c));
  if (presents.length < 2) return '';
  const nb = (c) => E.echeances.filter((e) => (c === 'tout' || e.module === c) && estOuverte(e, t)).length;
  const puce = (c, libelle, style = '', titre = '') => {
    const n = nb(c);
    return html`<button class="af-filtre${c === 'tout' ? ' af-tout' : ''}" type="button" data-filtre="${c}" aria-pressed="${f === c ? 'true' : 'false'}" style="${style}" ${titre ? html`title="${titre}"` : ''}>${libelle}${n ? html`<span class="af-n chiffres">${n}</span>` : ''}</button>`;
  };
  return html`<div class="af-filtres" role="toolbar" aria-label="Filtrer par module">
    ${puce('tout', 'Tout')}${presents.map((c) => puce(c, info(c).court, styleModule(c), info(c).nom))}
  </div>`;
}

function ligne(e, t) {
  const url = urlSure(e.url);
  const plus = !!(e.consignes || url || (e.details && e.details.length > 60));
  const ouvert = plus && ouverts.has(e.id);
  const confirme = e.statut === 'rendu';
  const retard = !e.fait && e.t && e.t <= t;
  const ms = e.t ? e.t - t : 0;
  const reste = e.t && !e.fait
    ? html`<span class="af-reste chiffres ${urgence(ms)}" data-af-reste="${e.t}" title="${ms < 0 ? 'Échéance dépassée' : 'Temps restant'}">${texteReste(ms)}</span>`
    : '';
  const corps = html`
      <span class="af-titre">${e.titre}</span>
      <span class="af-meta">
        <span class="module-tag">${info(e.module).court}</span>
        <span class="af-quand${retard ? ' af-rouge' : ''}">${quand(e, t)}</span>
        ${e.enDirect ? html`<span class="af-source" title="Présent sur le calendrier Moodle">Moodle</span>` : ''}
      </span>
      ${e.details ? html`<span class="af-note">${e.details}</span>` : ''}`;
  return html`<li class="af-ligne${e.fait ? ' fait' : ''}${plus ? ' af-depliable' : ''}${ouvert ? ' ouvert' : ''}" data-id="${e.id}" style="${styleModule(e.module)}">
    <button class="af-case" type="button" role="checkbox" data-case="${e.id}" aria-checked="${e.fait ? 'true' : 'false'}"
      aria-label="${e.titre}" ${confirme ? html`disabled title="Rendu confirmé par Moodle"` : ''}>${ic('coche')}</button>
    ${plus
      ? html`<button class="af-corps" type="button" aria-expanded="${ouvert ? 'true' : 'false'}">${corps}</button>`
      : html`<div class="af-corps">${corps}</div>`}
    <span class="af-droite">${reste}${puceStatut(e, t)}</span>
    ${plus ? html`<div class="af-plus"><div><div class="af-plus-int">
      ${e.consignes ? html`<div class="af-consignes"><span class="af-etiquette">Consignes</span><p>${e.consignes}</p></div>` : ''}
      <div class="af-actions">
        ${e.t ? html`<span class="af-limite chiffres">${ic('horloge')}${e.semaine ? `Semaine du ${dateMoyenne(e.t0 || e.t)}` : `${majuscule(dateLongue(e.t))}${e.heure_inconnue ? '' : `, ${heure(e.t)}`}`}</span>` : ''}
        ${e.t0 && e.t0 > t ? html`<span class="af-limite chiffres">${ic('sablier')}Dépôt ouvert le ${dateMoyenne(e.t0)} à ${heure(e.t0)}</span>` : ''}
        ${url ? html`<a class="bouton petit verre af-ouvrir" href="${url}" target="_blank" rel="noopener">Ouvrir${ic('externe')}</a>` : ''}
      </div>
    </div></div></div>` : ''}
  </li>`;
}

function section(id, nom, liste, t, replis) {
  if (!liste.length) return '';
  const replie = !!replis[id];
  return html`<section class="af-section af-g-${id}" id="af-g-${id}" data-groupe="${id}" ${replie ? html`data-replie` : ''}>
    <h2 class="af-tete"><button type="button" data-replier aria-expanded="${replie ? 'false' : 'true'}">
      <span class="af-tete-nom">${nom}</span><span class="af-nb chiffres">${liste.length}</span>${ic('bas', 'af-chevron')}
    </button></h2>
    <div class="af-carte verre"><ul class="af-liste">${liste.map((e) => ligne(e, t))}</ul></div>
  </section>`;
}

function carteControle(c, t, premier) {
  const debut = c.t0 || c.t;
  const n = ecartJours(cleJour(t), cleJour(debut));
  const enCours = c.t0 && c.t && c.t0 <= t && t < c.t && !c.heure_inconnue && !c.semaine;
  let gros, legende;
  if (enCours) { gros = 'En cours'; legende = `jusqu’à ${heure(c.t)}`; }
  else if (n <= 0) { gros = 'Jour J'; legende = c.heure_inconnue ? 'heure à confirmer' : heure(debut); }
  else {
    gros = `J-${n}`;
    legende = c.semaine ? 'au plus tôt' : n === 1 ? 'demain' : n < 7 ? nomJour(debut) : pl(Math.floor(n / 7), 'semaine');
  }
  let date;
  if (c.semaine) date = `Semaine du ${dateMoyenne(debut)}`;
  else if (c.heure_inconnue) date = `${majuscule(dateMoyenne(debut))} · heure à confirmer`;
  else date = `${majuscule(dateMoyenne(debut))} · ${heure(debut)}${c.t0 && c.t > c.t0 ? ` – ${heure(c.t)}` : ''}`;
  const url = urlSure(c.url);
  return html`<article class="af-controle verre${premier ? ' teinte' : ''}" style="${styleModule(c.module)}; --teinte: var(--m)">
    <div class="af-j${gros.length > 4 ? ' long' : ''}"><b class="chiffres">${gros}</b><span>${legende}</span></div>
    <div class="af-c-corps">
      <div class="af-c-tags">
        <span class="module-tag">${info(c.module).court}</span>
        ${c.statut === 'a_confirmer' ? html`<span class="puce c-orange">À confirmer</span>` : ''}
        ${url ? html`<a class="bouton rond petit af-c-lien" href="${url}" target="_blank" rel="noopener" aria-label="Ouvrir l’annonce">${ic('externe')}</a>` : ''}
      </div>
      <h3 class="af-c-titre">${c.titre}</h3>
      <div class="af-c-infos chiffres">
        <span class="af-c-date${c.heure_inconnue || c.semaine ? ' incertain' : ''}">${ic('horloge')}${date}</span>
        ${c.lieu ? html`<span>${ic('epingle')}${c.lieu}</span>` : ''}
        ${c.duree ? html`<span>${ic('sablier')}${duree(c.duree * MIN)}</span>` : ''}
        ${c.coef != null && c.coef !== '' ? html`<span class="af-coef">coef ${coef(c.coef)}</span>` : ''}
      </div>
      ${c.details || c.consignes ? html`<div class="af-c-notes">
        ${c.details ? html`<p>${c.details}</p>` : ''}
        ${c.consignes ? html`<p><span class="af-etiquette">Consignes</span>${c.consignes}</p>` : ''}
      </div>` : ''}
    </div>
  </article>`;
}

function blocControles(liste, t) {
  return html`<section class="af-section af-bloc-controles" id="af-controles">
    <h2 class="af-tete"><span class="af-tete-fixe"><span class="af-tete-nom">Contrôles</span>${liste.length ? html`<span class="af-nb chiffres">${liste.length}</span>` : ''}</span></h2>
    ${liste.length
      ? html`<div class="af-controles${liste.length === 1 ? ' seul' : ''}">${liste.map((c, i) => carteControle(c, t, i === 0))}</div>`
      : html`<div class="af-carte verre"><p class="vide af-vide">Aucun contrôle annoncé.</p></div>`}
  </section>`;
}

function ligneAgenda(e, t) {
  const d = e.t0 || e.t;
  const url = urlSure(e.url);
  let horaire = '';
  if (d && !e.heure_inconnue && !e.semaine) {
    horaire = e.t0 && e.t && e.t > e.t0 ? `${heure(e.t0)} – ${heure(e.t)}` : !e.t0 && e.t ? `jusqu’à ${heure(e.t)}` : heure(d);
  }
  const note = e.consignes || e.details;
  return html`<li class="af-ag" style="${styleModule(e.module)}">
    <div class="af-ag-date chiffres">${d
      ? html`<span>${jourCourt(d)}</span><b>${numeroJour(d)}</b><i>${mois(d)}</i>`
      : html`<span>—</span>`}</div>
    <div class="grow">
      <div class="af-ag-titre">${e.titre}</div>
      <div class="af-meta">
        <span class="module-tag">${info(e.module).court}</span>
        ${horaire ? html`<span class="chiffres">${horaire}</span>` : ''}
        ${e.statut === 'facultatif' ? html`<span class="puce c-gris">Facultatif</span>` : ''}
        ${e.enDirect ? html`<span class="af-source">Moodle</span>` : ''}
      </div>
      ${note ? html`<p class="af-ag-note">${note}</p>` : ''}
    </div>
    ${url ? html`<a class="bouton rond petit af-ag-lien" href="${url}" target="_blank" rel="noopener" aria-label="Ouvrir « ${e.titre} »">${ic('externe')}</a>` : ''}
  </li>`;
}

function blocAgenda(liste, t) {
  if (!liste.length) return '';
  return html`<section class="af-section af-bloc-agenda" id="af-agenda">
    <h2 class="af-tete"><span class="af-tete-fixe"><span class="af-tete-nom">Agenda</span><span class="af-nb chiffres">${liste.length}</span></span></h2>
    <div class="af-carte verre"><ul class="af-liste af-agenda">${liste.map((e) => ligneAgenda(e, t))}</ul></div>
  </section>`;
}

// ---------- État (pour savoir quand re-rendre à la minute) ----------
function cleEtat() {
  const t = maintenant();
  const b = bornes(t);
  return [
    cleJour(t),
    devoirs().map((e) => groupeDe(e, t, b)[0]).join(''),
    controles().map((c) => ((c.t0 || c.t) <= t ? 1 : 0)).join(''),
    evenements(t).length,
  ].join('|');
}

// ---------- Vue ----------
export default {
  id: 'afaire',
  titre: 'À faire',
  surtitre() {
    const t = maintenant();
    const { finSemaine } = bornes(t);
    const n = devoirs().filter((e) => !e.fait && e.t && e.t > t && e.t < finSemaine).length;
    const c = controles().length;
    const r = enRetard(t).length;
    return [
      n ? `${pl(n, 'rendu')} cette semaine` : 'Aucun rendu cette semaine',
      c ? pl(c, 'contrôle') : '',
      r ? `${r} en retard` : '',
    ].filter(Boolean).join(' · ');
  },
  rendre() {
    const t = maintenant();
    const b = bornes(t);
    const f = filtreActif();
    const garde = (e) => f === 'tout' || e.module === f;
    const replis = lire(CLE_REPLIS, { faits: true }) || { faits: true };

    const groupes = Object.fromEntries(GROUPES.map(([id]) => [id, []]));
    for (const e of devoirs().filter(garde)) groupes[groupeDe(e, t, b)].push(e);
    groupes.faits.sort((x, y) => (y.t ?? 0) - (x.t ?? 0));
    const sections = GROUPES.map(([id, nom]) => section(id, nom, groupes[id], t, replis)).filter((s) => s !== '');
    const ctrl = controles().filter(garde);
    const agenda = evenements(t).filter(garde);

    const vide = f === 'tout'
      ? html`<div class="af-carte verre"><p class="vide af-vide">Aucun rendu en vue.</p></div>`
      : html`<div class="af-carte verre"><p class="vide af-vide">Aucun rendu pour ${info(f).nom}.</p></div>`;

    return html`<div class="af">
      <div class="af-principal">
        ${resume(t)}
        ${filtres(f, t)}
        <div class="af-groupes" id="af-rendus">${sections.length ? sections : vide}</div>
      </div>
      <div class="af-cote">
        ${blocControles(ctrl, t)}
        ${blocAgenda(agenda, t)}
      </div>
    </div>`;
  },
  monter(racine) {
    racine.dataset.cle = cleEtat();
    const barre = racine.querySelector('.af-filtres');
    if (barre) {
      if (defilFiltres != null) barre.scrollLeft = defilFiltres;
      else {
        const actif = barre.querySelector('[aria-pressed="true"]');
        if (actif && actif.offsetLeft + actif.offsetWidth > barre.clientWidth) barre.scrollLeft = actif.offsetLeft - 16;
      }
      defilFiltres = null;
    }

    const cocher = (bouton) => {
      const id = bouton.dataset.case;
      const e = E.echeances.find((x) => x.id === id);
      if (!e || bouton.disabled) return;
      const coche = bouton.getAttribute('aria-checked') !== 'true';
      bouton.setAttribute('aria-checked', coche ? 'true' : 'false');
      bouton.closest('.af-ligne')?.classList.toggle('fait', coche);
      bouton.classList.remove('af-pop');
      void bouton.offsetWidth;
      bouton.classList.add('af-pop');
      vibrer(coche ? [8, 40, 12] : 6);
      // Deuxième appui pendant l'animation : on annule simplement.
      if (enAttente.has(id)) { clearTimeout(enAttente.get(id)); enAttente.delete(id); return; }
      enAttente.set(id, setTimeout(() => {
        enAttente.delete(id);
        basculerFait(id);
        if (coche) {
          ile('Fait', {
            icone: 'valide',
            couleur: `var(--${info(e.module).couleur})`,
            action: { libelle: 'Annuler', faire: () => basculerFait(id) },
          });
        }
      }, coche ? 620 : 320));
    };

    const deplier = (li) => {
      const ouvert = !li.classList.contains('ouvert');
      li.classList.toggle('ouvert', ouvert);
      li.querySelector('.af-corps')?.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      if (ouvert) ouverts.add(li.dataset.id); else ouverts.delete(li.dataset.id);
    };

    const replier = (bouton) => {
      const sec = bouton.closest('.af-section');
      const id = sec?.dataset.groupe;
      if (!id) return;
      const replie = !sec.hasAttribute('data-replie');
      const r = lire(CLE_REPLIS, { faits: true }) || {};
      r[id] = replie;
      ecrire(CLE_REPLIS, r);
      sec.toggleAttribute('data-replie', replie);
      bouton.setAttribute('aria-expanded', replie ? 'false' : 'true');
      if (!replie) {
        const carte = sec.querySelector('.af-carte');
        carte?.classList.add('af-apparait');
        carte?.addEventListener('animationend', () => carte.classList.remove('af-apparait'), { once: true });
      }
    };

    const clic = (ev) => {
      const c = ev.target.closest('[data-case]');
      if (c) { cocher(c); return; }
      if (ev.target.closest('a, .af-plus')) return;
      const fl = ev.target.closest('[data-filtre]');
      if (fl) {
        if (fl.getAttribute('aria-pressed') === 'true') return;
        defilFiltres = barre?.scrollLeft ?? null;
        ecrire(CLE_FILTRE, fl.dataset.filtre);
        vibrer(4);
        document.dispatchEvent(new CustomEvent('donnees', { detail: 'afaire' }));
        return;
      }
      const rp = ev.target.closest('[data-replier]');
      if (rp) { replier(rp); return; }
      const al = ev.target.closest('[data-aller]');
      if (al) {
        const cible = document.getElementById(al.dataset.aller);
        if (cible) {
          if (cible.hasAttribute('data-replie')) replier(cible.querySelector('[data-replier]'));
          cible.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        }
        return;
      }
      const li = ev.target.closest('.af-ligne.af-depliable');
      if (li) deplier(li);
    };
    racine.addEventListener('click', clic);
    return () => racine.removeEventListener('click', clic);
  },
  tic(racine, _E, t) {
    racine.querySelectorAll('[data-af-reste]').forEach((n) => {
      const ms = +n.dataset.afReste - t;
      const texte = texteReste(ms);
      if (n.textContent !== texte) n.textContent = texte;
      const u = urgence(ms);
      if ((n.dataset.u ?? '') !== u) {
        n.classList.remove('af-rouge', 'af-orange');
        if (u) n.classList.add(u);
        n.dataset.u = u;
      }
    });
  },
  minute(racine) {
    if (racine.dataset.cle !== cleEtat()) document.dispatchEvent(new CustomEvent('donnees', { detail: 'minute' }));
  },
};
