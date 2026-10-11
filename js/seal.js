// Chiffrement des données perso, partagé entre le navigateur et les scripts Node (tools/).
// Données : ECDH P-256 éphémère + HKDF-SHA256 + AES-256-GCM, JSON compressé en gzip.
// Déverrouillage : code (PBKDF2) -> clé de lien (32 octets) -> clé privée ECDH.
// Le dépôt public ne contient que la clé publique, la clé privée chiffrée et des données chiffrées.

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();
const CURVE = { name: 'ECDH', namedCurve: 'P-256' };
const INFO = te.encode('azur/donnees/v1');
export const PBKDF2_ITER = 600000;

export const b64 = {
  enc(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  dec(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
  url(bytes) { return b64.enc(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  fromUrl(str) {
    const s = str.replace(/-/g, '+').replace(/_/g, '/');
    return b64.dec(s + '='.repeat((4 - (s.length % 4)) % 4));
  },
};

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const gzip = (bytes) => pipe(bytes, new CompressionStream('gzip'));
const gunzip = (bytes) => pipe(bytes, new DecompressionStream('gzip'));

// Le code se tape sur téléphone : on ignore majuscules, accents, espaces et tirets.
export function normaliserCode(code) {
  return code.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function cleDepuisCode(code, sel, usage) {
  const base = await subtle.importKey('raw', te.encode(normaliserCode(code)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations: PBKDF2_ITER },
    base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

const cleAes = (raw, usage) => subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [usage]);

async function aesPartagee(privee, publique, usage) {
  const bits = await subtle.deriveBits({ name: 'ECDH', public: publique }, privee, 256);
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO },
    hk, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

// --- Création des clés (une seule fois, en local) ---------------------------------
export async function creerCles(code) {
  const paire = await subtle.generateKey(CURVE, true, ['deriveBits']);
  const publique = await subtle.exportKey('jwk', paire.publicKey);
  const privee = await subtle.exportKey('jwk', paire.privateKey);
  const lien = globalThis.crypto.getRandomValues(new Uint8Array(32));

  const ivPrivee = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const priveeChiffree = await subtle.encrypt(
    { name: 'AES-GCM', iv: ivPrivee }, await cleAes(lien, 'encrypt'), te.encode(JSON.stringify(privee)));

  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const ivLien = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const lienChiffre = await subtle.encrypt(
    { name: 'AES-GCM', iv: ivLien }, await cleDepuisCode(code, sel, 'encrypt'), lien);

  return {
    lien: b64.url(lien),
    fichier: {
      v: 1,
      publique: { kty: 'EC', crv: 'P-256', x: publique.x, y: publique.y },
      privee: { iv: b64.enc(ivPrivee), ct: b64.enc(new Uint8Array(priveeChiffree)) },
      code: { sel: b64.enc(sel), iter: PBKDF2_ITER, iv: b64.enc(ivLien), ct: b64.enc(new Uint8Array(lienChiffre)) },
    },
  };
}

// --- Déverrouillage (navigateur) --------------------------------------------------
export async function lienDepuisCode(cles, code) {
  const k = await cleDepuisCode(code, b64.dec(cles.code.sel), 'decrypt');
  const lien = await subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(cles.code.iv) }, k, b64.dec(cles.code.ct));
  return b64.url(new Uint8Array(lien));
}

export async function clePriveeDepuisLien(cles, lien) {
  const k = await cleAes(b64.fromUrl(lien), 'decrypt');
  const jwk = await subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(cles.privee.iv) }, k, b64.dec(cles.privee.ct));
  return subtle.importKey('jwk', JSON.parse(td.decode(jwk)), CURVE, false, ['deriveBits']);
}

// --- Données ----------------------------------------------------------------------
export async function sceller(objet, publiqueJwk) {
  const publique = await subtle.importKey('jwk', { ...publiqueJwk, ext: true }, CURVE, false, []);
  const eph = await subtle.generateKey(CURVE, true, ['deriveBits']);
  const k = await aesPartagee(eph.privateKey, publique, 'encrypt');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const clair = await gzip(te.encode(JSON.stringify(objet)));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, k, clair);
  const epk = await subtle.exportKey('jwk', eph.publicKey);
  return { v: 1, epk: { x: epk.x, y: epk.y }, iv: b64.enc(iv), ct: b64.enc(new Uint8Array(ct)) };
}

export async function ouvrir(boite, privee) {
  const epk = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: boite.epk.x, y: boite.epk.y, ext: true }, CURVE, false, []);
  const k = await aesPartagee(privee, epk, 'decrypt');
  const clair = await subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(boite.iv) }, k, b64.dec(boite.ct));
  return JSON.parse(td.decode(await gunzip(new Uint8Array(clair))));
}
