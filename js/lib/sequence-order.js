/** Download state of one frame. */
export const FRAME = Object.freeze({ idle: 0, loading: 1, loaded: 2, failed: 3 });

// Coarse-to-fine: every 16th frame of the scene, then every 8th, and so on. Whatever the connection,
// frames arrive spread evenly, so the playhead always has one close by to show or blend from.
const STRIDES = [16, 8, 4, 2, 1];

/**
 * Frames around the playhead, nearest first, looking further in the direction of travel.
 * @param {number} at playhead frame
 * @param {1 | -1} direction 1 when scrolling down the story, -1 when scrolling back
 * @param {{ ahead: number, behind: number, count: number }} window
 */
export function windowOrder(at, direction, { ahead, behind, count }) {
  const order = [];
  const push = (i) => {
    if (i >= 0 && i < count) order.push(i);
  };
  push(at);
  for (let d = 1; d <= Math.max(ahead, behind); d += 1) {
    if (d <= ahead) push(at + d * direction);
    if (d <= behind) push(at - d * direction);
  }
  return order;
}

/**
 * The next frame to download. First the frame on screen and the scene's last frame (shown while
 * the camera lingers after the clip). Then coarse-to-fine over the whole scene, and at every level
 * of detail the frames ahead of the playhead before the ones already passed.
 * @param {number[]} status FRAME state per frame
 * @param {{ at: number, direction: 1 | -1 } | null} focus playhead; null means the scene's start
 * @returns {number} frame index, or -1 when nothing is left
 */
export function nextToLoad(status, focus) {
  const count = status.length;
  const at = focus?.at ?? 0;
  const direction = focus?.direction ?? 1;
  const idle = (i) => status[i] === FRAME.idle;
  if (count === 0) return -1;
  if (idle(at)) return at;
  if (idle(count - 1)) return count - 1;
  for (const stride of STRIDES) {
    for (const sign of [direction, -direction]) {
      for (let i = at + sign; i >= 0 && i < count; i += sign) {
        if (i % stride === 0 && idle(i)) return i;
      }
    }
  }
  return -1;
}

/**
 * The two available frames around a fractional `position` and how far between them it sits.
 * Blending them gives an in-between picture; frames further apart than `maxGap` are not blended
 * (a dissolve between very different poses looks worse than a cut), the nearer one is shown alone.
 * @param {(index: number) => boolean} has whether a frame is ready
 * @returns {{ first: number, second: number | null, share: number } | null}
 */
export function bracket(position, count, has, maxGap) {
  const base = Math.min(count - 1, Math.max(0, Math.floor(position)));
  let before = -1;
  for (let i = base; i >= 0; i -= 1) {
    if (has(i)) {
      before = i;
      break;
    }
  }
  let after = -1;
  for (let i = base + 1; i < count; i += 1) {
    if (has(i)) {
      after = i;
      break;
    }
  }
  if (before === -1 && after === -1) return null;
  if (before === -1) return { first: after, second: null, share: 0 };
  if (after === -1 || position <= before) return { first: before, second: null, share: 0 };
  if (after - before > maxGap) {
    const nearer = position - before <= after - position ? before : after;
    return { first: nearer, second: null, share: 0 };
  }
  return { first: before, second: after, share: (position - before) / (after - before) };
}
