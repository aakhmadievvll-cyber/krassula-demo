// Which visitor actions become Yandex Metrika goals, and the relay that holds them until the
// visitor makes a cookie choice. No DOM here, so it is covered by unit tests.

/** Story segment reached → goal. The other segments are steps inside these chapters. */
export const STORY_GOALS = Object.freeze({
  tree: 'story_meet',
  pullback: 'story_night',
  dawn: 'story_morning',
  unhook: 'story_transform',
  grow: 'story_grow',
  outro: 'story_end',
});

/** Section scrolled into view → goal. */
export const SECTION_GOALS = Object.freeze({
  gift: 'section_gift',
  real: 'section_real',
  buy: 'section_buy',
});

/** Every goal the site sends, with the name to give it in Metrika (see DEPLOY.md). */
export const GOAL_NAMES = Object.freeze({
  story_meet: 'История: знакомство с шаром',
  story_night: 'История: новогодняя ночь',
  story_morning: 'История: утро после праздников',
  story_transform: 'История: шар превращается в горшок',
  story_grow: 'История: дерево растёт',
  story_end: 'История: досмотрел до конца',
  story_skip: 'Нажал «Пропустить историю»',
  section_gift: 'Дошёл до блока «Кому подарите?»',
  section_real: 'Дошёл до живых фото',
  section_buy: 'Дошёл до формы заявки',
  buy_click: 'Нажал «Где купить»',
  recipient_pick: 'Выбрал, кому подарить',
  form_start: 'Начал заполнять заявку',
  form_error: 'Ошибка в заявке',
  lead_sent: 'Отправил заявку',
});

// Progress goals count once per page view; clicks and choices count every time.
const ONCE_PER_PAGE = new Set([
  ...Object.values(STORY_GOALS),
  ...Object.values(SECTION_GOALS),
  'form_start',
]);

const MAX_PARAM_LENGTH = 80;
const DEFAULT_WAITING_LIMIT = 60;

/**
 * Keeps only short strings and finite numbers, so a stray object or a long text never leaves the page.
 * @param {unknown} params
 * @returns {Record<string, string | number> | undefined}
 */
export function cleanParams(params) {
  if (!params || typeof params !== 'object') return undefined;
  const entries = Object.entries(params).filter(
    ([, value]) =>
      (typeof value === 'string' && value.length > 0 && value.length <= MAX_PARAM_LENGTH) ||
      (typeof value === 'number' && Number.isFinite(value)),
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Holds goals until the visitor decides: accepted → everything waiting is sent, declined → dropped.
 * @param {{ limit?: number }} [options]
 */
export function createGoalRelay({ limit = DEFAULT_WAITING_LIMIT } = {}) {
  let send = null;
  let isClosed = false;
  let waiting = [];
  const seen = new Set();

  return {
    /** @param {{ goal: string, params?: unknown }} event */
    push({ goal, params } = {}) {
      if (!Object.hasOwn(GOAL_NAMES, goal)) return;
      if (ONCE_PER_PAGE.has(goal)) {
        if (seen.has(goal)) return;
        seen.add(goal);
      }
      const event = { goal, params: cleanParams(params) };
      if (send) send(event);
      else if (!isClosed && waiting.length < limit) waiting = [...waiting, event];
    },
    /** @param {(event: { goal: string, params?: Record<string, string | number> }) => void} sender */
    open(sender) {
      send = sender;
      isClosed = false;
      const ready = waiting;
      waiting = [];
      ready.forEach(sender);
    },
    close() {
      send = null;
      isClosed = true;
      waiting = [];
    },
  };
}
