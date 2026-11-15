// Loads the Yandex Metrika tag (only after consent) and removes its cookies when consent is withdrawn.

const TAG_URL = 'https://mc.yandex.ru/metrika/tag.js';
const COUNTER_PATTERN = /^\d{5,12}$/;

export const METRIKA_OPTIONS = Object.freeze({
  clickmap: true, // where people click
  trackLinks: true, // outbound links and file downloads
  accurateTrackBounce: true, // a visit under 15 s counts as a bounce
  webvisor: true, // session replay, scroll map and form analytics
});

/** @param {unknown} id */
export function isCounterId(id) {
  return typeof id === 'string' && COUNTER_PATTERN.test(id);
}

/**
 * Same as the official snippet, written as a module because the site's CSP forbids inline scripts.
 * @param {string} counterId
 * @returns {{ goal: (name: string, params?: object) => void }}
 */
export function loadMetrika(counterId, win = window) {
  if (!isCounterId(counterId)) throw new Error(`Номер счётчика Метрики должен быть из цифр, получено «${counterId}»`);
  if (typeof win.ym !== 'function') {
    // Calls made before tag.js arrives wait in ym.a; the tag replays them once it loads.
    win.ym = function ym() {
      (win.ym.a = win.ym.a || []).push(arguments);
    };
    win.ym.l = Date.now();
    const script = win.document.createElement('script');
    script.async = true;
    script.src = TAG_URL;
    win.document.head.append(script);
  }
  win.ym(Number(counterId), 'init', { ...METRIKA_OPTIONS });
  return {
    goal: (name, params) => win.ym(Number(counterId), 'reachGoal', name, params),
  };
}

/**
 * Metrika's own cookie names in a document.cookie string (_ym_uid, _ym_d, _ym_isad, _ym_visorc…).
 * @param {string} cookieString
 */
export function metrikaCookieNames(cookieString) {
  return cookieString
    .split(';')
    .map((pair) => pair.split('=')[0].trim())
    .filter((name) => name.startsWith('_ym'));
}

/** The host and its registrable parent: Metrika puts its cookies on the parent domain. */
export function cookieDomains(hostname) {
  const parts = hostname.split('.');
  const parent = parts.length > 2 ? parts.slice(-2).join('.') : hostname;
  return [...new Set([hostname, parent])];
}

/** Deletes Metrika cookies and its localStorage keys after the visitor withdraws consent. */
export function forgetMetrika(doc = document, storage = null) {
  for (const name of metrikaCookieNames(doc.cookie)) {
    const expired = `${name}=; Max-Age=0; path=/`;
    doc.cookie = expired;
    for (const domain of cookieDomains(doc.location.hostname)) doc.cookie = `${expired}; domain=.${domain}`;
  }
  try {
    const keys = storage ? Object.keys(storage).filter((key) => key.startsWith('_ym')) : [];
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage blocked by the browser: there is nothing of ours in it then.
  }
}
