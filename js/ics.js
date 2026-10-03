// Lecture des calendriers iCalendar (.ics) d'ADE et de Moodle. Partagé navigateur / Node.

export function lireICS(texte) {
  const lignes = texte.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const evenements = [];
  let courant = null;
  for (const ligne of lignes) {
    if (ligne === 'BEGIN:VEVENT') { courant = {}; continue; }
    if (ligne === 'END:VEVENT') { if (courant) evenements.push(courant); courant = null; continue; }
    if (!courant) continue;
    // Premier « : » hors guillemets (les paramètres peuvent contenir des « : » entre guillemets).
    let i = -1;
    for (let k = 0, q = false; k < ligne.length; k++) {
      if (ligne[k] === '"') q = !q;
      else if (ligne[k] === ':' && !q) { i = k; break; }
    }
    if (i < 0) continue;
    const [nom, ...params] = ligne.slice(0, i).split(';');
    const p = {};
    for (const x of params) { const [k, v = ''] = x.split('='); p[k.toUpperCase()] = v.replace(/^"|"$/g, ''); }
    courant[nom.toUpperCase()] = { valeur: ligne.slice(i + 1), params: p };
  }
  return evenements;
}

export const texte = (prop) => (prop ? prop.valeur : '')
  .replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();

// Décalage (en minutes) de l'heure de Paris par rapport à UTC à l'instant t.
const fmtParis = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
export function decalageParis(t) {
  const p = Object.fromEntries(fmtParis.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t) / 60000;
}
export function parisVersUTC(a, mo, j, h = 0, mi = 0, s = 0) {
  const naif = Date.UTC(a, mo - 1, j, h, mi, s);
  let t = naif - decalageParis(naif) * 60000;
  const d2 = decalageParis(t);
  if (naif - d2 * 60000 !== t) t = naif - d2 * 60000;
  return t;
}

// Renvoie { iso, journee } : iso en UTC (ou AAAA-MM-JJ pour un événement sur la journée).
export function dateICS(prop) {
  if (!prop) return null;
  const v = prop.valeur;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return null;
  const [, a, mo, j, h, mi, s, z] = m;
  if (h === undefined) return { iso: `${a}-${mo}-${j}`, journee: true };
  // « Z » ou TZID UTC : heure universelle ; sinon (TZID Europe/Paris ou heure flottante) : heure de Paris.
  const utc = z === 'Z' || /^(etc\/)?(utc|gmt)$/i.test(prop.params.TZID || '');
  const t = utc ? Date.UTC(+a, +mo - 1, +j, +h, +mi, +s) : parisVersUTC(+a, +mo, +j, +h, +mi, +s);
  return { iso: new Date(t).toISOString(), journee: false };
}

const sansHtml = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, ' ').trim();

// ADE : SUMMARY = cours, LOCATION = salle(s), DESCRIPTION = groupes + enseignants (+ date d'export, retirée
// pour que le contenu ne change que si l'emploi du temps change vraiment).
export function nettoyerADE(bruts) {
  return bruts.map((e) => {
    const debut = dateICS(e.DTSTART);
    const fin = dateICS(e.DTEND);
    if (!debut) return null;
    const desc = texte(e.DESCRIPTION).split('\n').map((s) => s.trim())
      .filter((s) => s && !/^\((export|updated|mis à jour)/i.test(s));
    return {
      id: texte(e.UID) || `${debut.iso}-${texte(e.SUMMARY)}`,
      debut: debut.iso,
      fin: fin ? fin.iso : debut.iso,
      journee: debut.journee || undefined,
      titre: texte(e.SUMMARY),
      lieu: texte(e.LOCATION),
      desc,
    };
  }).filter(Boolean).sort((a, b) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre));
}

// Moodle : échéances des devoirs, tests, événements de cours.
export function nettoyerMoodle(bruts) {
  return bruts.map((e) => {
    const debut = dateICS(e.DTSTART);
    if (!debut) return null;
    const fin = dateICS(e.DTEND);
    const desc = sansHtml(texte(e.DESCRIPTION));
    return {
      id: texte(e.UID) || `${debut.iso}-${texte(e.SUMMARY)}`,
      debut: debut.iso,
      fin: fin ? fin.iso : debut.iso,
      journee: debut.journee || undefined,
      titre: sansHtml(texte(e.SUMMARY)),
      cours: texte(e.CATEGORIES),
      desc: desc.length > 400 ? desc.slice(0, 397) + '…' : desc,
      url: texte(e.URL) || undefined,
    };
  }).filter(Boolean).sort((a, b) => a.debut.localeCompare(b.debut));
}
