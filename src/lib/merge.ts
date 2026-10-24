import { fresh } from './storage';
import type { Card, State } from './types';

/**
 * Combines progress from two devices without losing either side's work.
 * The result doesn't depend on which side is `a` and which is `b`, and merging
 * a state with itself changes nothing, so devices settle on the same progress.
 */
export function merge(a: State, b: State): State {
  const known = { ...a.known, ...b.known };
  const rejected = { ...a.rejected, ...b.rejected };
  const gone = (w: string) => !!known[w] || !!rejected[w];

  const cards: Record<string, Card> = {};
  for (const w of keys(a.cards, b.cards)) {
    if (gone(w)) continue;
    const x = a.cards[w], y = b.cards[w];
    cards[w] = x && y ? pickCard(x, y) : (x ?? y);
  }

  const days: Record<string, string[]> = {};
  for (const d of keys(a.days, b.days)) days[d] = unionList(a.days[d] ?? [], b.days[d] ?? []).filter(w => !gone(w));

  const out: State = {
    version: 1,
    cards,
    days,
    done: { ...a.done, ...b.done },
    known,
    rejected,
    updated: Math.max(a.updated || 0, b.updated || 0),
  };
  // Only the latest day's practice is kept, as on a single device.
  const latest = keys(a.practised ?? {}, b.practised ?? {}).sort().pop();
  if (latest) out.practised = { [latest]: unionList(a.practised?.[latest] ?? [], b.practised?.[latest] ?? []) };
  return out;
}

/** Fills in anything missing from progress saved by an older version, or nothing at all. */
export function normalise(s: unknown): State {
  return { ...fresh(), ...(s && typeof s === 'object' ? s : {}) } as State;
}

/** Same progress, ignoring when it was last touched. */
export function same(a: State, b: State): boolean {
  return canonical({ ...a, updated: 0 }) === canonical({ ...b, updated: 0 });
}

// The card that has been through more graded practice is the more up to date one.
function pickCard(a: Card, b: Card): Card {
  const rank = (c: Card) => [c.right + c.wrong, c.asked, c.due, c.level, c.right] as const;
  const ra = rank(a), rb = rank(b);
  let win = a;
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) { win = ra[i] > rb[i] ? a : b; break; }
  }
  return { ...win, asked: Math.max(a.asked, b.asked) };
}

function unionList(a: string[], b: string[]): string[] {
  if (b.every(w => a.includes(w))) return a;
  if (a.every(w => b.includes(w))) return b;
  const [x, y] = a.join() >= b.join() ? [a, b] : [b, a];
  return [...x, ...y.filter(w => !x.includes(w))];
}

function keys(a: object, b: object): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])];
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join()}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter(k => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join()}}`;
  }
  return JSON.stringify(v);
}
