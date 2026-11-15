// UI code only reports what the visitor did. Whether anything leaves the browser is decided in
// js/analytics, after the visitor's cookie choice.

export const TRACK_EVENT = 'krassula:track';

/**
 * @param {string} goal goal identifier, as set up in Yandex Metrika
 * @param {Record<string, string | number>} [params] what was chosen or where; never names or contacts
 */
export function track(goal, params) {
  window.dispatchEvent(new CustomEvent(TRACK_EVENT, { detail: { goal, params } }));
}
