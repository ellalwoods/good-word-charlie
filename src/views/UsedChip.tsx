/** "I used it today": for a word said or written for real. Friends see it. */
export function UsedChip({ used, onToggle }: { used: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`chip chip-used${used ? '' : ' chip-quiet'}`} aria-pressed={used} onClick={onToggle}>
      {used ? 'Used it today ✓' : 'I used it today'}
    </button>
  );
}
