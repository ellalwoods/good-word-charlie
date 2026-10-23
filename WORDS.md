# The word rule

Choose precise, serious words for judging quality, effort, amount, stage or tone. Each one should replace a phrase that would otherwise take three or four words. They should work in normal speech and writing without sounding like they're trying to be clever.

Avoid:
- character-portrait words that sum up a type of person (louche, bumptious, supercilious, garrulous, saturnine, popinjay, milquetoast)
- words that sound comic or fusty (bumptious, gimcrack)
- long, showy words for simple ideas (perspicacious, pellucid)
- words an educated adult already uses daily (tacit, salient, glib)

**Approved (positive examples):** farcical, paucity, modicum, glut, risible, specious, spurious, jejune, otiose, perfunctory, desultory, tawdry, nascent, querulous, febrile, oleaginous (of a person), facile, tendentious, nugatory, meretricious, turgid, fatuous, anodyne, inchoate, moribund, peremptory, ersatz, pyrrhic

**Rejected (negative examples, also in `src/data/rejected.json`):** unctuous, louche, lugubrious, supercilious, bumptious, garrulous, officious, saturnine, popinjay, milquetoast, sclerotic, gimcrack, perspicacious, pellucid, tacit, glib, salient

## Each entry

- `word`, `pos` (noun / adjective / verb), `pron` (a respelling such as SPEE-shus), `definition`, and `example` (the sentence shown on the card)
- `testDefinition`: a second definition in completely different words, used only in questions, so the card's wording can't be matched by memory. The checks reject it if it shares half or more of its key words with `definition`.
- `synonym`: a plain everyday synonym (one or two words), not a word from the card definition, and different from every other word's synonym
- optional `confusable`: `{ word, note }`, where the note is one line on the difference
- `groups`: one or more meaning groups, such as `["careless", "irregular"]`. Words that share a group are never used as each other's wrong options, so near-synonyms can't sneak in as a 'wrong' answer that is really right. Reuse the existing group names where they fit.
- seven `questions`, each `{ type, prompt, answer, distractors: [3] }`:
  - `pick-meaning`: the prompt is the word, the answer is the `testDefinition`, and the distractors are other words' test definitions (never card definitions)
  - `pick-word`: the prompt is the `testDefinition`, and the answer is the word
  - `synonym`: the prompt is the word, the answer is the `synonym`, and the distractors are other words' synonyms
  - `usage`: the prompt is the word; the answer is a new sentence using it correctly, and the three distractors are sentences that misuse it (plainly wrong to anyone who knows the meaning, but grammatical)
  - `rewrite`: a plain sentence with one `{phrase}` that the word replaces
  - `confusable`: a sentence with one `___`, and the confusable word among the distractors
  - `gap`: a sentence with one `___`
- Every test sentence must be different from the card example, and from the word's other test sentences.
- Practice asks today's new words 5 of these questions and review words 2, rotating through the pool from day to day, and never asks `pick-meaning` and `pick-word` together, since they share the test definition.
- Distractors must be the same part of speech and must not also fit the sentence, including as an opposite ("copious evidence" fits a sentence about scant evidence). Choose wrong options that clash with the sentence, not just ones that mean something different.
- Avoid "a ___" or "an ___" unless every option takes the same article; the checks flag it.
- Use Australian spelling.
