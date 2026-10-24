/** An on/off switch for sound effects: the knob slides and the track says ON or OFF. */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle" onClick={onToggle}>
      <span className="toggle-label">Sound</span>
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-text">{on ? 'On' : 'Off'}</span>
        <span className="toggle-knob" />
      </span>
    </button>
  );
}
