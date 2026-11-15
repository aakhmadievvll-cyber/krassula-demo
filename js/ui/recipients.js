// "Who is it for": switches the packaging showcase and carries the choice into the lead form.
import { RECIPIENT_LABELS } from '../lib/lead.js';
import { track } from '../lib/track.js';

/**
 * @param {{ fieldset: HTMLFieldSetElement, panels: HTMLElement[], select: HTMLSelectElement,
 *           picks: HTMLElement[] }} elements
 */
export function initRecipients({ fieldset, panels, select, picks }) {
  const radios = [...fieldset.querySelectorAll('input[type="radio"]')];

  const show = (value) => {
    for (const panel of panels) panel.dataset.active = String(panel.dataset.panel === value);
    for (const radio of radios) radio.checked = radio.value === value;
  };

  // The form only remembers a recipient the visitor actually chose.
  const choose = (value) => {
    show(value);
    if ([...select.options].some((option) => option.value === value)) select.value = value;
  };

  const report = (value, source) => {
    if (RECIPIENT_LABELS[value]) track('recipient_pick', { recipient: RECIPIENT_LABELS[value], source });
  };

  fieldset.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'radio') return;
    choose(event.target.value);
    report(event.target.value, 'карточки');
  });

  for (const pick of picks) {
    pick.addEventListener('click', () => choose(pick.dataset.pick));
  }

  select.addEventListener('change', () => {
    if (!select.value) return;
    show(select.value);
    report(select.value, 'форма');
  });

  show(radios.find((radio) => radio.checked)?.value ?? radios[0]?.value);
}
