export type Pos = 'noun' | 'adjective' | 'verb';

// pick-meaning: the prompt is the headword, options are test definitions (never the card's wording).
// pick-word:    the prompt is the word's test definition, options are words.
// synonym:      the prompt is the headword, options are plain synonyms.
// usage:        the prompt is the headword, options are four sentences; only one uses it correctly.
// rewrite:      a sentence with one {phrase} to replace with the word.
// confusable:   a sentence with one ___ gap; the word's confusable is among the distractors.
// gap:          a sentence with one ___ gap.
export type QuestionType = 'pick-meaning' | 'pick-word' | 'synonym' | 'usage' | 'rewrite' | 'confusable' | 'gap';

export interface Question {
  type: QuestionType;
  prompt: string;
  answer: string;
  distractors: string[];
}

export interface Word {
  word: string;
  pos: Pos;
  pron: string;
  definition: string;       // shown on the card
  testDefinition: string;   // a differently worded definition, used only in questions
  synonym: string;          // a plain everyday synonym, used only in questions
  example: string;
  confusable?: { word: string; note: string };
  groups?: string[];   // meaning groups; words sharing one are never used as each other's wrong options
  questions: Question[];
}

export interface Card {
  level: number;   // 0–6
  due: string;     // YYYY-MM-DD
  right: number;
  wrong: number;
  asked: number;   // how many questions have been asked, for rotating through the pool
}

export interface State {
  version: 1;
  cards: Record<string, Card>;       // every word met and still in practice
  days: Record<string, string[]>;    // date -> that day's new words
  done: Record<string, true>;        // dates a session was finished, for the streak
  known: Record<string, true>;       // "Already know it"
  rejected: Record<string, true>;    // "Not for me"
  practised?: Record<string, string[]>;  // date -> words in that day's practice, for "Redo today"
  used?: Record<string, Record<string, number>>;  // date -> word -> when "I used it" was tapped (negative once untapped)
  name?: { value: string; color?: string; at: number };  // the name and colour friends see; empty once you leave
  cheers?: Record<string, Record<string, number>>;
  notes?: Record<string, Record<string, { text: string; at: number }>>;  // date -> word -> the story of how it was used
  welcomed?: true;
  gamesReset?: Record<string, number>;  // date -> when that day's games were reset (testing); older results don't count
  games?: Record<string, Partial<Record<'wordle' | 'fuse' | 'gravity', { at: number; score: number; level?: number; answered?: number; grid?: string[]; sparks?: number; best?: true }>>>;  // date -> game -> that day's one go
  sound?: { on: boolean; at: number };  // sound effects on or off (on unless turned off)
  started?: number;  // when this record was first used (ms), for Ella's stats
  moved?: true;      // a guest record whose device has since become someone else
  time?: Record<string, Record<string, number>>;    // date -> device (or device|page) -> seconds actively on the site
  visits?: Record<string, Record<string, number>>;  // date -> device|page -> times that page was opened  // the welcome card has been read  // date -> "name:word" celebrated -> when (negative once undone)
  updated: number;
}
