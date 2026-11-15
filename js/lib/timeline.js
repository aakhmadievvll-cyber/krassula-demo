import { progressIn } from './math.js';

/**
 * Lays scroll segments end to end. Lengths are in any unit (the story uses vh).
 * Returns a frozen object: items, total, get(id), local(id, v), at(v), point(id, t).
 */
export function buildTimeline(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Timeline needs at least one segment');
  }

  const seen = new Set();
  let cursor = 0;
  const items = segments.map(({ id, len }) => {
    if (!(len > 0)) throw new Error(`Segment "${id}" needs a positive length`);
    if (seen.has(id)) throw new Error(`Timeline has a duplicate segment "${id}"`);
    seen.add(id);
    const item = Object.freeze({ id, start: cursor, end: cursor + len, len });
    cursor += len;
    return item;
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  const get = (id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`Timeline has no unknown segment "${id}"`);
    return item;
  };

  return Object.freeze({
    items: Object.freeze(items),
    total: cursor,
    get,
    local: (id, value) => {
      const { start, end } = get(id);
      return progressIn(value, start, end);
    },
    at: (value) => items.find((item) => value < item.end) ?? items[items.length - 1],
    point: (id, t) => {
      const { start, len } = get(id);
      return start + len * t;
    },
  });
}
