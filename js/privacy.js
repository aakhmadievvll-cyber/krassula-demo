// The policy page shares the cookie question and the "Настройки cookie" button with the main page.
import { initAnalytics } from './analytics/index.js';

try {
  initAnalytics({ settingsButtons: [...document.querySelectorAll('[data-cookie-settings]')], policyHref: '#cookies' });
} catch (error) {
  window.reportError?.(error);
}
