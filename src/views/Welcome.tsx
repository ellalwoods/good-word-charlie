import { useEffect } from 'react';

/** Shown once, the first time someone opens the site. */
export function Welcome({ onDone }: { onDone: () => void }) {
  // Keep the page behind from scrolling while it's up.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);
  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <article className="card welcome">
        <div className="band"><span id="welcome-title">WTF is this?</span><span>GWC v.5</span></div>
        <div className="ruled">
          <p className="sense">Charlie uses the word <i>farcical</i>. Ella wishes she used the word <i>farcical</i>. Ella made this app to improve her vocabulary.</p>
          <h4 className="tag welcome-how">How it works</h4>
          <ul className="welcome-list">
            <li><b>Three new words a day.</b> You can swap if you already know one.</li>
            <li><b>Practise them with spaced repetition.</b> Get a word right and it comes back less often; slip up and it’s back tomorrow.</li>
            <li><b>Use them for real.</b> And tell me, so I can celebrate.</li>
          </ul>
          <div className="card-actions">
            <button type="button" className="btn" onClick={onDone}>Begin</button>
          </div>
        </div>
      </article>
    </div>
  );
}
