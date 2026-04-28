import type { CSSProperties } from 'react';

interface Cat {
  emoji: string;
  /** seconds for one full traversal */
  dur: number;
  /** -1 = walks right-to-left (mirrored), +1 = left-to-right */
  dir: 1 | -1;
  /** starting `left` percentage */
  from: number;
  /** ending `left` percentage */
  to: number;
  /** negative delay so each cat is at a different point along its loop */
  delay: number;
  /** emoji font size */
  size: number;
  /** distance from the bottom of the viewport (above the plinth) */
  bottom: number;
}

const CATS: Cat[] = [
  { emoji: '🐈',   dur: 38, dir:  1, from:  -8, to: 110, delay:   0, size: 22, bottom: 26 },
  { emoji: '🐈‍⬛', dur: 56, dir: -1, from: 110, to:  -8, delay: -22, size: 24, bottom: 24 },
  { emoji: '🐱',   dur: 70, dir:  1, from:  -8, to: 110, delay: -45, size: 18, bottom: 27 },
  { emoji: '🐾',   dur: 90, dir: -1, from: 110, to:  -8, delay: -10, size: 12, bottom: 22 },
];

export function Cats() {
  return (
    <div className="cats" aria-hidden="true">
      {CATS.map((c, i) => (
        <span
          key={i}
          className="cat"
          style={
            {
              '--cat-dur': `${c.dur}s`,
              '--cat-from': `${c.from}%`,
              '--cat-to': `${c.to}%`,
              '--cat-dir': String(c.dir),
              '--cat-delay': `${c.delay}s`,
              fontSize: `${c.size}px`,
              bottom: `${c.bottom}px`,
            } as CSSProperties
          }
        >
          {c.emoji}
        </span>
      ))}
    </div>
  );
}
