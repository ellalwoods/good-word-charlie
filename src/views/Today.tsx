import { canDismiss, dueWords, PER_DAY, streak } from '../lib/daily';
import type { State, Word } from '../lib/types';
import { WordCard } from './WordCard';

interface Props {
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
  onDismiss: (word: string, reason: 'known' | 'rejected') => void;
  onPractise: () => void;
}

export function Today({ state, bank, number, date, onDismiss, onPractise }: Props) {
  const byWord = new Map(bank.map(w => [w.word, w]));
  const news = (state.days[date] ?? []).map(w => byWord.get(w)).filter((w): w is Word => !!w);
  const due = dueWords(state, bank, date).length;
  const learned = Object.keys(state.cards).filter(w => byWord.has(w)).length;
  const days = streak(state, date);

  return (
    <>
      <section className="stats" aria-label="Progress">
        <div className="stat"><b>{learned}</b><span className="tag">Words learned</span></div>
        <div className="stat stat-yellow"><b>{days}</b><span className="tag">Day streak</span></div>
        <div className="stat stat-pink"><b>{due}</b><span className="tag">Due now</span></div>
      </section>

      <div className="practise">
        {due > 0
          ? <button type="button" className="btn" onClick={onPractise}>Practise {due} word{due === 1 ? '' : 's'}</button>
          : <p className="slip">All done for today. Three new words tomorrow.</p>}
      </div>

      <h2 className="tag section-label">Today’s words</h2>
      <div className="cards">
        {news.map(w => (
          <WordCard key={w.word} word={w} number={number(w.word)}>
            {canDismiss(state, w.word) && (
              <div className="card-actions">
                <button type="button" className="chip" onClick={() => onDismiss(w.word, 'known')}>Already know it</button>
                <button type="button" className="chip chip-quiet" onClick={() => onDismiss(w.word, 'rejected')}>Not for me</button>
              </div>
            )}
          </WordCard>
        ))}
        {news.length < PER_DAY && <OutOfWords />}
      </div>
    </>
  );
}

function OutOfWords() {
  return (
    <article className="card empty">
      <div className="band"><span>Card box</span><span>Empty</span></div>
      <div className="ruled">
        <h3 className="hw">That’s the lot.</h3>
        <p className="sense">You’ve met every word in the box. Tell Ella it’s time to load more.</p>
        <p className="example">Reviews will keep coming in the meantime.</p>
      </div>
    </article>
  );
}
