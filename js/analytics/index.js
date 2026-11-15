// Yandex Metrika with consent: nothing is loaded and no cookie is set until the visitor allows it.
import { METRIKA } from './config.js';
import { createGoalRelay } from './goals.js';
import { isCounterId, loadMetrika, forgetMetrika } from './metrika.js';
import { trackClicks, trackStory, trackSections } from './page-events.js';
import { CONSENT, readConsent, writeConsent } from '../lib/consent.js';
import { TRACK_EVENT } from '../lib/track.js';
import { createCookieBanner } from '../ui/cookie-banner.js';

// On a local preview goals are announced here instead of being sent, so they can be checked.
export const PREVIEW_GOAL_EVENT = 'krassula:goal-preview';

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null; // Safari with site data blocked throws on access
  }
}

/**
 * @param {{ story?: HTMLElement | null, settingsButtons?: HTMLElement[], policyHref?: string }} [options]
 */
export function initAnalytics({ story = null, settingsButtons = [], policyHref = 'privacy.html#cookies' } = {}) {
  // Without a counter the site sets no cookies, so there is nothing to ask about.
  if (!isCounterId(METRIKA.counterId)) return;

  const storage = browserStorage();
  const relay = createGoalRelay();
  const isLiveHost = METRIKA.hosts.includes(window.location.hostname);
  let consent = readConsent(storage);
  let metrika = null;

  window.addEventListener(TRACK_EVENT, (event) => relay.push(event.detail));
  trackClicks(document);
  trackStory(story);
  trackSections(document);

  const start = () => {
    if (!isLiveHost) {
      relay.open((event) => window.dispatchEvent(new CustomEvent(PREVIEW_GOAL_EVENT, { detail: event })));
      return;
    }
    metrika ??= loadMetrika(METRIKA.counterId);
    relay.open(({ goal, params }) => metrika.goal(goal, params));
  };

  const banner = createCookieBanner({
    policyHref,
    onChoice(isGranted) {
      consent = isGranted ? CONSENT.granted : CONSENT.denied;
      writeConsent(storage, isGranted);
      banner.hide();
      if (isGranted) {
        start();
        return;
      }
      relay.close();
      if (metrika) {
        // A running tag cannot be switched off: clear what it stored and reload without it.
        forgetMetrika(document, storage);
        window.location.reload();
      }
    },
  });

  for (const button of settingsButtons) {
    button.hidden = false;
    button.addEventListener('click', () => banner.show({ current: consent, focus: true }));
  }

  if (consent === CONSENT.granted) start();
  else if (consent === CONSENT.denied) relay.close();
  else banner.show();
}
