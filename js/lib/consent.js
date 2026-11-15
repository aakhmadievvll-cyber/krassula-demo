// The visitor's cookie choice, kept in localStorage. Saving the choice itself needs no consent:
// without it we would have to ask again on every page.

export const CONSENT_KEY = 'krassula-cookie-consent';
// Bump when the banner starts asking about something new: everyone is asked again.
export const CONSENT_VERSION = 1;

export const CONSENT = Object.freeze({ granted: 'granted', denied: 'denied' });

/**
 * @param {Pick<Storage, 'getItem'> | null} storage
 * @returns {'granted' | 'denied' | null} null when the visitor has not decided yet
 */
export function readConsent(storage) {
  let saved = null;
  try {
    saved = JSON.parse(storage?.getItem(CONSENT_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (saved?.v !== CONSENT_VERSION) return null;
  if (saved.analytics === true) return CONSENT.granted;
  if (saved.analytics === false) return CONSENT.denied;
  return null;
}

/**
 * @param {Pick<Storage, 'setItem'> | null} storage
 * @param {boolean} isGranted
 * @returns {boolean} false when the browser refused to store it (private mode, blocked site data)
 */
export function writeConsent(storage, isGranted, now = new Date()) {
  const record = { v: CONSENT_VERSION, analytics: isGranted, at: now.toISOString() };
  try {
    storage?.setItem(CONSENT_KEY, JSON.stringify(record));
    return Boolean(storage);
  } catch {
    return false;
  }
}
