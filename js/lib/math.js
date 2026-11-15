// Small pure helpers for scroll-driven animation. Shared by the browser and the tests.

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const lerp = (from, to, t) => from + (to - from) * t;

/** Position of `value` inside [start, end] as 0..1 (a step when the window has no length). */
export const progressIn = (value, start, end) => {
  if (end === start) return value >= end ? 1 : 0;
  return clamp((value - start) / (end - start));
};

/** 0 outside [start, end], 1 inside, with linear fades of length `fade` at both edges. */
export const fadeWindow = (value, start, end, fade) =>
  Math.min(progressIn(value, start, start + fade), 1 - progressIn(value, end - fade, end));

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const easeOut = (t) => 1 - (1 - t) ** 3;

/** Fractional frame position for progress `t` inside [first, last]; the fraction blends two frames. */
export const framePosition = (t, first, last) => lerp(first, last, clamp(t));

/** Frame index for progress `t` inside the frame range [first, last]. */
export const frameAt = (t, first, last) => Math.round(framePosition(t, first, last));

/**
 * One step of a value gliding toward its target (exponential smoothing, independent of frame rate).
 * Snaps when the target is further than `snap` (a jump by link) or closer than `settle` (done).
 * @param {number} current
 * @param {number} target
 * @param {number} dt seconds since the previous step
 * @param {{ tau: number, snap: number, settle: number }} options tau: seconds to cover ~63% of the way
 */
export const follow = (current, target, dt, { tau, snap, settle }) => {
  const distance = target - current;
  if (Math.abs(distance) > snap || Math.abs(distance) < settle || tau <= 0) return target;
  const next = current + distance * (1 - Math.exp(-Math.max(0, dt) / tau));
  return Math.abs(target - next) < settle ? target : next;
};

const HEX = /^#([0-9a-f]{6})$/i;

const toRgb = (hex) => {
  const match = HEX.exec(hex);
  if (!match) throw new TypeError(`Expected a #rrggbb hex color, got "${hex}"`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Blend two #rrggbb colors; t is clamped to 0..1. */
export const mixHex = (a, b, t) => {
  const from = toRgb(a);
  const to = toRgb(b);
  const k = clamp(t);
  return `#${from
    .map((c, i) => Math.round(lerp(c, to[i], k)).toString(16).padStart(2, '0'))
    .join('')}`;
};
