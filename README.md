# Good Word, Charlie

A phone-first vocabulary site. Each day it deals three new words onto index cards. Practice is multiple choice, and reviews come back on a spaced-repetition schedule. It's named after Charlie, who says "farsicle".

Everything is static. All the words are written ahead of time and published with the site, so visitors never trigger any AI calls or costs. Each person's progress is saved in their own browser, and can be synced between their devices with a personal sync link (see below).

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

## Syncing between devices

Tap **Sync devices** at the bottom of the page, then **Make my sync link**, and open that link on your other phone or laptop. Both then share the same progress, and changes show on the other device within seconds. There are no accounts: the link is the key, so each person makes their own and keeps it to themselves. Without a connection the site carries on as normal and catches up later.

Syncing uses its own Supabase project, "good-word-charlie", kept separate from the household app. To set it up once:

1. In Supabase, open the project → **SQL Editor** → **New query**, paste all of `supabase/schema.sql`, and press **Run**.
2. In Supabase, open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
3. In this GitHub repo, open **Settings → Secrets and variables → Actions → Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with those two values.
4. Re-run the deploy (**Actions → Deploy to GitHub Pages → Run workflow**).

Until then the Sync page just says it isn't switched on yet.

## Friends

The **Friends** button in the top corner opens the Friends page. **I used a word** picks one of your words (with an optional story of how you used it); friends see a "Good word, Name!" card and can **Celebrate** it. Cards stay up for 24 hours, then move to the **Archive**. Shared: names, colours, words used, their stories and celebrations. It needs syncing switched on (above).

## Games

Once today's practice is done, **Go to games** opens three once-a-day games, each with a daily leaderboard of friends' results:

- **Good Wordle:** the same word for everyone (from the whole bank), its meaning as the clue, six guesses. Ranked by fewest guesses.
- **The Fuse:** bet ×1, ×2 or ×3 on each question against a burning fuse. Your own words until 200 points, then the whole bank.
- **Gravity:** meanings fall in three lanes; tap the word for the lowest card. Three lives. Speeds up quickly to level 5, then words go beyond your own and the pace drops back.


## Practising

- **Today:** one practice a day, never more than 21 questions. Today's three new words get 3 questions each, then the most overdue reviews get 2 each until the 21 are used; any other reviews wait for tomorrow. Only this practice moves words up or down a level.
- **Redo today's practice** (on Today, once the day's practice is done) goes over the same words with fresh questions.
- **Shuffle test** (on Lexicon): choose **Due** words, which count towards levels like today's practice (once a day per word; handy for reviews that didn't fit in the 21), or **Any word** for practice only. Then how many words and questions.

Redo and any-word shuffle tests are practice only. Neither kind of shuffle test changes the streak.

## Loading more words

The words live in `src/data/words.json`. When people run out, the site shows them an empty-card-box card telling them to ask Ella. To add more:

1. In a Claude Code session on this repo, ask for another batch (e.g. "add 100 more words to Good Word, Charlie"). Point it at this README and `WORDS.md`.
2. The new entries go on the **end** of `words.json`, so everyone keeps their place.
3. `npm test` must pass. It checks every entry (see below).
4. Commit and push to `main`. GitHub Pages redeploys, and people get the new words the next time they open the site, the same day.

### What the checks enforce (`src/lib/validate.ts`)

- Every field is present, and each word has seven questions, each with an answer and three distractors.
- The tests never reuse the card definition. Each word's test definition is worded differently, and its synonym isn't taken from the card.
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
  lib/storage.ts       progress and the sync key on this device
  lib/sync.ts          keeps a device in step with its sync link
  lib/merge.ts         combines two devices' progress without losing either
  lib/supabase.ts      the Supabase connection
  lib/daily.ts         three a day, "Already know it", "Not for me", streak
  lib/srs.ts           levels 0–6, intervals 0/1/3/7/14/30/60 days
  lib/session.ts       today's practice (3 questions per new word, 2 per review, 21 at most), redo, shuffle test
  lib/validate.ts      the checks above
  views/               Today, Practice, Lexicon, Sync, index card
public/                manifest, icons, offline service worker
supabase/schema.sql    run once in Supabase to switch on syncing
```
