# Good Word, Charlie

A phone-first vocabulary site. Each day it deals three new words onto index cards. Practice is multiple choice, and reviews come back on a spaced-repetition schedule. It's named after Charlie, who says "farsicle".

Everything is static. All the words are written ahead of time and published with the site, so visitors never trigger any AI calls or costs, and there's no server. Each person's progress is saved in their own browser.

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # logic tests, plus checks on every word in the bank
```

## Where it lives online

**https://ellalwoods.github.io/good-word-charlie/**

It's hosted on GitHub Pages. On every push to `main`, `.github/workflows/deploy.yml` tests and builds the site and publishes it to the `gh-pages` branch, which Pages serves. If any word fails its checks, the deploy stops, so a bad batch never goes live.

**On a phone:** open the address, then **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android). The site then opens full screen with its own icon and works offline.

## Loading more words

The words live in `src/data/words.json`. When people run out, the site shows them an empty-card-box card telling them to ask Ella. To add more:

1. In a Claude Code session on this repo, ask for another batch (e.g. "add 100 more words to Good Word, Charlie"). Point it at this README and `WORDS.md`.
2. The new entries go on the **end** of `words.json`, so everyone keeps their place.
3. `npm test` must pass. It checks every entry (see below).
4. Commit and push to `main`. GitHub Pages redeploys, and people get the new words the next time they open the site, the same day.

### What the checks enforce (`src/lib/validate.ts`)

- Every field is present, and there are about five questions per word, each with an answer and three distractors.
- The answer isn't also one of the distractors, and no option repeats.
- No test sentence matches the card's example sentence, or comes close to it.
- No sentence gives the answer away: the word itself doesn't appear, and there's no "a ___" / "an ___" that only fits one option.
- A confusables question includes the confusable word as an option.
- Distractors that are words in the bank have the same part of speech.
- No word appears twice, and no word from the rejected list appears at all.

The site also runs these checks at startup and quietly skips any entry that fails, so one bad entry can't break the site.

## Layout

```
src/
  data/words.json      the word bank (entries + question pools)
  data/rejected.json   words never to use
  lib/storage.ts       load/save progress: the one place to swap in Supabase later
  lib/daily.ts         three a day, "Already know it", "Not for me", streak
  lib/srs.ts           levels 0–6, intervals 0/1/3/7/14/30/60 days
  lib/session.ts       one question per due word, pool rotation, end-of-session retry
  lib/validate.ts      the checks above
  views/               Today, Practice, Lexicon, index card
public/                manifest, icons, offline service worker
```
