import { lerp } from '../lib/math.js';
import { CAMERA } from './script.js';

const IDENTITY = Object.freeze({ x: 0, y: 0, s: 1 });

/**
 * A matched "dolly" between the close-up frames (ornament centred) and the room shots
 * (ornament small, lower left). e = 0 → close-up framing, e = 1 → room framing.
 * Each layer scales around its own ornament position (set as transform-origin in CSS) and is
 * translated so both ornaments land on the same spot — the cut feels like one camera move.
 */
export function dolly(e, reduceMotion = false) {
  if (reduceMotion) return { close: IDENTITY, room: IDENTITY };
  const { closeUp, room, zoom } = CAMERA;
  const target = { x: lerp(closeUp.x, room.x, e), y: lerp(closeUp.y, room.y, e) };
  const closeScale = lerp(1, 1 / zoom, e);
  return {
    close: { x: target.x - closeUp.x, y: target.y - closeUp.y, s: closeScale },
    room: { x: target.x - room.x, y: target.y - room.y, s: closeScale * zoom },
  };
}

export const toTransform = ({ x, y, s }) =>
  `translate3d(${(x * 100).toFixed(3)}%, ${(y * 100).toFixed(3)}%, 0) scale(${s.toFixed(4)})`;
