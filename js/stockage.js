// Mémoire de l'appareil. Tout est protégé : navigation privée, stockage bloqué ou plein
// ne doivent jamais casser l'affichage.

const P = 'butinfo:';

function magasin(type) {
  try { return type === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; }
}

export function lire(cle, defaut = null, type = 'local') {
  try {
    const v = magasin(type)?.getItem(P + cle);
    return v == null ? defaut : JSON.parse(v);
  } catch { return defaut; }
}

export function ecrire(cle, valeur, type = 'local') {
  try {
    const m = magasin(type);
    if (!m) return false;
    if (valeur == null) m.removeItem(P + cle);
    else m.setItem(P + cle, JSON.stringify(valeur));
    return true;
  } catch { return false; }
}

export const effacer = (cle, type = 'local') => ecrire(cle, null, type);
