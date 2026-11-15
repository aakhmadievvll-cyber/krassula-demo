import { createDirector } from './story/director.js';
import { initRecipients } from './ui/recipients.js';
import { initLeadForm } from './ui/lead-form.js';
import { initAnalytics } from './analytics/index.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const story = document.querySelector('[data-story]');

// First, so the story's opening segment is already heard. Analytics must never break the page.
try {
  initAnalytics({ story, settingsButtons: [...document.querySelectorAll('[data-cookie-settings]')] });
} catch (error) {
  window.reportError?.(error);
}

try {
  createDirector({ story, reduceMotion }).start();
} catch (error) {
  // Without the director the story still reads top to bottom as a static page.
  story.classList.add('is-static');
  window.reportError?.(error);
}

initRecipients({
  fieldset: document.querySelector('[data-recipients]'),
  panels: [...document.querySelectorAll('[data-panel]')],
  select: document.querySelector('[data-recipient-select]'),
  picks: [...document.querySelectorAll('[data-pick]')],
});

initLeadForm({
  form: document.querySelector('[data-lead-form]'),
  wrap: document.querySelector('[data-form-wrap]'),
  thanks: document.querySelector('[data-thanks]'),
  thanksTitle: document.querySelector('[data-thanks-title]'),
});
