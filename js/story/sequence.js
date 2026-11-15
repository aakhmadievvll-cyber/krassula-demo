import { FRAME, bracket, nextToLoad, windowOrder } from '../lib/sequence-order.js';

// Parallel downloads: frames are small (20–40 KB), so the wait is mostly latency, not bandwidth.
const CONCURRENCY = 6;
const RETRY_DELAY_MS = 800;
// Decoded frames are kept only around the playhead: a decoded 960 px frame takes ~3.7 MB.
const DECODE_REACH = Object.freeze({ ahead: 12, behind: 4 });
const KEEP_MARGIN = 6;
const MAX_DECODING = 4;
// Frames further apart than this (about half a second of the clip) are not blended into each other.
const MAX_BLEND_GAP = 16;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Decodes off the main thread where the browser can (createImageBitmap), so drawing a frame never
 * stalls scrolling. Old browsers fall back to an <img> that reuses the cached download.
 */
async function decodeFrame(blob, url) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

const dispose = (image) => image?.close?.();

/**
 * A scroll-scrubbed image sequence.
 *
 * Frames download as compressed files, coarse-to-fine and ahead of the playhead first, and only a short window
 * around the playhead is decoded. `focus(position)` moves that window; `view(position)` returns the
 * decoded frames to blend for a fractional position, so the scene keeps moving while the rest arrives.
 * `release()` forgets everything; priming again later refills from the HTTP cache.
 */
export class FrameSequence {
  /**
   * @param {{ name: string, count: number, size: number, onFrameReady?: () => void }} options
   */
  constructor({ name, count, size, onFrameReady = () => {} }) {
    this.name = name;
    this.count = count;
    this.urls = Array.from(
      { length: count },
      (_, i) => `assets/seq/${name}/${size}/${String(i + 1).padStart(3, '0')}.webp`,
    );
    this.onFrameReady = onFrameReady;
    this.generation = 0;
    this.failures = 0;
    this.reset();
  }

  reset() {
    this.status = new Array(this.count).fill(FRAME.idle);
    this.blobs = new Array(this.count).fill(null);
    this.decoded = new Map();
    this.decoding = new Set();
    this.anchors = [];
    this.playhead = null;
    this.direction = 1;
    this.started = false;
  }

  /** Every frame has been downloaded (or given up on). */
  get isComplete() {
    return this.status.every((s) => s === FRAME.loaded || s === FRAME.failed);
  }

  /** Starts downloading (idempotent while loaded). */
  prime() {
    if (this.started) return;
    this.started = true;
    const generation = this.generation;
    const worker = async () => {
      while (generation === this.generation) {
        const index = nextToLoad(this.status, this.focusState());
        if (index === -1) return;
        this.status[index] = FRAME.loading;
        await this.download(index, generation);
      }
    };
    for (let i = 0; i < CONCURRENCY; i += 1) worker();
  }

  /** Forgets every frame; downloads and decodes from before the release are discarded. */
  release() {
    if (!this.started && this.decoded.size === 0) return;
    this.generation += 1;
    this.decoded.forEach(dispose);
    this.reset();
  }

  /**
   * Where the visitor is in this sequence (fractional frame), or null when it is off screen
   * and nowhere near: then its decoded frames are freed but the downloads are kept.
   * @param {number | null} position
   */
  focus(position) {
    if (position === null) {
      if (this.playhead !== null) {
        this.playhead = null;
        this.decoded.forEach(dispose);
        this.decoded.clear();
      }
      return;
    }
    const at = Math.min(this.count - 1, Math.max(0, Math.round(position)));
    if (this.playhead !== null && at !== this.playhead) this.direction = at > this.playhead ? 1 : -1;
    if (at === this.playhead) return;
    this.playhead = at;
    this.decodeAround();
  }

  focusState() {
    return this.playhead === null ? null : { at: this.playhead, direction: this.direction };
  }

  async download(index, generation, attempt = 1) {
    try {
      const response = await fetch(this.urls[index]);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (generation !== this.generation) return;
      this.blobs[index] = blob;
      this.status[index] = FRAME.loaded;
      this.decodeAround();
    } catch {
      if (generation !== this.generation) return;
      if (attempt === 1) {
        await wait(RETRY_DELAY_MS);
        await this.download(index, generation, 2);
        return;
      }
      // Still missing after a retry: the neighbouring frames cover the gap while scrubbing.
      this.status[index] = FRAME.failed;
      this.failures += 1;
    }
  }

  isKept(index) {
    if (this.playhead === null) return false;
    if (this.anchors.includes(index)) return true;
    const reach = (n) => n + KEEP_MARGIN;
    const ahead = this.direction === 1 ? reach(DECODE_REACH.ahead) : reach(DECODE_REACH.behind);
    const behind = this.direction === 1 ? reach(DECODE_REACH.behind) : reach(DECODE_REACH.ahead);
    return index >= this.playhead - behind && index <= this.playhead + ahead;
  }

  /** The downloaded frames nearest to the playhead on each side, however far: shown until closer ones arrive. */
  findAnchors() {
    const first = (from, step) => {
      for (let i = from; i >= 0 && i < this.count; i += step) if (this.blobs[i]) return i;
      return -1;
    };
    return [first(this.playhead, -1), first(this.playhead + 1, 1)].filter((i) => i !== -1);
  }

  /** Frees decoded frames far from the playhead and decodes the nearest missing ones. */
  decodeAround() {
    if (this.playhead === null) return;
    this.anchors = this.findAnchors();
    for (const [index, image] of this.decoded) {
      if (!this.isKept(index)) {
        dispose(image);
        this.decoded.delete(index);
      }
    }
    const nearby = [...this.anchors, ...windowOrder(this.playhead, this.direction, { ...DECODE_REACH, count: this.count })];
    for (const index of nearby) {
      if (this.decoding.size >= MAX_DECODING) return;
      if (this.blobs[index] && !this.decoded.has(index) && !this.decoding.has(index)) {
        this.decode(index, this.generation);
      }
    }
  }

  async decode(index, generation) {
    this.decoding.add(index);
    try {
      const image = await decodeFrame(this.blobs[index], this.urls[index]);
      if (generation !== this.generation || !this.isKept(index)) {
        dispose(image);
        return;
      }
      this.decoded.set(index, image);
      this.onFrameReady(this, index);
    } catch {
      // A broken file: treat it like a failed download, the neighbours cover it.
      if (generation === this.generation) {
        this.blobs[index] = null;
        this.status[index] = FRAME.failed;
        this.failures += 1;
      }
    } finally {
      if (generation === this.generation) {
        this.decoding.delete(index);
        this.decodeAround();
      }
    }
  }

  /**
   * What to draw for a fractional frame `position`: the decoded frame at or before it and, when a
   * close one follows, that frame with the share to blend over it. Null while nothing is decoded.
   * @returns {{ first: { image: CanvasImageSource, index: number },
   *             second: { image: CanvasImageSource, index: number } | null, share: number } | null}
   */
  view(position) {
    const pick = bracket(position, this.count, (i) => this.decoded.has(i), MAX_BLEND_GAP);
    if (!pick) return null;
    const entry = (index) => ({ image: this.decoded.get(index), index });
    return {
      first: entry(pick.first),
      second: pick.second === null ? null : entry(pick.second),
      share: pick.share,
    };
  }
}
