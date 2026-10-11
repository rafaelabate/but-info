// Réglages (feuille ouverte par l'avatar ou la pastille de synchro) : apparence, ouverture sur iPhone
// par QR code du lien magique, état de la synchro, liens et contacts utiles, verrouillage de l'appareil.
import { html, urlSure } from '../html.js';
import { ic, ouvrirFeuille, ile, vibrer } from '../ui.js';
import { E, verifierMaj } from '../donnees.js';
import { lire, ecrire } from '../stockage.js';
import { lienMemorise, oublierAppareil } from '../verrou.js';
import { relatif } from '../temps.js';
import { appliquerTheme } from '../app.js';

const THEMES = [['auto', 'Auto', 'auto'], ['light', 'Clair', 'soleil'], ['dark', 'Sombre', 'lune']];
const LIENS = [
  ['moodle', 'Moodle', 'livre', 'orange'],
  ['notes', 'IUT Notes', 'graphique', 'vert'],
  ['ade', 'ADE', 'calendrier', 'rouge'],
  ['mail', 'Messagerie', 'mail', 'bleu'],
  ['intranet', 'Intranet', 'maison', 'indigo'],
  ['certificat', 'Certificat de scolarité', 'document', 'gris'],
  ['syllabus', 'Programme national', 'diplome', 'violet'],
  ['departement', 'Département', 'groupe', 'sarcelle'],
];
const GROUPES = { td: 'TD', projet_s101: 'SAÉ 1.01', r103: 'R1.03', r105: 'R1.05' };

const carre = (icone, couleur) => html`<span class="icone-carree" style="--c: var(--${couleur})">${ic(icone)}</span>`;
const instant = (v) => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
const depuis = (t) => relatif(t, Date.now());
// Morceaux courts insécables (« 2026-2027 », « R1.05 G02 », un numéro de téléphone) ; les longs restent sécables.
const morceaux = (liste) => liste.filter(Boolean).map((m, k) => html`${k ? ' · ' : ''}${String(m).length <= 24 ? html`<span class="rg-insecable">${m}</span>` : m}`);
const initiales = (nom) => nom.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((m) => m[0]).join('').toUpperCase();

function groupe(titre, lignes, { id = '', note = '' } = {}) {
  return html`<section class="rg-groupe"${id ? html` id="${id}"` : ''}>
    ${titre ? html`<h3 class="rg-entete">${titre}</h3>` : ''}
    <ul class="rg-liste">${lignes}</ul>
    ${note ? html`<p class="rg-note">${note}</p>` : ''}
  </section>`;
}

// ---------- Profil ----------
function profil(et) {
  if (!et?.prenom && !et?.nom) return '';
  const nom = [et.prenom, et.nom].filter(Boolean).join(' ');
  const groupes = Object.entries(et.groupes || {}).filter(([, v]) => v).map(([k, v]) => `${GROUPES[k] || k} ${v}`);
  return groupe('', html`
    <li><div class="rg-profil">
      <span class="rg-avatar" aria-hidden="true">${initiales(nom)}</span>
      <div class="rg-texte"><div class="rg-nom">${nom}</div><div class="rg-sous">${morceaux([et.formation, et.annee])}</div></div>
    </div></li>
    ${groupes.length ? html`<li><div class="rg-ligne">${carre('groupe', 'sarcelle')}<div class="rg-texte"><div class="rg-titre">Groupes</div><div class="rg-sous">${morceaux(groupes)}</div></div></div></li>` : ''}
    ${et.num_etudiant ? html`<li><button type="button" class="rg-ligne rg-touche" data-rg-copier="${et.num_etudiant}" aria-label="Copier le numéro étudiant">
      ${carre('personne', 'gris')}<span class="rg-texte rg-titre">N° étudiant</span><span class="rg-valeur chiffres">${et.num_etudiant}</span>${ic('copier', 'rg-chevron')}
    </button></li>` : ''}`);
}

// ---------- Apparence ----------
function apparence() {
  const t = lire('theme', 'auto');
  const i = Math.max(0, THEMES.findIndex(([v]) => v === t));
  const anime = !lire('fondFixe', false);
  // Mouvement réduit : le fond est déjà figé par le système, l'interrupteur n'aurait aucun effet.
  const figeParSysteme = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return groupe('Apparence', html`
    <li><div class="rg-ligne rg-ligne-segment">
      <div class="segment rg-segment" style="--n: 3; --i: ${i}" role="group" aria-label="Thème">
        ${THEMES.map(([v, libelle, icone], k) => html`<button type="button" data-rg-theme="${v}" aria-pressed="${String(k === i)}">${ic(icone)}${libelle}</button>`)}
      </div>
    </div></li>
    ${figeParSysteme ? '' : html`<li><div class="rg-ligne">
      ${carre('etincelles', 'cyan')}<span class="rg-texte rg-titre" id="rg-fond">Fond animé</span>
      <button type="button" class="rg-interrupteur" role="switch" aria-checked="${String(anime)}" aria-labelledby="rg-fond" data-rg-fond></button>
    </div></li>`}`);
}

// ---------- Ouvrir sur iPhone (lien magique en QR code) ----------
function lienAppareil() {
  const base = location.origin + location.pathname;
  if (E.demo) return `${base}?demo`;
  const k = lienMemorise();
  return k ? `${base}#cle=${k}` : null;
}
function acces() {
  if (!lienAppareil()) return '';
  const surIphone = /iPhone|iPod/.test(navigator.userAgent);
  const titre = E.demo ? 'Ouvrir la démo sur mon iPhone' : surIphone ? 'Ouvrir sur un autre appareil' : 'Ouvrir sur mon iPhone';
  return groupe('Accès', html`<li>
    <button type="button" class="rg-ligne rg-touche" data-rg-qr aria-expanded="false" aria-controls="rg-qr">
      ${carre('qr', 'bleu')}<span class="rg-texte rg-titre">${titre}</span>${ic('droite', 'rg-chevron rg-pivot')}
    </button>
    <div class="rg-depliant" id="rg-qr"><div inert>
      <div class="rg-qr">
        <div class="rg-qr-carte" data-rg-qr-image><div class="squelette"></div></div>
        <p>Scanne avec l’appareil photo, puis dans Safari : Partager › Sur l’écran d’accueil.</p>
        <button type="button" class="bouton petit" data-rg-copier-lien>${ic('copier')}Copier le lien</button>
      </div>
    </div></div>
  </li>`, { note: E.demo ? '' : 'Ce lien ouvre le tableau de bord sans code : garde-le pour toi.' });
}

async function dessinerQR(cible, texte) {
  const { default: qrcode } = await import('../../vendor/qrcode/qrcode.mjs');
  const qr = qrcode(0, 'M');
  qr.addData(texte);
  qr.make();
  const n = qr.getModuleCount();
  const repere = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (repere(r, c) || !qr.isDark(r, c)) continue;
      let l = 1;
      while (c + l < n && !repere(r, c + l) && qr.isDark(r, c + l)) l++;
      d += `M${c} ${r}h${l}v1h-${l}z`;
      c += l - 1;
    }
  }
  // Motifs de repérage aux coins arrondis
  const oeil = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="2.1"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.3" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".9"/>`;
  cible.innerHTML = `<svg viewBox="0 0 ${n} ${n}" role="img" aria-label="QR code du lien d’accès" fill="#0a0f1c"><path d="${d}" shape-rendering="crispEdges"/>${oeil(0, 0)}${oeil(n - 7, 0)}${oeil(0, n - 7)}</svg>`;
}

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.setAttribute('readonly', '');
    zone.style.cssText = 'position:fixed;top:0;opacity:0';
    document.body.append(zone);
    zone.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* rien */ }
    zone.remove();
    return ok;
  }
}

// ---------- Synchronisation ----------
const INJOIGNABLE = 'Injoignable, nouvel essai automatique';
function ligneSync(icone, couleur, titre, sous, t, { vide = 'En attente', alerte = false } = {}) {
  return html`<li><div class="rg-ligne">
    ${carre(icone, couleur)}
    <div class="rg-texte"><div class="rg-titre">${titre}</div><div class="rg-sous${alerte ? ' rg-alerte' : ''}">${sous}</div></div>
    <span class="rg-valeur" data-rg-t="${t || ''}">${t ? depuis(t) : vide}</span>
  </div></li>`;
}
function lignesSync() {
  const s = E.sync;
  const ade = instant(s.ade), moodle = instant(s.moodle), perso = instant(s.perso), verif = instant(s.verif);
  const echec = s.verifOk === false, adeKo = s.adeOk === false, moodleKo = s.moodleOk === false;
  return html`
    ${s.enLigne === false ? html`<li><div class="rg-ligne">${carre('nuage', 'gris')}<div class="rg-texte"><div class="rg-titre">Hors ligne</div><div class="rg-sous">Affichage des dernières données reçues</div></div></div></li>` : ''}
    ${ligneSync('synchro', echec ? 'rouge' : verif ? 'vert' : 'gris', 'Vérification', echec ? 'Échec, nouvel essai automatique' : 'Automatique', verif, { alerte: echec })}
    ${ligneSync('calendrier', adeKo ? 'gris' : ade ? 'rouge' : 'orange', 'Emploi du temps', adeKo ? INJOIGNABLE : 'ADE', ade, { alerte: adeKo })}
    ${ligneSync('coches', moodleKo ? 'gris' : moodle ? 'orange' : 'gris', 'Échéances', moodleKo ? INJOIGNABLE : 'Moodle', moodle, { alerte: moodleKo })}
    ${ligneSync('document', perso ? 'indigo' : 'gris', 'Relevé perso', 'Notes, annonces, dépôts', perso, { vide: '—' })}
    ${E.demo ? '' : html`<li><button type="button" class="rg-ligne rg-touche rg-action" data-rg-verifier>${ic('synchro')}<span class="rg-titre">Vérifier maintenant</span></button></li>`}`;
}
const synchro = () => groupe('Synchronisation', lignesSync(), { id: 'rg-synchro' });

// ---------- Liens et contacts ----------
function liens(l) {
  const lignes = LIENS.map(([cle, titre, icone, couleur]) => {
    const u = urlSure(l?.[cle]);
    return u ? html`<li><a class="rg-ligne rg-touche" href="${u}" target="_blank" rel="noopener noreferrer">${carre(icone, couleur)}<span class="rg-texte rg-titre">${titre}</span>${ic('externe', 'rg-chevron')}</a></li>` : null;
  }).filter(Boolean);
  return lignes.length ? groupe('Liens utiles', lignes) : '';
}

const SERVICE = /^(secr[ée]tariat|scolarit[ée]|service|accueil|biblioth[èe]que)/i;
function contacts(liste) {
  const lignes = (Array.isArray(liste) ? liste : []).filter((c) => c?.nom).map((c) => {
    const tel = String(c.tel || '').replace(/[^\d+]/g, '');
    const mail = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(c.mail || '') ? c.mail : '';
    const sous = morceaux([c.detail, c.tel]);
    return html`<li><div class="rg-ligne">
      ${SERVICE.test(c.nom) ? carre('maison', 'gris') : html`<span class="rg-monogramme" aria-hidden="true">${initiales(c.nom)}</span>`}
      <div class="rg-texte"><div class="rg-titre">${c.nom}</div>${sous.length ? html`<div class="rg-sous">${sous}</div>` : ''}</div>
      <div class="rg-actions">
        ${tel ? html`<a class="rg-rond" href="tel:${tel}" aria-label="Appeler : ${c.nom}" title="${c.tel}">${ic('telephone')}</a>` : ''}
        ${mail ? html`<a class="rg-rond" href="mailto:${mail}" aria-label="Écrire : ${c.nom}" title="${mail}">${ic('mail')}</a>` : ''}
      </div>
    </div></li>`;
  });
  return lignes.length ? groupe('Contacts', lignes) : '';
}

// ---------- Fin : verrouillage (ou sortie de la démo) ----------
function fin() {
  if (E.demo) {
    return groupe('', html`<li><a class="rg-ligne rg-touche rg-centre" href="${location.pathname}"><span class="rg-titre rg-accent">Quitter la démo</span></a></li>`);
  }
  return groupe('', html`<li><button type="button" class="rg-ligne rg-touche rg-centre rg-danger" data-rg-verrouiller><span class="rg-titre">Verrouiller cet appareil</span></button></li>`,
    { note: 'Le code d’accès sera redemandé sur cet appareil.' });
}

// ---------- Feuille ----------
let arreter = null;

export function ouvrirReglages(section) {
  const p = E.perso || {};
  const contenu = html`<div class="rg">
    <h2>Réglages</h2>
    ${profil(p.etudiant)}
    ${apparence()}
    ${acces()}
    ${synchro()}
    ${liens(p.liens)}
    ${contacts(p.contacts)}
    ${fin()}
  </div>`;
  ouvrirFeuille(contenu, { titre: 'Réglages', surFermeture: () => arreter?.(), apres: (f) => monter(f, section) });
}

function monter(f, section) {
  f.classList.add('rg-feuille');
  const majSync = () => { const l = f.querySelector('#rg-synchro .rg-liste'); if (l) l.innerHTML = String(lignesSync()); };
  const minuterie = setInterval(() => {
    f.querySelectorAll('[data-rg-t]').forEach((n) => { if (n.dataset.rgT) n.textContent = depuis(+n.dataset.rgT); });
  }, 15_000);
  const surDonnees = (e) => { if (e.detail === 'sync' || e.detail === 'maj') majSync(); };
  document.addEventListener('donnees', surDonnees);
  arreter = () => { clearInterval(minuterie); document.removeEventListener('donnees', surDonnees); arreter = null; };

  let qrPret = false;
  let attente = null;
  f.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rg-theme], [data-rg-fond], [data-rg-qr], [data-rg-copier-lien], [data-rg-copier], [data-rg-verifier], [data-rg-verrouiller]');
    if (!b) return;
    const d = b.dataset;
    if (d.rgTheme) {
      ecrire('theme', d.rgTheme);
      appliquerTheme(d.rgTheme);
      const seg = b.parentElement;
      seg.style.setProperty('--i', [...seg.children].indexOf(b));
      seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      vibrer(6);
    } else if ('rgFond' in d) {
      const anime = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(anime));
      ecrire('fondFixe', !anime);
      document.documentElement.classList.toggle('fond-fixe', !anime);
      vibrer(6);
    } else if ('rgQr' in d) {
      const depliant = f.querySelector('#rg-qr');
      const ouvert = !depliant.classList.contains('ouvert');
      depliant.classList.toggle('ouvert', ouvert);
      depliant.firstElementChild.inert = !ouvert;
      b.setAttribute('aria-expanded', String(ouvert));
      if (ouvert && !qrPret) {
        qrPret = true;
        const cible = depliant.querySelector('[data-rg-qr-image]');
        dessinerQR(cible, lienAppareil()).catch(() => { qrPret = false; cible.innerHTML = String(html`<p class="rg-qr-erreur">QR code indisponible. Utilise « Copier le lien ».</p>`); });
      }
    } else if ('rgCopierLien' in d) {
      if (await copier(lienAppareil())) ile('Lien copié', { icone: 'copier', couleur: 'var(--accent)' });
    } else if (d.rgCopier) {
      if (await copier(d.rgCopier)) ile('Numéro étudiant copié', { icone: 'copier', couleur: 'var(--accent)' });
    } else if ('rgVerifier' in d) {
      b.classList.add('rg-tourne');
      b.disabled = true;
      try { await verifierMaj(); } finally { majSync(); }
    } else if ('rgVerrouiller' in d) {
      if (!b.classList.contains('rg-confirmer')) {
        b.classList.add('rg-confirmer');
        b.querySelector('.rg-titre').textContent = 'Toucher encore pour verrouiller';
        vibrer(12);
        clearTimeout(attente);
        attente = setTimeout(() => {
          b.classList.remove('rg-confirmer');
          b.querySelector('.rg-titre').textContent = 'Verrouiller cet appareil';
        }, 4000);
        return;
      }
      oublierAppareil();
    }
  });

  if (section) {
    requestAnimationFrame(() => {
      const g = f.querySelector(`#rg-${CSS.escape(section)}`);
      if (!g) return;
      const doux = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      f.scrollTo({ top: g.offsetTop - 16, behavior: doux ? 'smooth' : 'auto' });
      g.querySelector('.rg-liste')?.classList.add('rg-eclat');
    });
  }
}
