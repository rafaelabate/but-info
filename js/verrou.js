// Écran de verrouillage : lien magique (#cle=…), clé mémorisée sur l'appareil, ou code d'accès.
import { lienDepuisCode, clePriveeDepuisLien } from './seal.js';
import { lire, ecrire, effacer } from './stockage.js';
import { heure, dateLongue } from './temps.js';
import { vibrer } from './ui.js';

const $ = (s) => document.querySelector(s);

async function essayerLien(cles, lien) {
  try { return await clePriveeDepuisLien(cles, lien); } catch { return null; }
}

// Déverrouillage silencieux : lien dans l'adresse, puis clé mémorisée.
export async function essaiAuto(cles) {
  const m = location.hash.match(/cle=([A-Za-z0-9_-]{20,})/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    const k = await essayerLien(cles, m[1]);
    if (k) { ecrire('lien', m[1]); return k; }
  }
  const memo = lire('lien');
  if (memo) {
    const k = await essayerLien(cles, memo);
    if (k) return k;
    effacer('lien');
  }
  return null;
}

export const lienMemorise = () => lire('lien');
export function oublierAppareil() { effacer('lien'); location.reload(); }

export function montrerVerrou(cles) {
  const racine = $('#verrou');
  racine.hidden = false;
  document.documentElement.classList.add('verrouille');
  const horloge = () => {
    $('#verrou-heure').textContent = heure(Date.now());
    $('#verrou-date').textContent = dateLongue(Date.now());
  };
  horloge();
  const minuterie = setInterval(horloge, 1000);
  const form = $('#verrou-form');
  const champ = $('#verrou-code');
  const aide = $('#verrou-aide');
  const voir = $('#verrou-voir');
  voir.onclick = () => { champ.type = champ.type === 'password' ? 'text' : 'password'; champ.focus(); };
  setTimeout(() => champ.focus({ preventScroll: true }), 400);

  return new Promise((resolve) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const code = champ.value.trim();
      if (!code) return;
      racine.classList.add('travail');
      aide.textContent = 'Vérification…';
      aide.classList.remove('erreur');
      try {
        const lien = await lienDepuisCode(cles, code);
        const k = await clePriveeDepuisLien(cles, lien);
        ecrire('lien', lien);
        clearInterval(minuterie);
        vibrer([6, 40, 10]);
        racine.classList.remove('travail');
        champ.blur();
        resolve(k);
      } catch {
        racine.classList.remove('travail');
        racine.classList.remove('secoue');
        void racine.offsetWidth;
        racine.classList.add('secoue');
        vibrer([30, 60, 30]);
        aide.textContent = 'Code incorrect.';
        aide.classList.add('erreur');
        champ.select();
      }
    };
  });
}

export function ouvrirVerrou() {
  const racine = $('#verrou');
  racine.classList.add('ouvert');
  document.documentElement.classList.remove('verrouille');
  setTimeout(() => { racine.hidden = true; }, 900);
}
