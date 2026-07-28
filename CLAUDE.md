# Fiendish Puzzle Gen — Claude Instructions

A puzzle **setter** (the solver is a separate project, `~/Documents/Code Talker/`).
Static site, no build step, no backend — open the HTML files directly or serve
the folder. Deployed to Cloudflare Pages.

- **Repo root**: `/home/laughingman/Documents/FPG/` ← note the app lives one
  level down in `fiendish-puzzle-gen/`, so git paths are
  `fiendish-puzzle-gen/js/...`
- **Remote**: github.com/lmck-dev/fiendish-puzzle-gen

## Layout

| Path | What |
|---|---|
| `fiendish-puzzle-gen/index.html` | Landing page / tool cards |
| `translator.html` + `js/translator.js` | Language translator (4-rung lookup) |
| `chainer.html` + `js/chainer.js` | Phase 4 Puzzle Chainer |
| `js/coiner.js` | Markov phonotactic word generator + scorer |
| `js/coinlib.js` | Coined-word library, provenance, localStorage |
| `crossword/anagram/maze/wordsearch/cyphers.html` | Phase 3 generators |

## Dictionaries — single source of truth

Canonical JSON lives in **`~/Documents/languages/`**, shared with Code Talker.
Never hand-edit the copies in this repo. After changing a dictionary:

```bash
node ~/Documents/languages/generate-fpg-dictionaries.js
```

Dictionary JSON shape is `{ meta: {...}, entries: {...} }` — the vocabulary is
under `.entries`, **not** at the top level. Reading `Object.values(dict)`
directly yields nothing usable.

## Translation pipeline

`lookupWord()` tries four rungs in order: exact → lemma → synonym → **coinage
(L4)**. Coinage is opt-in behind the "Coined words" toggle and is the only rung
that invents rather than looks up.

### Coinage gotchas

- **`FPG_Coiner.coin(model, opts)` only varies output for NUMERIC seeds.**
  A string seed collapses every concept onto the same RNG stream and mints the
  same word every time. `FPG_CoinLib.mint()` is safe because it always passes
  `hashSeed(concept + "|" + langId)`. Calling `coin()` directly with
  `{seed: "toast"}` will silently misbehave.
- `coin()` takes a **trained model**, not a language id. Build it with
  `train(words, order)` or `trainFromDict(...)` first.
- Minting is deterministic and bijective: `mint()` passes an `exclude` set of
  already-minted words so two concepts never collapse onto one coinage.
  Natural collisions do happen (~1 in 8 on the Klingon lexicon) and are
  resolved by that reroll — don't remove it.
- Coined words are non-canon. They are flagged ✳, kept separate from the canon
  lexicon, and stored only in the browser's localStorage.

### Tokenizer

The word test is Unicode-aware (`/^[\p{L}\p{M}\p{N}_’ʼ']+$/u`). It must stay
that way: plain `\w` is ASCII-only and silently drops Klingon apostrophes (`’`)
and Sindarin accents in reverse mode.

## Testing

There is no test runner. Verification has been ad-hoc: load a model in node and
check determinism/scoring, then confirm in a real browser. A sanity check:

```bash
node -e 'global.window={};const fs=require("fs");
new Function(fs.readFileSync("fiendish-puzzle-gen/js/coiner.js","utf8"))();
const C=window.FPG_Coiner, d=require(process.env.HOME+"/Documents/languages/klingon_en.json");
const w=Object.values(d.entries).flatMap(v=>typeof v==="string"?[v]:[]);
const m=C.train(w,2); console.log(C.score(m,"tlhIngan"), C.score(m,"zzzxqw"));'
# native word should score near -0.5, alien string near -14
```

## Not committed on purpose

`Thieves-Cant/` is ~73 MB of JPEG reference scans, already transcribed into
`~/Documents/languages/thieves_cant.json`. It is gitignored. Do not add it.
