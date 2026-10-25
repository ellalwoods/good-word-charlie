import { useEffect, useRef, useState } from 'react';
import { answer, countsFor, finish, type Session } from '../lib/session';
import { play } from '../lib/sounds';
import type { Question, QuestionType, State, Word } from '../lib/types';
import { GAP } from '../lib/validate';
import { ConfusableNote, Headword, WordCard } from './WordCard';

const LABEL: Record<QuestionType, string> = {
  'pick-meaning': 'What does it mean?',
  'pick-word': 'Which word fits?',
  synonym: 'Closest in meaning?',
  usage: 'Which sentence uses it right?',
  rewrite: 'Rewrite: swap the highlight',
  confusable: 'Confusables: which belongs?',
  gap: 'Fill the gap',
};

const KIND = { daily: 'Practice', redo: 'Redo', shuffle: 'Shuffle test' } as const;

interface Props {
  start: Session;
  state: State;
  bank: Word[];
  number: (word: string) => number;
  date: string;
  onState: (s: State) => void;
  onDone: () => void;
}

export function Practice({ start, state, bank, number, date, onState, onDone }: Props) {
  const [session, setSession] = useState(start);
  const [picked, setPicked] = useState<string | null>(null);
  const [finished, setFinished] = useState(start.items.length === 0);
  const next = useRef<HTMLButtonElement>(null);
  const byWord = new Map(bank.map(w => [w.word, w]));

  useEffect(() => { if (picked) next.current?.focus({ preventScroll: true }); }, [picked]);

  const daily = session.kind === 'daily';
  // Today's practice, or a shuffle test of due words: results change levels.
  const graded = daily || !!session.counts?.length;

  if (finished) {
    const missed = session.missed.map(w => byWord.get(w)).filter((w): w is Word => !!w);
    return (
      <section className="practice">
        <span className="tag">{KIND[session.kind]} complete</span>
        {graded
          ? <p className="score"><b>{session.firstRight}</b> of {session.total} {daily ? '' : 'due '}word{session.total === 1 ? '' : 's'} {daily ? 'with every question right first time' : 'moved up a level'}.</p>
          : <p className="score"><b>{session.questionsRight}</b> of {session.questionsAsked} question{session.questionsAsked === 1 ? '' : 's'} right first time.</p>}
        {missed.length > 0 && <h2 className="tag section-label">{graded ? 'Back tomorrow' : 'Worth another look'}</h2>}
        <div className="cards">
          {missed.map(w => <WordCard key={w.word} word={w} number={number(w.word)} note />)}
        </div>
        <button type="button" className="btn btn-quiet" onClick={onDone}>
          {session.kind === 'shuffle' ? 'Back to the lexicon' : 'Back to today'}
        </button>
      </section>
    );
  }

  const item = session.items[session.i];
  const word = byWord.get(item.word)!;
  const q = item.question;
  const isWords = q.type !== 'pick-meaning' && q.type !== 'usage';
  const last = session.i + 1 >= session.items.length;
  const correct = picked === q.answer;

  const choose = (option: string) => {
    if (picked) return;
    const r = answer(state, session, bank, option, date);
    // A word moving up a level gets its own sound (only today's practice changes levels).
    play(!r.correct ? 'wrong' : countsFor(session, item.word) && r.session.firstRight > session.firstRight ? 'levelup' : 'right');
    setPicked(option);
    setSession(r.session);
    onState(r.state);
  };

  const advance = () => {
    if (last) {
      if (daily) onState(finish(state, date));
      play('finish');
      setFinished(true);
    } else {
      setSession({ ...session, i: session.i + 1 });
    }
    setPicked(null);
    window.scrollTo(0, 0);
  };

  return (
    <section className="practice">
      <div className="meter" aria-hidden="true"><span style={{ width: `${(session.i / session.items.length) * 100}%` }} /></div>
      <div className="q-head">
        <span className={`qtag qtag-${q.type}`}>{LABEL[q.type]}</span>
        <span className="tag">{daily ? '' : `${KIND[session.kind]} · `}{item.retry ? 'Once more · ' : ''}{session.i + 1} of {session.items.length}</span>
      </div>

      <div className="prompt-card">
        <Prompt q={q} word={word} />
      </div>

      <div className="options" role="group" aria-label="Answers">
        {item.options.map(o => {
          const state = !picked ? '' : o === q.answer ? ' right' : o === picked ? ' wrong' : ' faded';
          return (
            <button key={o} type="button" data-sound="own" className={`opt${isWords ? ' opt-word' : ''}${state}`} disabled={!!picked} onClick={() => choose(o)}>
              {o}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="feedback" aria-live="polite">
          <p className={`stamp ${correct ? 'stamp-right' : 'stamp-wrong'}`}>
            {correct ? 'Good word' : item.retry ? 'Not quite' : 'Not quite · it’ll come round again'}
          </p>
          <WordCard word={word} number={number(word.word)}>
            {q.type === 'confusable' && <ConfusableNote word={word} />}
          </WordCard>
          <button ref={next} type="button" className="btn" onClick={advance}>{last ? 'Finish' : 'Next'}</button>
        </div>
      )}
    </section>
  );
}

function Prompt({ q, word }: { q: Question; word: Word }) {
  if (q.type === 'pick-meaning' || q.type === 'synonym' || q.type === 'usage') return <Headword word={word} />;
  if (q.type === 'pick-word') return <p className="prompt">{q.prompt}</p>;
  if (q.type === 'rewrite') {
    const [, before, phrase, after] = q.prompt.match(/^(.*)\{([^}]*)\}(.*)$/s)!;
    return <p className="prompt">{before}<mark>{phrase}</mark>{after}</p>;
  }
  const [before, after] = q.prompt.split(GAP);
  return <p className="prompt">{before}<span className="blank" aria-label="blank" />{after}</p>;
}
