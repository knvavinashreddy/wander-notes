# Wander

Talk while you walk. Wander transcribes your voice note live, pulls out your best ideas, scores them, and sorts them into an idea board.

No accounts, no API keys, no backend. Everything is stored in your browser.

## Run it

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push this repo to GitHub and import it in Vercel. It is detected as Vite (`vercel.json` is included). No environment variables needed.

## How it works

| Piece | Where |
| --- | --- |
| Mic, live transcription, waveform, screen wake lock | `src/lib/useRecorder.js` |
| Idea extraction (split → score → categorise → title → dedupe) | `src/lib/ideas.js` |
| Notes + ideas (localStorage), audio clips (IndexedDB), streaks, Markdown export | `src/lib/store.js` |
| UI | `src/components/*`, `src/App.jsx`, `src/styles.css` |

- **Transcription** uses the browser's built-in Web Speech API. It works in Chrome, Edge and Safari (desktop, Android and iOS). In Chrome the browser sends audio to Google's speech service, so it needs a connection. Firefox has no live transcription: audio is still recorded, and you can type the gist.
- **Idea extraction** runs fully on-device with heuristics tuned for English: cue phrases ("what if", "I should", "need to"…), specificity, and length. Saying an old idea again bumps its spark score and its ×N counter instead of duplicating it.
- **Categories:** Build, Business, Content, To-do, Life, Learn, Thought.

## Reusing it in another app

`useRecorder` and `extractIdeas` have no UI dependencies, so you can copy `src/lib/` into another React app. To swap in an AI model later, replace `extractIdeas()` and keep the same idea shape.
