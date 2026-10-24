import type { CSSProperties } from 'react';

const COLOURS = ['var(--pink)', 'var(--yellow)', 'var(--blue)', 'var(--right)'];
const DOTS = Array.from({ length: 14 }, (_, i) => ({
  a: `${(360 / 14) * i + (i % 2 ? 9 : -6)}deg`,
  d: `${46 + (i * 37) % 40}px`,
  s: `${6 + (i * 5) % 7}px`,
  c: COLOURS[i % COLOURS.length],
  t: `${(i % 4) * 30}ms`,
}));

/** A one-off burst of riso confetti. Give it a new `key` to fire it again. */
export function Burst({ className = '' }: { className?: string }) {
  return (
    <span className={`burst ${className}`} aria-hidden="true">
      {DOTS.map((p, i) => (
        <span key={i} style={{ '--a': p.a, '--d': p.d, '--s': p.s, '--c': p.c, animationDelay: p.t } as CSSProperties} />
      ))}
    </span>
  );
}
