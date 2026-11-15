// Asks once whether Yandex Metrika may set cookies. Allowing and refusing take one click each,
// and the choice can be changed later from the "Настройки cookie" button.

const COPY = Object.freeze({
  label: 'Cookie и Яндекс Метрика',
  note: 'про cookie',
  text:
    'Хотим понимать, до какого места люди досматривают историю и какую упаковку выбирают. ' +
    'Для этого нужна Яндекс Метрика, а она сохраняет cookie. Имя и телефон из заявки к ней не попадают.',
  more: 'Подробнее',
  accept: 'Разрешить',
  decline: 'Отказаться',
  granted: 'Сейчас Метрика включена.',
  denied: 'Сейчас Метрика выключена.',
});

function element(tag, props = {}, children = []) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children);
  return el;
}

/**
 * @param {{ onChoice: (isGranted: boolean) => void, policyHref: string }} options
 * @returns {{ show: (options?: { current?: string | null, focus?: boolean }) => void, hide: () => void }}
 */
export function createCookieBanner({ onChoice, policyHref }) {
  const state = element('p', { className: 'cookie__state', hidden: true });
  const accept = element('button', { className: 'button cookie__button', type: 'button', textContent: COPY.accept });
  const decline = element('button', {
    className: 'button button--quiet cookie__button',
    type: 'button',
    textContent: COPY.decline,
  });
  const banner = element('aside', { className: 'cookie', hidden: true }, [
    element('p', { className: 'cookie__note', textContent: COPY.note, ariaHidden: 'true' }),
    element('p', { className: 'cookie__text' }, [
      `${COPY.text} `,
      element('a', { className: 'text-link', href: policyHref, textContent: COPY.more }),
    ]),
    state,
    element('div', { className: 'cookie__actions' }, [accept, decline]),
  ]);
  banner.setAttribute('aria-label', COPY.label);

  // Right after the skip link, so keyboard users meet the question early without it stealing focus.
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) skipLink.after(banner);
  else document.body.prepend(banner);

  let returnFocusTo = null;

  const hide = () => {
    banner.hidden = true;
    returnFocusTo?.focus();
    returnFocusTo = null;
  };

  accept.addEventListener('click', () => onChoice(true));
  decline.addEventListener('click', () => onChoice(false));
  banner.addEventListener('keydown', (event) => {
    // Escape only closes a banner the visitor reopened; the first question still needs an answer.
    if (event.key === 'Escape' && returnFocusTo) hide();
  });

  return {
    show({ current = null, focus = false } = {}) {
      state.hidden = !current;
      state.textContent = current ? COPY[current] : '';
      banner.hidden = false;
      if (focus) {
        returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        accept.focus();
      }
    },
    hide,
  };
}
