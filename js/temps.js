// Dates et heures, toujours à l'heure de Paris (même si l'appareil est réglé ailleurs).
import { parisVersUTC } from './ics.js';

export const TZ = 'Europe/Paris';
export const MIN = 60_000;
export const HEURE = 60 * MIN;
export const JOUR = 24 * HEURE;

const fmtParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
});
const JOURS_EN = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function parts(d) {
  const p = Object.fromEntries(fmtParts.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return { a: +p.year, mo: +p.month, j: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, js: JOURS_EN[p.weekday] };
}

const pad = (n) => String(n).padStart(2, '0');
export const cleJour = (d) => { const p = parts(d); return `${p.a}-${pad(p.mo)}-${pad(p.j)}`; };
export function depuisCle(cle, h = 0, mi = 0) {
  const [a, mo, j] = cle.split('-').map(Number);
  return new Date(parisVersUTC(a, mo, j, h, mi, 0));
}
export function ajouterJours(cle, n) {
  const [a, mo, j] = cle.split('-').map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const jourSemaine = (cle) => { const [a, mo, j] = cle.split('-').map(Number); return new Date(Date.UTC(a, mo - 1, j)).getUTCDay(); };
export const lundi = (cle) => ajouterJours(cle, -((jourSemaine(cle) + 6) % 7));
export const minutesDuJour = (d) => { const p = parts(d); return p.h * 60 + p.mi + p.s / 60; };
export const ecartJours = (cleA, cleB) => Math.round((Date.parse(cleB + 'T12:00:00Z') - Date.parse(cleA + 'T12:00:00Z')) / JOUR);

export function numeroSemaine(cle) {
  const [a, mo, j] = cle.split('-').map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j));
  const js = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - js + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - premierJeudi) / JOUR - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
}

const fmt = (opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, ...opts });
const F = {
  heure: fmt({ hour: '2-digit', minute: '2-digit' }),
  long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  moyen: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
  court: fmt({ day: 'numeric', month: 'short' }),
  jourNom: fmt({ weekday: 'long' }),
  jourCourt: fmt({ weekday: 'short' }),
  numero: fmt({ day: 'numeric' }),
  mois: fmt({ month: 'long', year: 'numeric' }),
};
export const heure = (d) => F.heure.format(new Date(d));
export const dateLongue = (d) => F.long.format(new Date(d));
export const dateMoyenne = (d) => F.moyen.format(new Date(d)).replace(/\./g, '');
export const dateCourte = (d) => F.court.format(new Date(d)).replace(/\./g, '');
export const nomJour = (d) => F.jourNom.format(new Date(d));
export const jourCourt = (d) => F.jourCourt.format(new Date(d)).replace('.', '');
export const numeroJour = (d) => F.numero.format(new Date(d));
export const moisAnnee = (d) => F.mois.format(new Date(d));
export const majuscule = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// « aujourd'hui », « demain », « jeudi », « jeu. 8 oct. »
export function jourRelatif(d, maintenant = Date.now()) {
  const n = ecartJours(cleJour(maintenant), cleJour(d));
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1 && n < 7) return nomJour(d);
  return dateMoyenne(d);
}

// Durée lisible : « 45 min », « 1 h 30 », « 3 j »
export function duree(ms, { secondes = false } = {}) {
  const abs = Math.max(0, Math.abs(ms));
  if (abs < MIN) return secondes ? `${Math.floor(abs / 1000)} s` : 'moins d’1 min';
  if (abs < HEURE) return `${Math.floor(abs / MIN)} min`;
  if (abs < JOUR) { const h = Math.floor(abs / HEURE); const m = Math.floor((abs % HEURE) / MIN); return m ? `${h} h ${pad(m)}` : `${h} h`; }
  const j = Math.floor(abs / JOUR); const h = Math.floor((abs % JOUR) / HEURE);
  return j < 3 && h ? `${j} j ${h} h` : `${j} j`;
}

// « dans 12 min », « il y a 3 h »
export function relatif(d, maintenant = Date.now()) {
  const ms = new Date(d) - maintenant;
  if (Math.abs(ms) < MIN) return 'maintenant';
  return ms > 0 ? `dans ${duree(ms)}` : `il y a ${duree(ms)}`;
}

// Échéance lisible : « ce soir 23:59 », « demain 9:00 », « ven. 2 oct. 23:59 »
export function echeanceLisible(d, maintenant = Date.now()) {
  const n = ecartJours(cleJour(maintenant), cleJour(d));
  const h = heure(d);
  if (n === 0) return (parts(d).h >= 18 ? 'ce soir ' : 'aujourd’hui ') + h;
  if (n === 1) return `demain ${h}`;
  if (n > 1 && n < 7) return `${nomJour(d)} ${h}`;
  return `${dateMoyenne(d)} ${h}`;
}

export function decompte(ms) {
  const t = Math.max(0, ms);
  return { j: Math.floor(t / JOUR), h: Math.floor((t % JOUR) / HEURE), m: Math.floor((t % HEURE) / MIN), s: Math.floor((t % MIN) / 1000) };
}
export { pad };
