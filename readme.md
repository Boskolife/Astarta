# Astarta Capital

A modern, scroll-driven presentation site for **Astarta Capital** — an investment firm focused on the convergence of culture, entertainment, and Web3. The site combines full-screen video, synchronized audio, and scroll-based animations into a single narrative experience.

---

## Overview

The project is a single-page presentation where:

- **Video** follows scroll position: forward and backward scrolling map to pre-rendered main and reverse videos.
- **Audio** (background track, drums, SFX) is synced to scroll and can be toggled on/off.
- **Content blocks** (text, images) animate in sequence with typing effects and transitions.
- **FullPage.js** drives full-height sections and smooth scrolling.

The result is a cinematic, one-scroll storytelling experience suitable for desktop and mobile.

---

## Features

| Feature | Description |
|--------|-------------|
| **Scroll-synced video** | Playback position is tied to scroll; each section has a defined time range in the main video. |
| **Reverse playback** | On scroll-up, a separate pre-rendered reverse video is used for smooth backward playback. |
| **Multi-track audio** | Background music, drums, and SFX with scroll-based control and mute toggle. |
| **Typing & block animations** | Sequential reveal of text (character-by-character) and content blocks. |
| **Responsive layout** | Desktop and mobile variants with different video/audio assets and breakpoints. |
| **Contact form** | Demo form with client-side validation (no server submission). |

---

## Tech Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Styles:** SCSS with [include-media](https://include-media.com/) for breakpoints
- **Build:** [Vite](https://vitejs.dev/) 4.x
- **Templating:** [Handlebars](https://handlebarsjs.com/) via `vite-plugin-handlebars` (partials in `src/templates/`)
- **Scrolling:** [FullPage.js](https://alvarotrigo.com/fullpage/) 4.x
- **Video/audio:** Native `<video>` and `<audio>` with custom scroll sync logic

Optional tooling: TypeScript (tsconfig for type checking), ESLint, Prettier.

---

## Project Structure

```
Astarta/
├── src/
│   ├── index.html              # Main entry page
│   ├── js/
│   │   └── main.js             # Scroll sync, FullPage, video/audio, animations
│   ├── styles/
│   │   ├── main.scss           # Global SCSS entry
│   │   ├── base/               # Variables, mixins, reset, typography, forms
│   │   ├── layout/             # Header, footer, common layout
│   │   ├── components/         # Sections, buttons, form, sound button
│   │   └── vendors/            # normalize, include-media
│   └── templates/              # Handlebars partials
│       ├── header.html
│       ├── footer.html
│       ├── sound-button.html
│       ├── form.html
│       └── arrow-down.html
├── public/
│   ├── video/                  # output.mp4, output_mob.mp4, backward*.mp4
│   ├── audio/                  # ASTARTA_Background.wav, ASTARTA_Drums.wav, SFX.wav
│   ├── images/
│   └── fonts/
├── vite.config.js              # Vite + Handlebars, base: '/Astarta'
├── getHTMLFileNames.js         # Discovers HTML entries for multi-page build
├── package.json
└── tsconfig.json
```

---

## Video & Audio Assets

### Video

- **Main (forward):** `output.mp4` (desktop), `output_mob.mp4` (mobile)
- **Reverse:** `backward.mp4` (desktop), `backward_mob.mp4` (mobile)

Sections and transitions are defined by time ranges in `VIDEO_SEGMENTS` and `SEGMENTS` in `main.js`. Reverse clips are intended to be pre-rendered (e.g. with FFmpeg).

### Audio

- **Background:** `ASTARTA_Background.wav`
- **Drums:** `ASTARTA_Drums.wav`
- **SFX:** `SFX.wav`

Playback and volume are controlled from `main.js` based on scroll and user toggle. Video/audio files are ignored by git (see `.gitignore`).

---

## Getting Started

### Prerequisites

- **Node.js** 16+ (or 18+ recommended)
- **npm** or **yarn**

### Install and run

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build (output in dist/)
npm run build

# Preview production build
npm run preview
```

**Note:** The app is built with `base: '/Astarta'` in Vite. For local dev, use the same base or adjust `vite.config.js` and run from a path that includes `/Astarta`, or set `base: '/'` for root deployment.

---

## Configuration

### Video timing

In `src/js/main.js`:

- **`SEGMENTS`** — fixed timestamps for each section (e.g. key frames).
- **`VIDEO_SEGMENTS`** — time ranges for each scroll segment (intro, sections, transitions).

Adjust these arrays to match your video length and section breaks.

### Animation and scroll

In the same file, `CONFIG` object:

- **`CONFIG.SCROLLING_SPEED`** — FullPage scroll duration and speed multiplier.
- **`CONFIG.VIDEO_SYNC`** — Epsilon and min duration for video seek/sync.
- **`CONFIG.ANIMATION`** — Typing delay, section transition delay, font loading fallback.
- **`CONFIG.AUDIO`** — e.g. drums start delay.

Tweak these to tune scroll feel, video sync accuracy, and animation timing.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Run `tsc` and `vite build` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint on `.ts` files |

---

## Notes

- **Form:** Contact form is demo-only (client-side validation, no backend).
- **Assets:** Video and large binary assets are in `.gitignore`; add them locally or via CI.
- **SEO:** The site uses `noindex,nofollow` meta; change as needed for production.
- **License:** Proprietary to Astarta Capital.

---

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make changes and test (manual and/or automated).
4. Open a pull request.
