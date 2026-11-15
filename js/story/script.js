// The story's screenplay: scroll lengths (in vh), when each line of copy is on screen, and chapter names.

export const SEGMENTS = Object.freeze([
  { id: 'intro', len: 60 },      // closed box, headline
  { id: 'unbox', len: 140 },     // lid opens, the ornament rises        (unbox frames 0–71)
  { id: 'float', len: 120 },     // it flies toward you, onto a branch   (unbox frames 72–143)
  { id: 'tree', len: 130 },      // close-up on the branch: meet the product
  { id: 'pullback', len: 100 },  // camera pulls back into a room where fireworks are already going
  { id: 'salute', len: 210 },    // fireworks behind the window: "any tree", then the wish
  { id: 'dawn', len: 130 },      // night turns into the quiet morning after
  { id: 'approach', len: 80 },   // camera moves back to the ornament
  { id: 'unhook', len: 120 },    // taken off the branch                (transform frames 0–71)
  { id: 'unscrew', len: 190 },   // the top unscrews, a pot appears      (transform frames 72–143)
  { id: 'reveal', len: 110 },    // benefit: a living reminder
  { id: 'grow', len: 160 },      // benefit: a child's first tree        (grow frames 0–71)
  { id: 'outro', len: 70 },
]);

/** [segment, progress] pairs; `fadeIn` overrides the cross-fade length in vh. */
export const BEATS = Object.freeze([
  { id: 'hero', from: ['intro', 0], to: ['unbox', 0.2], fadeIn: 0 },
  { id: 'unbox', from: ['unbox', 0.35], to: ['float', 0.35] },
  { id: 'product', from: ['float', 0.8], to: ['pullback', 0.3] },
  { id: 'anytree', from: ['pullback', 0.5], to: ['salute', 0.45] },
  { id: 'wish', from: ['salute', 0.5], to: ['dawn', 0.2] },
  { id: 'after', from: ['dawn', 0.35], to: ['approach', 0.55] },
  { id: 'unhook', from: ['approach', 0.85], to: ['unscrew', 0.12] },
  { id: 'unscrew', from: ['unscrew', 0.12], to: ['unscrew', 0.85] },
  { id: 'reminder', from: ['unscrew', 0.88], to: ['grow', 0.12] },
  { id: 'child', from: ['grow', 0.15], to: ['outro', 0.15] },
  { id: 'outro', from: ['outro', 0.2], to: ['outro', 3] },
]);

export const BEAT_FADE = 16;

export const CHAPTERS = Object.freeze([
  { label: '1. Коробка', segments: ['intro', 'unbox', 'float'] },
  { label: '2. Знакомство', segments: ['tree'] },
  { label: '3. Новогодняя ночь', segments: ['pullback', 'salute'] },
  { label: '4. Утро', segments: ['dawn', 'approach'] },
  { label: '5. Превращение', segments: ['unhook', 'unscrew', 'reveal'] },
  { label: '6. Рост', segments: ['grow', 'outro'] },
]);

/** Where the ornament sits inside the square frames (fractions of the frame). */
export const CAMERA = Object.freeze({
  closeUp: { x: 0.5, y: 0.576 },
  room: { x: 0.273, y: 0.77 },
  zoom: 2.5,
});

export const COLORS = Object.freeze({
  night: '#0a100d',
  morning: '#f5e8da',
});
