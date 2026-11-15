// Binds the pure scene math to the DOM: reads the scroll position once per frame, writes styles.
import { buildTimeline } from '../lib/timeline.js';
import { easeOut, follow, progressIn } from '../lib/math.js';
import { SEGMENTS, BEATS, BEAT_FADE, CHAPTERS } from './script.js';
import { FrameSequence } from './sequence.js';
import { SEQUENCE_FRAMES } from './manifest.js';
import { toTransform } from './camera.js';
import {
  sequenceState,
  sequenceFocus,
  cameraState,
  stillsState,
  toneState,
  hotspotState,
  monthState,
} from './scenes.js';

const SMALL_FILM_PX = 560;
const BEAT_SHIFT_PX = 28;
// The picture glides after the scroll instead of jumping with every wheel notch or finger twitch.
// tau: seconds to cover ~63% of the way; snap: vh beyond which it jumps (a link to another section);
// settle: vh close enough to stop animating.
const FOLLOW = Object.freeze({ tau: 0.09, snap: 200, settle: 0.02 });
const FIRST_STEP_S = 1 / 60;
// Below this share of the next frame the canvas shows a single frame (saves a draw).
const MIN_BLEND = 0.04;

function queryDom(story) {
  const one = (selector, scope = story) => scope.querySelector(selector);
  const layer = (name) => one(`[data-layer="${name}"]`);
  return {
    story,
    stage: one('.story__stage'),
    film: one('.film'),
    canvas: layer('seq'),
    poster: layer('poster'),
    stills: { night: layer('night'), salute: layer('salute'), morning: layer('morning') },
    hotspots: [...story.querySelectorAll('[data-hotspot]')],
    beats: new Map([...story.querySelectorAll('[data-beat]')].map((el) => [el.dataset.beat, el])),
    months: [...story.querySelectorAll('[data-months] li')],
    scrollCue: one('[data-scroll-cue]'),
    skipStory: one('.skip-story'),
    chapter: one('[data-chapter]', document),
    progress: one('[data-progress]', document),
    surfaces: [...document.querySelectorAll('[data-surface]')],
    headerHeight: one('.site-header', document)?.offsetHeight ?? 60,
  };
}

/** Cached style writer: touches the DOM only when a value actually changes. */
function createWriter() {
  const cache = new WeakMap();
  return (el, prop, value) => {
    if (!el) return;
    const props = cache.get(el) ?? {};
    if (props[prop] === value) return;
    cache.set(el, { ...props, [prop]: value });
    if (prop.startsWith('--')) el.style.setProperty(prop, value);
    else el.style[prop] = value;
  };
}

function setFlag(el, isOn) {
  const value = String(isOn);
  if (el.dataset.on !== value) el.dataset.on = value;
}

export function createDirector({ story, reduceMotion }) {
  const tl = buildTimeline(SEGMENTS);
  const dom = queryDom(story);
  const write = createWriter();
  const ctx = dom.canvas.getContext('2d', { alpha: true });
  const beats = BEATS.map((beat) => ({
    ...beat,
    el: dom.beats.get(beat.id),
    start: tl.point(...beat.from),
    end: tl.point(...beat.to),
  }));
  const chapterOf = new Map(CHAPTERS.flatMap((c) => c.segments.map((id) => [id, c.label])));

  let sequences = null;
  let frameSize = 0;
  let lastDrawn = null;
  let lastSegment = null;
  let shown = null;
  let lastStepAt = null;
  let frameRequested = false;
  let videoWanted = false;
  let videoRefused = false;

  function measure() {
    const size = dom.film.getBoundingClientRect().width;
    if (!sequences) {
      frameSize = size <= SMALL_FILM_PX ? 600 : 960;
      const onFrameReady = () => schedule();
      sequences = Object.fromEntries(
        Object.entries(SEQUENCE_FRAMES).map(([name, count]) => [
          name,
          new FrameSequence({ name, count, size: frameSize, onFrameReady }),
        ]),
      );
    }
    // A canvas larger than the frames only adds pixels to fill on every draw; CSS scales it up.
    const px = Math.min(frameSize, Math.round(size * Math.min(window.devicePixelRatio || 1, 2)));
    if (dom.canvas.width !== px) {
      dom.canvas.width = px;
      dom.canvas.height = px;
      lastDrawn = null;
    }
  }

  function position() {
    const travel = dom.story.offsetHeight - dom.stage.offsetHeight;
    const scrolled = -dom.story.getBoundingClientRect().top;
    return travel > 0 ? Math.max(0, (scrolled / travel) * tl.total) : 0;
  }

  /**
   * Coarse-to-fine loading in story order, with a head start for the next scene. At most two
   * sequences stay decoded at a time so phones do not run out of memory; a released one is
   * refilled from the HTTP cache if the visitor scrolls back.
   */
  function prime(v) {
    // Tell each sequence where the visitor is first, so downloads start with what is needed now.
    for (const [name, position] of Object.entries(sequenceFocus(tl, v, SEQUENCE_FRAMES))) {
      sequences[name].focus(position);
    }
    const at = (id) => tl.get(id).start;
    const { unbox, transform, grow } = sequences;
    if (v < at('approach')) unbox.prime();
    else unbox.release();
    if (v >= at('salute') || unbox.isComplete) transform.prime();
    if (v >= at('approach')) grow.prime();
    else grow.release();
    // The fireworks are on screen right after the close-up, so fetch the clip during the unboxing.
    if (v > at('unbox') && dom.stills.salute.preload === 'none') {
      dom.stills.salute.preload = 'auto';
    }
  }

  function renderFilm(v) {
    const seq = sequenceState(tl, v, SEQUENCE_FRAMES);
    const cam = cameraState(tl, v, reduceMotion);
    const stills = stillsState(tl, v);

    write(dom.canvas, 'visibility', seq ? 'visible' : 'hidden');
    write(dom.canvas, 'transform', toTransform(cam.close));
    write(dom.poster, 'transform', toTransform(cam.close));
    if (seq) drawFrame(seq);

    // The clip covers the fireworks still only while it is really playing; a paused or
    // still-buffering video would otherwise paint a black square over the scene.
    const video = dom.stills.salute;
    const isPlaying = !video.paused && video.readyState >= 2;
    const visible = { ...stills, salute: isPlaying ? stills.salute : 0 };
    for (const [name, el] of Object.entries(dom.stills)) {
      write(el, 'opacity', String(visible[name]));
      write(el, 'transform', toTransform(cam.room));
    }
    syncVideo(stills.salute > 0 && !reduceMotion);
  }

  /**
   * Draws the frame under the playhead and, on top, the next available one at the share the
   * playhead has moved towards it: in-between pictures without downloading extra frames, and a
   * dissolve instead of a jump while a slow connection is still filling the gaps.
   */
  function drawFrame({ name, position }) {
    const view = sequences[name].view(position);
    if (!view) return;
    const blend = view.second && view.share >= MIN_BLEND ? Math.round(view.share * 20) / 20 : 0;
    const key = `${name}:${view.first.index}:${blend > 0 ? view.second.index : ''}:${blend}`;
    if (key === lastDrawn) return;
    const { width, height } = dom.canvas;
    ctx.globalAlpha = 1;
    ctx.drawImage(view.first.image, 0, 0, width, height);
    if (blend > 0) {
      ctx.globalAlpha = blend;
      ctx.drawImage(view.second.image, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }
    lastDrawn = key;
    write(dom.poster, 'opacity', '0');
  }

  function syncVideo(wanted) {
    if (wanted === videoWanted || (wanted && videoRefused)) return;
    videoWanted = wanted;
    const video = dom.stills.salute;
    if (!wanted) {
      video.pause();
      return;
    }
    video.play().catch((error) => {
      videoWanted = false;
      // An interrupted play (AbortError) is retried on the next frame. A refusal
      // (iOS Low Power Mode, data saver) is not: the fireworks still already tells the story,
      // and we try again only after the visitor touches the page.
      if (error?.name !== 'NotAllowedError') return;
      videoRefused = true;
      window.addEventListener(
        'pointerdown',
        () => {
          videoRefused = false;
          schedule();
        },
        { once: true, passive: true },
      );
    });
  }

  function renderBeats(v) {
    for (const beat of beats) {
      const fadeIn = beat.fadeIn ?? BEAT_FADE;
      const enter = progressIn(v, beat.start, beat.start + fadeIn);
      const leave = progressIn(v, beat.end - BEAT_FADE, beat.end);
      const opacity = Math.min(enter, 1 - leave);
      const shift = reduceMotion ? 0 : (1 - easeOut(enter)) * BEAT_SHIFT_PX - leave * BEAT_SHIFT_PX * 0.6;
      write(beat.el, 'opacity', opacity.toFixed(3));
      write(beat.el, 'transform', `translate3d(0, ${shift.toFixed(1)}px, 0)`);
    }
  }

  function renderDetails(v) {
    hotspotState(tl, v, dom.hotspots.length).forEach((o, i) => {
      write(dom.hotspots[i], 'opacity', o.toFixed(3));
      write(dom.hotspots[i], 'transform', `scale(${(0.6 + 0.4 * easeOut(o)).toFixed(3)})`);
    });
    const month = monthState(tl, v, dom.months.length);
    dom.months.forEach((el, i) => setFlag(el, i <= month));
  }

  /** After the story the header takes the tone of whatever section sits under it. */
  function surfaceUnderHeader() {
    const probe = dom.headerHeight / 2;
    return dom.surfaces.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top <= probe && rect.bottom > probe;
    });
  }

  function renderChrome(v) {
    const { scene, tone } = toneState(tl, v);
    const root = document.documentElement;
    const ended = v >= tl.total;
    const surface = ended && dom.story.getBoundingClientRect().bottom <= dom.headerHeight / 2
      ? surfaceUnderHeader()
      : null;
    const headerTone = surface?.dataset.surface ?? tone;
    write(root, '--scene', scene);
    write(root, '--header-bg', surface?.dataset.surfaceColor ?? scene);
    if (root.dataset.tone !== headerTone) root.dataset.tone = headerTone;

    write(dom.progress, 'transform', `scaleX(${(v / tl.total).toFixed(4)})`);
    write(dom.progress, 'opacity', ended ? '0' : '1');
    write(dom.scrollCue, 'opacity', (1 - progressIn(v, 0, 18)).toFixed(3));
    const skipVisible = v < tl.get('outro').start;
    write(dom.skipStory, 'opacity', skipVisible ? '1' : '0');
    write(dom.skipStory, 'visibility', skipVisible ? 'visible' : 'hidden');
    const label = chapterOf.get(tl.at(v).id);
    if (dom.chapter.textContent !== label) dom.chapter.textContent = label;
    dom.chapter.dataset.hidden = String(ended);
  }

  /**
   * Tells the page which part of the story is on screen (analytics counts chapter openings).
   * Past the end the stage has scrolled away, so a jump to a later section announces nothing.
   */
  function announceSegment(v) {
    if (v > tl.total) return;
    const { id } = tl.at(v);
    if (id === lastSegment) return;
    lastSegment = id;
    dom.story.dispatchEvent(new CustomEvent('story:segment', { detail: { id } }));
  }

  /** The story position on screen: follows the scroll smoothly, snaps on big jumps. */
  function glide(target, now) {
    if (shown === null || reduceMotion) {
      shown = target;
    } else {
      const dt = lastStepAt === null ? FIRST_STEP_S : Math.min(0.1, (now - lastStepAt) / 1000);
      shown = follow(shown, target, dt, FOLLOW);
    }
    // Idle between scrolls: the next first step must not count the whole pause.
    lastStepAt = shown === target ? null : now;
    return shown;
  }

  function render(now) {
    frameRequested = false;
    // Layout is read once, before any style is written, so the frame never forces a reflow.
    const target = position();
    const v = glide(target, now);
    prime(v);
    renderFilm(v);
    renderBeats(v);
    renderDetails(v);
    renderChrome(v);
    announceSegment(v);
    if (v !== target) schedule();
  }

  function schedule() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(render);
  }

  function start() {
    dom.story.style.setProperty('--story-len', String(tl.total));
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => {
      measure();
      schedule();
    });
    // Reveal or hide the fireworks clip as soon as it actually starts or stops playing.
    for (const type of ['playing', 'pause', 'waiting']) {
      dom.stills.salute.addEventListener(type, schedule);
    }
    schedule();
  }

  return { start, timeline: tl };
}
