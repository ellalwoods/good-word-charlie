export type Pos = 'noun' | 'adjective' | 'verb';

// pick-meaning: the prompt is the headword, options are definitions.
// pick-word:    the prompt is a definition, options are words.
// rewrite:      a sentence with one {phrase} to replace with the word.
// confusable:   a sentence with one ___ gap; the word's confusable is among the distractors.
// gap:          a sentence with one ___ gap.
export type QuestionType = 'pick-meaning' | 'pick-word' | 'rewrite' | 'confusable' | 'gap';

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
  definition: string;
  example: string;
  confusable?: { word: string; note: string };
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
  updated: number;
}
