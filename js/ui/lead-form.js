// "Узнать, где купить": validates with the same rules as the server, sends JSON, explains every outcome.
import { validateLead, RECIPIENT_LABELS } from '../lib/lead.js';
import { track } from '../lib/track.js';

const FIELD_ORDER = ['name', 'contact', 'consent'];
const MESSAGES = Object.freeze({
  sending: 'Отправляем…',
  failed: 'Не получилось отправить заявку. Попробуйте ещё раз через минуту.',
  offline: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  demo: 'Это демо-версия сайта: заявка никуда не отправится.',
  demoThanks: 'Это демо-версия, поэтому заявка никуда не ушла: имя и контакт нигде не сохранились.',
});

/**
 * @param {{ form: HTMLFormElement, wrap: HTMLElement, thanks: HTMLElement, thanksTitle: HTMLElement }} elements
 */
export function initLeadForm({ form, wrap, thanks, thanksTitle }) {
  // The static demo (scripts/build-demo.mjs) has no server: the form shows the flow and sends nothing.
  const isDemo = form.dataset.demo === 'true';
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('[data-submit]');
  const errorFor = Object.fromEntries(
    [...form.querySelectorAll('[data-error-for]')].map((el) => [el.dataset.errorFor, el]),
  );

  const readForm = () => ({
    name: form.elements.name.value,
    contact: form.elements.contact.value,
    recipient: form.elements.recipient.value || null,
    consent: form.elements.consent.checked,
    website: form.elements.website.value,
  });

  const showErrors = (errors) => {
    for (const field of FIELD_ORDER) {
      const message = errors[field] ?? '';
      errorFor[field].textContent = message;
      form.elements[field].setAttribute('aria-invalid', String(Boolean(message)));
    }
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) form.elements[first].focus();
    return Boolean(first);
  };

  // Only which fields failed is reported, never what was typed into them.
  const reportErrors = (errors, where) => {
    const fields = FIELD_ORDER.filter((field) => errors[field]).join(', ');
    if (fields) track('form_error', { fields, where });
  };

  const setStatus = (text, kind = 'info') => {
    status.textContent = text;
    status.dataset.kind = kind;
  };

  const setBusy = (isBusy) => {
    submit.disabled = isBusy;
    submit.setAttribute('aria-busy', String(isBusy));
  };

  const showThanks = (name) => {
    thanksTitle.textContent = isDemo ? `Спасибо, ${name}!` : `Спасибо, ${name}! Скоро свяжемся`;
    if (isDemo) {
      thanksTitle.after(Object.assign(document.createElement('p'), { textContent: MESSAGES.demoThanks }));
    }
    wrap.hidden = true;
    thanks.hidden = false;
    thanksTitle.focus();
  };

  async function send(payload) {
    const response = await fetch(form.action, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  }

  async function onSubmit(event) {
    event.preventDefault();
    const payload = readForm();
    const check = validateLead(payload);
    if (showErrors(check.errors)) {
      reportErrors(check.errors, 'в браузере');
      return;
    }
    if (isDemo) {
      showThanks(check.value.name);
      return;
    }

    setBusy(true);
    setStatus(MESSAGES.sending);
    try {
      const { status: code, body } = await send(payload);
      if (code === 201 && body?.success) {
        track('lead_sent', { recipient: RECIPIENT_LABELS[check.value.recipient] ?? 'не выбрано' });
        showThanks(check.value.name);
        return;
      }
      if (code === 422 && body?.errors) {
        setStatus('');
        showErrors(body.errors);
        reportErrors(body.errors, 'на сервере');
        return;
      }
      setStatus(body?.error ?? MESSAGES.failed, 'error');
      track('form_error', { fields: `ответ сервера ${code}`, where: 'на сервере' });
    } catch {
      setStatus(MESSAGES.offline, 'error');
      track('form_error', { fields: 'нет связи', where: 'в браузере' });
    } finally {
      setBusy(false);
    }
  }

  if (isDemo) setStatus(MESSAGES.demo);
  form.addEventListener('submit', onSubmit);
  form.addEventListener('focusin', () => track('form_start'), { once: true });
  form.addEventListener('input', (event) => {
    const field = event.target.name;
    if (errorFor[field]?.textContent) {
      errorFor[field].textContent = '';
      event.target.setAttribute('aria-invalid', 'false');
    }
  });
}
