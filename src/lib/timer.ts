import type { Beeper } from './audio';
import { createSilentBeeper } from './audio';
import { DEFAULT_CONFIG, type TimerConfig } from './config';

export const STATES = ['STOPPED', 'RESETTING', 'READYSET', 'GO', 'DONE'] as const;
export type TimerState = (typeof STATES)[number];

export interface TimerSnapshot {
  state: TimerState;
  /** Number of GO beeps since the session started. */
  round: number;
}

export type Listener = (snapshot: TimerSnapshot) => void;

export interface TimerDeps {
  beeper?: Beeper;
  /** Injectable so tests can drive the clock. */
  setTimeout?: (fn: () => void, ms: number) => number;
  clearTimeout?: (id: number) => void;
  /** Injectable so tests can pin the jitter. */
  random?: () => number;
}

const STANDBY_FREQ = 440;
const STANDBY_GAIN = 0.3;
const BEEP_FREQ = 880;
const BEEP_GAIN = 1;
const BEEP_MS = 100;
/** How long "Stop" stays on screen after the par beep, before resetting. */
const DONE_MS = 2000;
/** The shortest standby the machine will ever run, however low you set delay. */
const MIN_STANDBY_MS = 1000;

/**
 * The training state machine, lifted out of React so it can be unit-tested
 * without a DOM and without real time passing.
 *
 * Transitions (preserved from the original app):
 *
 *   STOPPED   -> RESETTING  wait `interval`, then READYSET
 *   RESETTING -> READYSET   standby tone; wait `delay` +/- `randomness`, then GO
 *   READYSET  -> GO         go beep; wait `target` (the par time), then DONE
 *   GO        -> DONE       stop beep; wait 2s, then RESETTING
 *   DONE      -> RESETTING  wait `interval` - 2s, then READYSET
 *   *         -> STOPPED    cancel everything, go silent
 */
export class ReactionTimer {
  private config: TimerConfig = { ...DEFAULT_CONFIG };
  private state: TimerState = 'STOPPED';
  private round = 0;
  /** Cached so `useSyncExternalStore` sees a stable reference. */
  private snapshot: TimerSnapshot = { state: 'STOPPED', round: 0 };
  private pending: number[] = [];
  /** Bumped on every transition so stale timeouts identify themselves. */
  private generation = 0;
  private listeners = new Set<Listener>();

  private readonly beeper: Beeper;
  private readonly schedule: (fn: () => void, ms: number) => number;
  private readonly unschedule: (id: number) => void;
  private readonly random: () => number;

  constructor(deps: TimerDeps = {}) {
    this.beeper = deps.beeper ?? createSilentBeeper();
    this.schedule =
      deps.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number);
    this.unschedule = deps.clearTimeout ?? ((id) => globalThis.clearTimeout(id));
    this.random = deps.random ?? Math.random;
  }

  getSnapshot = (): TimerSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  configure(config: Partial<TimerConfig>): void {
    Object.assign(this.config, config);
  }

  /** Begin a session. Only meaningful from STOPPED. */
  start(): void {
    if (this.state !== 'STOPPED') return;
    this.round = 0;
    this.transition('RESETTING');
  }

  stop(): void {
    this.transition('STOPPED');
  }

  /** Release timers and listeners. The timer is unusable afterwards. */
  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  /** The delay the next standby will run for, in ms. Exposed for testing. */
  private standbyMs(): number {
    const { delay, randomness } = this.config;
    const jitter = (2 * this.random() - 1) * randomness;
    return Math.max(MIN_STANDBY_MS, (delay + jitter) * 1000);
  }

  private after(ms: number, next: TimerState): void {
    const generation = this.generation;
    const id = this.schedule(
      () => {
        // A timeout that outlived its transition is inert.
        if (generation !== this.generation) return;
        this.transition(next);
      },
      Math.max(0, ms),
    );
    this.pending.push(id);
  }

  private cancelAll(): void {
    for (const id of this.pending) this.unschedule(id);
    this.pending = [];
  }

  private transition(next: TimerState): void {
    const from = this.state;

    // Every transition supersedes whatever was scheduled before it, so a
    // stale timeout can never resurrect an abandoned branch.
    this.generation += 1;
    this.cancelAll();
    this.state = next;

    switch (next) {
      case 'STOPPED':
        this.beeper.silence();
        break;

      case 'RESETTING': {
        this.beeper.silence();
        // Coming out of DONE, two of the interval's seconds were already
        // spent showing "Stop", so only the remainder is waited out.
        const remaining =
          from === 'DONE' ? this.config.interval * 1000 - DONE_MS : this.config.interval * 1000;
        this.after(remaining, 'READYSET');
        break;
      }

      case 'READYSET':
        this.beeper.tone(STANDBY_FREQ, STANDBY_GAIN);
        this.after(this.standbyMs(), 'GO');
        break;

      case 'GO':
        this.round += 1;
        this.beeper.blip(BEEP_FREQ, BEEP_GAIN, BEEP_MS);
        this.after(this.config.target * 1000, 'DONE');
        break;

      case 'DONE':
        this.beeper.blip(BEEP_FREQ, BEEP_GAIN, BEEP_MS);
        this.after(DONE_MS, 'RESETTING');
        break;
    }

    this.emit();
  }

  private emit(): void {
    this.snapshot = { state: this.state, round: this.round };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
