// Turns what happens on the page into goals: marked clicks, story progress, sections scrolled to.
import { track } from '../lib/track.js';
import { STORY_GOALS, SECTION_GOALS } from './goals.js';

// A section counts as reached when its top passes 60% of the screen height.
const SECTION_ROOT_MARGIN = '0px 0px -40% 0px';

/**
 * Declarative clicks: <a data-track="buy_click" data-track-place="шапка"> sends goal buy_click with
 * { place: 'шапка' }. Every data-track-* attribute becomes a parameter.
 */
export function trackClicks(root = document) {
  root.addEventListener('click', (event) => {
    const el = event.target instanceof Element ? event.target.closest('[data-track]') : null;
    if (!el) return;
    const params = Object.fromEntries(
      Object.entries(el.dataset)
        .filter(([key]) => key.startsWith('track') && key !== 'track')
        .map(([key, value]) => [key.slice('track'.length).toLowerCase(), value]),
    );
    track(el.dataset.track, params);
  });
}

/** The story director announces each segment it shows; the chapter openings become goals. */
export function trackStory(story) {
  story?.addEventListener('story:segment', (event) => {
    const goal = STORY_GOALS[event.detail?.id];
    if (goal) track(goal);
  });
}

export function trackSections(doc = document) {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        track(SECTION_GOALS[entry.target.id]);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: SECTION_ROOT_MARGIN },
  );
  for (const id of Object.keys(SECTION_GOALS)) {
    const section = doc.getElementById(id);
    if (section) observer.observe(section);
  }
}
