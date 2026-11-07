// Catalogue des modules du S1 et lecture « intelligente » des séances ADE et des échéances Moodle.
import { normaliser } from './html.js';

// Couleurs = couleurs système iOS (variables CSS --x et --x-encre dans app.css).
export const MODULES = {
  'R1.01': { court: 'Init. dév.', nom: 'Initiation au développement', couleur: 'bleu', icone: 'code' },
  'R1.02': { court: 'Dév. web', nom: 'Développement d’interfaces web', couleur: 'orange', icone: 'globe' },
  'R1.03': { court: 'Archi', nom: 'Architecture des ordinateurs', couleur: 'violet', icone: 'puce' },
  'R1.04': { court: 'Systèmes', nom: 'Systèmes d’exploitation', couleur: 'sarcelle', icone: 'terminal' },
  'R1.05': { court: 'BD & SQL', nom: 'Bases de données et SQL', couleur: 'vert', icone: 'bdd' },
  'R1.06': { court: 'Maths discrètes', nom: 'Mathématiques discrètes', couleur: 'rose', icone: 'sigma' },
  'R1.07': { court: 'Outils maths', nom: 'Outils mathématiques fondamentaux', couleur: 'rouge', icone: 'fonction' },
  'R1.08': { court: 'Gestion', nom: 'Gestion de projet et des organisations', couleur: 'jaune', icone: 'mallette' },
  'R1.09': { court: 'Économie', nom: 'Économie durable et numérique', couleur: 'menthe', icone: 'feuille' },
  'R1.10': { court: 'Anglais', nom: 'Anglais', couleur: 'indigo', icone: 'langue' },
  'R1.11': { court: 'Communication', nom: 'Bases de la communication', couleur: 'brun', icone: 'bulle' },
  'R1.12': { court: 'PPP', nom: 'Projet professionnel et personnel', couleur: 'cyan', icone: 'boussole' },
  'R1.AL': { court: 'Remise à niveau', nom: 'Remise à niveau et méthodologie', couleur: 'gris', icone: 'crayon' },
  'SAÉ 1.01': { court: 'SAÉ 1.01', nom: 'Implémentation d’un besoin client', couleur: 'sae', icone: 'puzzle' },
  'SAÉ 1.02': { court: 'SAÉ 1.02', nom: 'Comparaison d’approches algorithmiques', couleur: 'sae', icone: 'puzzle' },
  'SAÉ 1.03': { court: 'SAÉ 1.03', nom: 'Installation d’un poste pour le développement', couleur: 'sae', icone: 'puzzle' },
  'SAÉ 1.04': { court: 'SAÉ 1.04', nom: 'Création d’une base de données', couleur: 'sae', icone: 'puzzle' },
  'SAÉ 1.05': { court: 'SAÉ 1.05', nom: 'Recueil de besoins', couleur: 'sae', icone: 'puzzle' },
  'SAÉ 1.06': { court: 'SAÉ 1.06', nom: 'Découverte de l’environnement économique et écologique', couleur: 'sae', icone: 'puzzle' },
  BUT: { court: 'Département', nom: 'BUT Informatique', couleur: 'gris', icone: 'diplome' },
};
export const CODES = Object.keys(MODULES).filter((c) => c !== 'BUT');

// Les 6 UE du S1 (coefficients ScoDoc = MCC 2026-2027 ; chaque UE totalise 100).
export const UES = [
  { code: 'UE 1.1', comp: 'Réaliser', couleur: 'bleu', coefs: { 'R1.01': 42, 'R1.02': 12, 'R1.10': 6, 'SAÉ 1.01': 40 } },
  { code: 'UE 1.2', comp: 'Optimiser', couleur: 'rose', coefs: { 'R1.01': 24, 'R1.03': 6, 'R1.06': 15, 'R1.07': 15, 'SAÉ 1.02': 40 } },
  { code: 'UE 1.3', comp: 'Administrer', couleur: 'sarcelle', coefs: { 'R1.03': 21, 'R1.04': 21, 'R1.10': 12, 'R1.11': 6, 'SAÉ 1.03': 40 } },
  { code: 'UE 1.4', comp: 'Gérer', couleur: 'vert', coefs: { 'R1.05': 36, 'R1.06': 18, 'R1.09': 6, 'SAÉ 1.04': 40 } },
  { code: 'UE 1.5', comp: 'Conduire', couleur: 'orange', coefs: { 'R1.02': 18, 'R1.08': 27, 'R1.11': 15, 'SAÉ 1.05': 40 } },
  { code: 'UE 1.6', comp: 'Collaborer', couleur: 'violet', coefs: { 'R1.02': 5, 'R1.08': 11, 'R1.09': 11, 'R1.10': 11, 'R1.11': 11, 'R1.12': 11, 'SAÉ 1.06': 40 } },
];

export const info = (code) => MODULES[code] || { court: code || 'Autre', nom: code || 'Autre', couleur: 'gris', icone: 'livre' };
// Attribut style prêt à l'emploi : --m (couleur) et --m-encre (texte lisible)
export const styleModule = (code) => { const c = info(code).couleur; return `--m: var(--${c}); --m-encre: var(--${c}-encre)`; };
export const ueDuModule = (code) => UES.filter((u) => u.coefs[code]);

// « R1.02 », « R102 », « TBFTR102 » (code ECUE), « SAE 1.01 », « S1.01 » (cours Moodle de la SAÉ)…
export function codeModule(texte) {
  const t = normaliser(texte).toUpperCase();
  let m = t.match(/TBFT([RE])1(\d{2}|AL)/);
  if (m) return m[1] === 'R' ? `R1.${m[2]}` : `SAÉ 1.${m[2]}`;
  m = t.match(/\bSAE\s*[-_]?\s*1\s*[.\s_-]?\s*(0[1-6])\b/) || t.match(/\bS1\.(0[1-6])\b/);
  if (m) return `SAÉ 1.${m[1]}`;
  m = t.match(/\bR\s*1\s*[.\s_-]?\s*(0[1-9]|1[0-2]|AL)\b/);
  if (m) return `R1.${m[1]}`;
  return null;
}

const MOTS_CLES = [
  ['R1.01', /init(iation)?\.?\s*(au\s*)?dev|programmation|langage c\b|\balgo/],
  ['R1.02', /\bweb\b|html|\bcss\b|interfaces?\b/],
  ['R1.03', /archi/],
  ['R1.04', /systeme|linux|unix|\bshell\b/],
  ['R1.05', /bases? de donnees|\bsql\b|\bbdd?\b/],
  ['R1.06', /discret/],
  ['R1.07', /outils? math|maths? fond/],
  ['R1.08', /gestion|organisation/],
  ['R1.09', /economi|\beco\b|durable/],
  ['R1.10', /anglais|english/],
  ['R1.11', /communication|\bcom\b|expression/],
  ['R1.12', /\bppp\b|projet pro/],
  ['R1.AL', /remise a niveau|methodologie/],
];
export function deviner(texte) {
  const code = codeModule(texte);
  if (code) return code;
  const t = normaliser(texte);
  for (const [c, re] of MOTS_CLES) if (re.test(t)) return c;
  return null;
}

const TYPES = [
  ['eval', /\b(ds|dst|dsi|examens?|partiel|controle|eval(uation)?s?|qcm|test|interro(gation)?|epreuve)\b/],
  ['soutenance', /\b(soutenance|oral|presentation)\b/],
  ['TP', /\btp\b|travaux pratiques/],
  ['TD', /\btd\b|travaux diriges/],
  ['CM', /\bcm\b|amphi|cours magistral/],
  ['SAÉ', /\bsae\b|projet/],
];
export const LIBELLE_TYPE = { eval: 'Contrôle', soutenance: 'Oral', TP: 'TP', TD: 'TD', CM: 'Cours', 'SAÉ': 'Projet' };
export function typeSeance(titre, desc = []) {
  for (const source of [normaliser(titre), normaliser(desc.join(' '))]) {
    for (const [type, re] of TYPES) if (re.test(source)) return type;
  }
  return null;
}

// Lignes de DESCRIPTION ADE : groupes (« BUT1 INFO G2 ») et enseignants (« NOM Prénom »).
const RE_PROF = /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]+(?:[ -][A-ZÀ-ÖØ-Þ'’-]{2,})*\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’-]+(?:[ -][A-ZÀ-ÖØ-Þ]?[a-zà-öø-ÿ'’-]+)*$/;
export function lireDescription(desc = []) {
  const profs = [], groupes = [], autres = [];
  for (const l of desc) {
    if (RE_PROF.test(l) && !/\d/.test(l)) profs.push(l);
    else if (/\b(G\d|TD|TP|BUT|INFO|GR(OU)?PE?|PROMO|S\d)\b/i.test(l) || /^[A-Z0-9 _.-]{2,}$/.test(l)) groupes.push(l);
    else autres.push(l);
  }
  return { profs, groupes, autres };
}
// « Jean DUPONT » plutôt que « DUPONT Jean »
export const nomProf = (p) => {
  const m = p.match(/^([A-ZÀ-ÖØ-Þ'’ -]+?)\s+([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'’]+(?:[- ][A-ZÀ-ÖØ-Þ]?[a-zà-öø-ÿ'’]+)*)$/);
  return m ? `${m[2]} ${m[1].replace(/([A-ZÀ-ÖØ-Þ])([A-ZÀ-ÖØ-Þ'’]+)/g, (_, a, b) => a + b.toLowerCase())}` : p;
};

export function sallesCourtes(lieu = '') {
  return lieu.split(/\s*[,;]\s*/).map((s) => s.trim()).filter(Boolean).map((s) => s
    .replace(/^(IUT|NICE|FABRON|CAMPUS|SITE)[\s_-]*/gi, '')
    .replace(/^(IUT|NICE|FABRON)[\s_-]*/gi, '')
    .replace(/\s*\((\d+)\s*pl(aces?)?\.?\)\s*$/i, '')
    .trim()).filter(Boolean);
}

// Séance ADE brute -> séance enrichie
export function enrichirSeance(e) {
  const texte = [e.titre, ...(e.desc || [])].join(' ');
  const module = deviner(e.titre) || deviner(texte);
  const { profs, groupes } = lireDescription(e.desc || []);
  const annule = /\bannul(e|é|ee|ée)\b/i.test(normaliser(e.titre));
  return {
    ...e,
    t0: Date.parse(e.debut),
    t1: Date.parse(e.fin),
    module,
    type: typeSeance(e.titre, e.desc || []),
    salles: sallesCourtes(e.lieu),
    profs,
    groupes,
    annule,
  };
}

// Titre à afficher : le nom court du module s'il est reconnu, sinon le titre ADE nettoyé.
export function titreSeance(s) {
  if (s.module && MODULES[s.module]) return MODULES[s.module].court;
  return s.titre.replace(/\s+/g, ' ').trim() || 'Séance';
}
// Précision utile tirée du titre ADE (« Évaluation n°1 », « Soutenance »…), si elle apporte quelque chose.
const MOTS_VIDES = new Set(['introduction', 'aux', 'au', 'des', 'de', 'du', 'la', 'le', 'les', 'et', 'en', 'un', 'une', 'pour', 'sur', 'technique', 'groupe']);
// « projets » ~ « projet », « environement » (faute ADE) ~ « environnement »
const memeMot = (n, r) => r.startsWith(n) || (r.length >= 4 && n.startsWith(r)) || (n.length >= 6 && n.slice(0, 6) === r.slice(0, 6));
export function precisionSeance(s) {
  if (!s.module) return '';
  const ref = normaliser(`${info(s.module).nom} ${info(s.module).court}`).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const mots = s.titre
    .replace(/TBFT[RE]1\d{2}/gi, '')
    .replace(/\b(R|SA[EÉ]|S)\s*1\s*[.\s_-]?\s*(\d{2}|AL)\b/gi, '')
    .replace(/\b(CM|TD|TP)\b\s*\d*/gi, '')
    .replace(/[-–—:|/()+'’]+/g, ' ')
    .split(/\s+/).filter(Boolean)
    // Ni les mots du nom du module (« d’interfaces »), ni les mots vides, ni les groupes (« G01 », « G1A »).
    .filter((w) => {
      const n = normaliser(w).replace(/[^a-z0-9]/g, '');
      return n.length > 1 && !MOTS_VIDES.has(n) && !/^g\d{1,2}[a-z]?$/.test(n) && !ref.some((r) => memeMot(n, r));
    });
  const t = mots.join(' ').trim();
  return t.length >= 3 ? t : '';
}
