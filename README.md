# Reaction Trainer

A par-time reaction trainer. Set a starting delay, a goal time and a round
interval, hit start, and train against the beep: a quiet standby tone, a loud
beep to go, and a second beep at your goal time.

This is a rewrite of the original 2017 app that used to live at
`shot-timer.s3.us-east-1.amazonaws.com`. The behaviour, the layout and the
colours are the original's; everything underneath it is new.

## What was broken

The deployed app rendered a blank dark screen and made no sound. Two
independent causes, both from the web moving on underneath it:

1. **Blank screen.** It routed with `react-router`'s browser history and
   rendered the menu at `<Route exact path="/">`. The app was served at
   `/index.html`, so no route ever matched and the tree rendered empty. The
   rewrite has two screens and no router, so there is no path to mismatch.

2. **No sound.** The `AudioContext` was constructed at module scope. Since
   Chrome 71 and Safari 11, a context created outside a user gesture starts
   `suspended` and never resumes on its own, so every beep was silent. It is
   now created lazily and resumed inside the click handler on Start.

Two more latent bugs went with them: `audio.stop()` tested
`this.gain.destination`, which is always `undefined`, so it never actually
disconnected; and `audio.start()` re-connected the gain node to the
destination on every call because it tested `this.gain.connect.destination`
(a typo for `this.gain.destination`), stacking up connections. A single
oscillator now runs for the life of the page and only the gain envelope
changes.

## What changed

| Then                                                        | Now                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| Browserify + Babel                                          | Vite 7                                               |
| React 15, `createClass`-era class components                | React 19 function components                         |
| Redux + redux-immutable + Immutable.js + react-router-redux | `useState` + `useSyncExternalStore`                  |
| Hand-rolled mousemove/touchmove sliders                     | `<input type="range">` under a styled slab           |
| Runtime `color` package for the palette                     | Literal hex custom properties                        |
| No tests                                                    | 30 tests (Vitest + Testing Library)                  |
| No CI                                                       | GitHub Actions: format, lint, typecheck, test, build |
| No manifest                                                 | Installable PWA with offline support                 |
| —                                                           | Screen wake lock during a session                    |

Timings, cue text, sound design and the palette are unchanged. The bundle went
from 329 KB to 204 KB (65 KB gzipped).

### Deliberate behaviour changes

- **Goal time has a floor of 0.2s.** The original allowed 0, which fired the
  stop beep in the same tick as the go beep.
- **A round interval under 2s no longer schedules a negative timeout.** The
  reset wait is `interval - 2s` clamped at zero.
- **Sliders apply live.** The original only re-read config when the training
  screen mounted.
- **Phase colours.** The original palette defined `orange`, `green` and `red`
  next to the two greys but never used them. They now colour the standby, go
  and stop phases, which reads from across a room.
- **A session stops when the tab is hidden**, so a pocketed phone stops
  beeping.
- **The iOS "add to home screen" tour slide** used a screenshot of iOS 10's
  share sheet. It is now text plus an inline glyph, and only shows on iOS when
  not already installed.

Settings saved by the original app under bare `localStorage` keys
(`delay`, `randomness`, `target`, `interval`) are still read, so an existing
user keeps their configuration.

## The state machine

Lifted out of React into `src/lib/timer.ts` so it can be tested without a DOM
and without real time passing.

```
STOPPED   --start-->  RESETTING   wait `interval`,               then READYSET
RESETTING --------->  READYSET    standby tone (440Hz, quiet)
                                  wait `delay` ± `randomness`,   then GO
READYSET  --------->  GO          go beep (880Hz, 100ms)
                                  wait `target`,                 then DONE
GO        --------->  DONE        stop beep (880Hz, 100ms)
                                  wait 2s,                       then RESETTING
DONE      --------->  RESETTING   wait `interval` - 2s,          then READYSET
*         --stop-->   STOPPED     cancel everything, go silent
```

The standby delay is floored at 1s, so a low `delay` with high `randomness`
can never fire instantly.

## Development

```sh
npm install
npm run dev          # dev server
npm test             # unit + component tests
npm run test:watch
npm run lint
npm run typecheck
npm run format
npm run build        # -> dist/
npm run preview
```

## Deploying

`vite.config.ts` sets `base: './'`, so `dist/` works from any path — a bucket
key prefix, a Pages project subpath, or `file://`.

**GitHub Pages** is wired up: `.github/workflows/deploy.yml` publishes `dist/`
on every push to `main`. Enable it once under Settings → Pages → Source →
GitHub Actions.

**S3**, to replace the original deployment:

```sh
npm run build
aws s3 sync dist/ s3://shot-timer/ --delete
```

Serve it over HTTPS. The service worker and the wake lock both require a
secure context, so the app installs and stays awake on `https://` but not on
plain `http://`.

## Layout

```
src/
  App.tsx              screen switching, config state, lifecycle
  theme.css            palette and resets
  lib/
    timer.ts           the state machine — no React, no globals
    audio.ts           gesture-unlocked Web Audio beeper
    config.ts          bounds, defaults, localStorage (incl. v1 migration)
    useWakeLock.ts     keeps the screen on during a session
  components/          Menu, Train, Slider, Button, Tour
```
