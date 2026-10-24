import { useEffect } from 'react';
import { canDismiss, dueWords, PER_DAY, streak } from '../lib/daily';
import { practisedToday, sessionSize } from '../lib/session';
import type { State, Word } from '../lib/types';
import { UsedChip } from './UsedChip';
import { play } from '../lib/sounds';
import { TextElla } from './TextElla';
import { WordCard } from './WordCard';

interface Props {
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
  onDismiss: (word: string, reason: 'known' | 'rejected') => void;
  onPractise: () => void;
  onRedo: () => void;
  used: string[];
  onUsed: (word: string) => void;
}

export function Today({ state, bank, number, date, onDismiss, onPractise, onRedo, used, onUsed }: Props) {
  const byWord = new Map(bank.map(w => [w.word, w]));
  const news = (state.days[date] ?? []).map(w => byWord.get(w)).filter((w): w is Word => !!w);
  const due = dueWords(state, bank, date).length;
  const learned = Object.keys(state.cards).filter(w => byWord.has(w)).length;
  const days = streak(state, date);
  const size = sessionSize(state, bank, date);
  const canRedo = !!state.done[date] && practisedToday(state, bank, date).length > 0;

  return (
    <>
      <section className="stats" aria-label="Progress">
        <div className="stat"><b>{learned}</b><span className="tag">Words learned</span></div>
        <div className="stat stat-yellow"><b>{days}</b><span className="tag">Day streak</span></div>
        <div className="stat stat-pink"><b>{due}</b><span className="tag">Due now</span></div>
      </section>

      <div className="practise">
        {due > 0
          ? (
            <button type="button" className="btn" onClick={onPractise}>
              Practise {due} word{due === 1 ? '' : 's'}
              <span className="btn-sub">{size.questions} questions</span>
            </button>
          )
          : <p className="slip">All done for today. Three new words tomorrow.</p>}
        {canRedo && (
          <button type="button" className="btn btn-quiet" onClick={onRedo}>
            Redo today’s practice
          </button>
        )}
      </div>

      <h2 className="tag section-label">Today’s words</h2>
      <div className="cards">
        {news.map(w => (
          <WordCard key={w.word} word={w} number={number(w.word)}>
            <div className="card-actions">
              {canDismiss(state, w.word) ? <>
                <button type="button" className="chip" onClick={() => onDismiss(w.word, 'known')}>Already know it</button>
                <button type="button" className="chip chip-quiet" onClick={() => onDismiss(w.word, 'rejected')}>Not for me</button>
              </> : <UsedChip used={used.includes(w.word)} onToggle={() => onUsed(w.word)} />}
            </div>
          </WordCard>
        ))}
        {news.length < PER_DAY && <OutOfWords name={state.name?.value ?? ''} learned={learned} />}
      </div>
    </>
  );
}

function OutOfWords({ name, learned }: { name: string; learned: number }) {
  // A sad "wah-wah", once a day, when the box is empty.
  useEffect(() => {
    const key = 'good-word-charlie-empty-sound', day = new Date().toDateString();
    try { if (localStorage.getItem(key) === day) return; localStorage.setItem(key, day); } catch { /* storage blocked */ }
    play('wrong');
  }, []);
  const text = `Hi Ella${name ? `, it’s ${name}` : ''}! I’ve used up every word on Good Word, Charlie (${learned} learned). `
    + 'Utterly farcical. Time to load more, please!';
  return (
    <article className="card empty">
      <div className="band"><span>Card box</span><span>Empty</span></div>
      <div className="ruled">
        <h3 className="hw">Well, this is farcical.</h3>
        <p className="sense">You’ve used up every word in the box. Tell Ella it’s time to load more.</p>
        <p className="example">A word app with no new words? Utterly farcical.</p>
        <p className="sense">Your reviews will keep coming in the meantime.</p>
        <div className="card-actions">
          <TextElla label="Text Ella for more words" body={text} />
        </div>
      </div>
    </article>
  );
}

