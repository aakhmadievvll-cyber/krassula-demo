// Pure scene math: given the scroll position `v` (vh into the story) say what every layer shows.
// No DOM here, so the choreography can be reasoned about (and tested) on its own.
import { clamp, easeInOut, framePosition, mixHex, progressIn } from '../lib/math.js';
import { dolly } from './camera.js';
import { COLORS } from './script.js';

/**
 * Which sequence and frame the canvas shows; null when stills fully cover it.
 * `position` is fractional (the canvas blends the two nearest frames), `index` the nearest frame.
 */
export function sequenceState(tl, v, frames) {
  const p = (id) => tl.local(id, v);
  const at = (id) => tl.get(id).start;
  const half = (name) => frames[name] / 2;
  const shot = (name, t, first, last) => {
    const position = framePosition(t, first, last);
    return { name, index: Math.round(position), position };
  };

  if (v < at('salute')) {
    if (v < at('float')) return shot('unbox', p('unbox'), 0, half('unbox') - 1);
    return shot('unbox', p('float'), half('unbox'), frames.unbox - 1);
  }
  if (v < at('approach')) return null;
  if (v < at('grow')) {
    if (v < at('unscrew')) return shot('transform', p('unhook'), 0, half('transform') - 1);
    return shot('transform', p('unscrew'), half('transform'), frames.transform - 1);
  }
  return shot('grow', p('grow'), 0, frames.grow - 1);
}

/**
 * Where each sequence's decoded window should sit: the frame on screen, the first frame of the
 * scene coming next, the last frame of the scene just left (for scrolling back), or null when
 * the scene is far away and its decoded frames can be freed.
 */
export function sequenceFocus(tl, v, frames) {
  const at = (id) => tl.get(id).start;
  const shown = sequenceState(tl, v, frames);
  const onScreen = (name) => (shown?.name === name ? shown.position : null);
  const between = (from, to) => v >= at(from) && v < at(to);
  const transformNearby = () => {
    if (between('salute', 'approach')) return 0;
    if (between('grow', 'outro')) return frames.transform - 1;
    return null;
  };
  return {
    unbox: onScreen('unbox') ?? (v < at('dawn') ? frames.unbox - 1 : null),
    transform: onScreen('transform') ?? transformNearby(),
    grow: onScreen('grow') ?? (v >= at('unscrew') ? 0 : null),
  };
}

/** Camera framing: 0 = close-up, 1 = room. */
export function cameraState(tl, v, reduceMotion) {
  let e = 0;
  if (v >= tl.get('pullback').start && v < tl.get('approach').start) {
    e = easeInOut(tl.local('pullback', v));
  } else if (v >= tl.get('approach').start && v < tl.get('approach').end) {
    e = 1 - easeInOut(tl.local('approach', v));
  }
  return dolly(e, reduceMotion);
}

/** Opacity of the room stills and the fireworks clip: the room comes in with fireworks already lit. */
export function stillsState(tl, v) {
  const p = (id) => tl.local(id, v);
  const inRange = (from, to) => v >= tl.get(from).start && v < tl.get(to).end;

  const night = inRange('pullback', 'dawn') ? progressIn(p('pullback'), 0.12, 0.55) : 0;
  let morning = 0;
  if (inRange('dawn', 'dawn')) morning = easeInOut(progressIn(p('dawn'), 0.1, 0.75));
  if (inRange('approach', 'approach')) morning = 1 - progressIn(p('approach'), 0.35, 0.85);
  return { night, salute: night, morning };
}

/** Night → morning: page color and text tone. */
export function toneState(tl, v) {
  const mix = v >= tl.get('dawn').start ? easeInOut(progressIn(tl.local('dawn', v), 0.15, 0.7)) : 0;
  return { scene: mixHex(COLORS.night, COLORS.morning, mix), tone: mix > 0.5 ? 'day' : 'night' };
}

/** Hotspots on the revealed pot appear one by one, then leave when growth starts. */
export function hotspotState(tl, v, count) {
  const reveal = tl.local('reveal', v);
  const leave = 1 - progressIn(tl.local('grow', v), 0, 0.12);
  return Array.from({ length: count }, (_, i) =>
    v < tl.get('reveal').start ? 0 : Math.min(progressIn(reveal, 0.08 + i * 0.16, 0.24 + i * 0.16), leave),
  );
}

/** Index of the active month in the growth calendar. */
export const monthState = (tl, v, months) => clamp(Math.floor(tl.local('grow', v) * months), 0, months - 1);
