# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wordle 7** — a 7-letter Wordle clone built as a zero-dependency static PWA. No build tools, no framework, no backend. Open `index.html` directly in a browser or serve with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

There is no build step, no package.json, no test suite, and no linter configured.

## Architecture

All game logic lives in a single IIFE in `app.js`, which reads two globals injected by `words.js` (loaded first via `<script src="words.js">`):

- `WORDS` — the answer pool (7-letter words cycled by calendar day: `words[day % words.length]`)
- `ALL_VALID` — union of `WORDS` and `VALID_GUESSES`, used to validate guesses

**Data flow on guess submission** (`submitGuess` in `app.js`):
1. Length check → hard mode check → word list validation
2. `score(guess, answer)` — two-pass algorithm: pass 1 marks correct positions, pass 2 marks present-elsewhere (this correctly handles repeated letters)
3. `revealRow()` — staggered CSS flip animation (120ms per tile)
4. `updateKeyboard()` — status only ever upgrades: absent → present → correct, never downgraded

**State** is a handful of module-level `let` vars inside the IIFE (`currentRow`, `currentCol`, `currentGuess`, `gameOver`, `guessHistory`, `keyStatus`). `hardMode` is persisted to `localStorage`.

**Styling** uses CSS custom properties defined in `:root` in `style.css`. All color theming goes through those variables. Tile size uses `clamp()` for fluid scaling across screen sizes.

**Service worker** (`sw.js`) uses cache-first strategy with a versioned cache name (`wordle7-v1`). To bust the cache after asset changes, increment the `CACHE` constant in `sw.js`.

## Key Files

| File | Purpose |
|---|---|
| `index.html` | Page shell — board grid, keyboard, two modal overlays |
| `app.js` | All game logic and DOM manipulation |
| `words.js` | Defines `WORDS`, `VALID_GUESSES`, `ALL_VALID` globals |
| `style.css` | All styles for the current app |
| `sw.js` | Service worker (cache-first offline support) |
| `manifest.json` | PWA metadata |

## Legacy Files (Unused)

`styles.css`, `script.js`, `dictionary.json`, and `targetWords.json` are from the original WebDevSimplified template that this project was based on. They are **not loaded** by `index.html` and can be ignored or removed.

## Conventions

- `app.js` is wrapped in an IIFE `(() => { ... })()` — keep all new logic inside it.
- DOM element references are cached at the top of the IIFE; don't query the DOM repeatedly inside loops.
- The keyboard layout is hardcoded as `['QWERTYUIOP', 'ASDFGHJKL', 'ENTERZXCVBNM⌫']` in `renderKeyboard()`.
- `WORD_LEN = 7` and `MAX_ROWS = 6` are the only constants that control game dimensions.
- To change the word list, edit the `WORDS` array in `words.js`. Words must be exactly 7 characters; `ALL_VALID` is auto-derived.
