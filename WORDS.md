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
- optional `confusable`: `{ word, note }`, where the note is one line on the difference
- five `questions`, each `{ type, prompt, answer, distractors: [3] }`:
  - `pick-meaning`: the prompt is the word, the answer is the card definition, and the distractors are other definitions
  - `pick-word`: the prompt is a definition (not containing the word), and the answer is the word
  - `rewrite`: a plain sentence with one `{phrase}` that the word replaces
  - `confusable`: a sentence with one `___`, and the confusable word among the distractors
  - `gap`: a sentence with one `___`
- Every test sentence must be different from the card example.
- Distractors must be the same part of speech and must not also fit the sentence. Avoid near-synonyms (paucity/modicum, nascent/inchoate, otiose/nugatory).
- Use Australian spelling.
