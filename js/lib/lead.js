// Lead validation shared by the form (browser) and the server. Pure: never mutates its input.

export const RECIPIENTS = Object.freeze(['family', 'friends', 'kids']);

/** Human labels for reports and notifications. */
export const RECIPIENT_LABELS = Object.freeze({
  family: 'родителям и коллегам',
  friends: 'друзьям и любимым',
  kids: 'ребёнку',
});

export const CONTACT_LABELS = Object.freeze({
  phone: 'телефон',
  telegram: 'Telegram',
  email: 'почта',
});

const NAME_MIN = 2;
const NAME_MAX = 60;
const CONTACT_MAX = 120;
const NAME_PATTERN = /^[\p{L}][\p{L}\s'’.-]*$/u;
const TELEGRAM_PATTERN = /^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/|@)([a-z][a-z0-9_]{4,31})$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^[+\d\s()-]+$/;

export const MESSAGES = Object.freeze({
  name: 'Напишите, как к вам обращаться',
  contactMissing: 'Оставьте телефон, Telegram или почту',
  contactInvalid: 'Похоже на опечатку: нужен телефон, @ник в Telegram или почта',
  consent: 'Нужно ваше согласие, чтобы мы могли ответить',
  payload: 'Не получилось прочитать заявку',
});

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

function normalizePhone(raw) {
  if (!PHONE_CHARS.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return { type: 'phone', value: `+${digits}` };
}

/** Detects phone / Telegram / email and returns a canonical form, or null. */
export function normalizeContact(input) {
  const raw = asText(input);
  if (!raw || raw.length > CONTACT_MAX) return null;

  const telegram = TELEGRAM_PATTERN.exec(raw);
  if (telegram) return { type: 'telegram', value: `@${telegram[1]}` };
  if (EMAIL_PATTERN.test(raw)) return { type: 'email', value: raw.toLowerCase() };
  return normalizePhone(raw);
}

function checkName(input) {
  const name = asText(input).replace(/\s+/g, ' ');
  const isValid = name.length >= NAME_MIN && name.length <= NAME_MAX && NAME_PATTERN.test(name);
  return isValid ? { name } : { error: MESSAGES.name };
}

function checkContact(input) {
  if (!asText(input)) return { error: MESSAGES.contactMissing };
  const contact = normalizeContact(input);
  return contact ? { contact } : { error: MESSAGES.contactInvalid };
}

/**
 * @returns {{ ok: boolean, value: object|null, errors: Record<string, string> }}
 */
export function validateLead(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, value: null, errors: { form: MESSAGES.payload } };
  }

  const name = checkName(payload.name);
  const contact = checkContact(payload.contact);
  const errors = {
    ...(name.error ? { name: name.error } : {}),
    ...(contact.error ? { contact: contact.error } : {}),
    ...(payload.consent === true ? {} : { consent: MESSAGES.consent }),
  };

  if (Object.keys(errors).length > 0) return { ok: false, value: null, errors };

  return {
    ok: true,
    errors: {},
    value: {
      name: name.name,
      contact: contact.contact.value,
      contactType: contact.contact.type,
      recipient: RECIPIENTS.includes(payload.recipient) ? payload.recipient : null,
    },
  };
}
