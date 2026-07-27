# EB Auto Score

[English](./README.md) | [中文（香港）](./README_zh_HK.md) | [粵語（香港）](./README_yue_HK.md)

A userscript that automates completing/modifying scores on English Builder.
It adds a floating control panel to the lesson list page where you can set a
target score (fixed or random range), an optional delay between lessons, and
which lessons to target (incomplete lessons, or also redo lessons below a
score threshold), then run it against the current lesson or batch through
every matching lesson automatically.

## Install

1. Install a userscript manager in your browser:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)
2. Click [here](https://github.com/devcme/auto_eb_score/raw/refs/heads/main/eb_auto_score.user.js) and install the script.
3. Log in to English Builder — the control panel appears automatically in the top-right corner.

### Updating

Userscript managers check for updates automatically.
If a new version doesn't appear, open the script's page in your manager and
click **Check for updates**.

## Manual Build

Requirements: [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm build      # build once
pnpm dev        # build and watch for changes
```

The output is written to `eb_auto_score.user.js`.

## Project Structure

```
├── build.js                 esbuild build script
├── src/
│   ├── index.js             entry point, main automaton logic
│   ├── ui.js                floating panel UI & logging
│   ├── state.js             state persistence (localStorage)
│   ├── scoring.js           score committing API
│   ├── lesson.js            lesson navigation & task picking
│   ├── utils.js             helpers (waitMs, formatSeconds)
│   ├── style.css            panel styles
│   └── i18n/
│       ├── index.js         i18n helper
│       ├── en_US.js
│       ├── zh_HK.js
│       └── yue_HK.js
├── dist/                    build output directory
└── eb_auto_score.user.js    final userscript (built)
```

## License

[MIT](./LICENSE)
