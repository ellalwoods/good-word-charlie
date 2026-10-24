import { useEffect, useState, type ReactNode } from 'react';

interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chrome on Android (and desktop) offers its own install prompt; keep it for when the button is tapped.
let deferred: PromptEvent | null = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as PromptEvent; });

/** Already opened from the home screen, so there's nothing to add. */
export const installed = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

type Device = 'iphone' | 'android' | 'mac' | 'computer';

function device(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac';
  return 'computer';
}

const STEPS: Record<Device, { title: string; steps: ReactNode[] }> = {
  iphone: {
    title: 'On iPhone or iPad',
    steps: [
      <>Open this page in <b>Safari</b>.</>,
      <>Tap the <b>Share</b> button (the square with an arrow pointing up) at the bottom of the screen.</>,
      <>Scroll down and tap <b>Add to Home Screen</b>.</>,
      <>Tap <b>Add</b>. Good Word, Charlie now opens from its own icon, full screen.</>,
    ],
  },
  android: {
    title: 'On Android',
    steps: [
      <>Open this page in <b>Chrome</b>.</>,
      <>Tap the <b>⋮</b> menu at the top right.</>,
      <>Tap <b>Add to Home screen</b> (or <b>Install app</b>).</>,
      <>Tap <b>Install</b> or <b>Add</b>. It now opens from its own icon.</>,
    ],
  },
  mac: {
    title: 'On a Mac, in Safari',
    steps: [
      <>Open the <b>File</b> menu (or the <b>Share</b> button).</>,
      <>Choose <b>Add to Dock</b>.</>,
      <>Click <b>Add</b>. It now opens from the Dock like an app.</>,
    ],
  },
  computer: {
    title: 'On a computer, in Chrome or Edge',
    steps: [
      <>Look for the <b>install</b> icon at the right of the address bar (a screen with a down arrow).</>,
      <>Or open the <b>⋮</b> menu and choose <b>Cast, save and share → Install page as app</b> (Chrome) or <b>Apps → Install this site as an app</b> (Edge).</>,
      <>Click <b>Install</b>. It now opens in its own window.</>,
    ],
  },
};

/** Tries the browser's own install prompt; otherwise shows how to do it by hand. */
export function useInstall() {
  const [open, setOpen] = useState(false);
  const start = async () => {
    if (deferred) {
      const e = deferred;
      deferred = null;
      await e.prompt();
      const { outcome } = await e.userChoice;
      if (outcome === 'accepted') return;
    }
    setOpen(true);
  };
  return { open, start, close: () => setOpen(false) };
}

export function InstallHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);
  const d = STEPS[device()];
  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={onClose}>
      <article className="card welcome" onClick={e => e.stopPropagation()}>
        <div className="band"><span id="install-title">Add to home screen</span></div>
        <div className="ruled">
          <p className="sense">Put Good Word, Charlie on your home screen, and it opens like an app: its own icon, full screen, and it works offline.</p>
          <h4 className="tag welcome-how">{d.title}</h4>
          <ol className="welcome-list">
            {d.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p className="small-print">Using a sync link? Open it before you add the site, so the icon keeps your progress.</p>
          <div className="card-actions">
            <button type="button" className="btn" onClick={onClose}>Got it</button>
          </div>
        </div>
      </article>
    </div>
  );
}
