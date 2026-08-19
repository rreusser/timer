import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReactionTimer, type TimerState } from '../timer';
import type { Beeper } from '../audio';

interface BeepCall {
  kind: 'tone' | 'blip' | 'silence';
  frequency?: number;
  gain?: number;
  durationMs?: number;
}

function recordingBeeper() {
  const calls: BeepCall[] = [];
  const beeper: Beeper = {
    unlock: async () => {},
    tone: (frequency, gain) => void calls.push({ kind: 'tone', frequency, gain }),
    blip: (frequency, gain, durationMs) =>
      void calls.push({ kind: 'blip', frequency, gain, durationMs }),
    silence: () => void calls.push({ kind: 'silence' }),
    dispose: () => {},
  };
  return { beeper, calls };
}

/** delay 4s, no jitter with random() === 0.5, par 1.4s, 5s rounds. */
const CONFIG = { delay: 4, randomness: 3, target: 1.4, interval: 5 };

function build(random = () => 0.5) {
  const { beeper, calls } = recordingBeeper();
  const timer = new ReactionTimer({ beeper, random });
  timer.configure(CONFIG);
  const states: TimerState[] = [];
  timer.subscribe((snapshot) => states.push(snapshot.state));
  return { timer, calls, states };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('ReactionTimer', () => {
  it('starts stopped', () => {
    const { timer } = build();
    expect(timer.getSnapshot()).toEqual({ state: 'STOPPED', round: 0 });
  });

  it('runs a full round in the documented order and timing', () => {
    const { timer, states } = build();

    timer.start();
    expect(timer.getSnapshot().state).toBe('RESETTING');

    // The first standby waits a whole interval.
    vi.advanceTimersByTime(4999);
    expect(timer.getSnapshot().state).toBe('RESETTING');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot().state).toBe('READYSET');

    // random() === 0.5 means zero jitter, so the delay is exactly 4s.
    vi.advanceTimersByTime(3999);
    expect(timer.getSnapshot().state).toBe('READYSET');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot()).toEqual({ state: 'GO', round: 1 });

    // GO lasts exactly the goal time.
    vi.advanceTimersByTime(1400);
    expect(timer.getSnapshot().state).toBe('DONE');

    // DONE holds for 2s...
    vi.advanceTimersByTime(2000);
    expect(timer.getSnapshot().state).toBe('RESETTING');

    // ...and the remainder of the interval is waited out before the next round.
    vi.advanceTimersByTime(2999);
    expect(timer.getSnapshot().state).toBe('RESETTING');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot().state).toBe('READYSET');

    expect(states).toEqual(['RESETTING', 'READYSET', 'GO', 'DONE', 'RESETTING', 'READYSET']);
  });

  it('holds each round to the configured interval', () => {
    const { timer } = build();
    timer.start();
    vi.advanceTimersByTime(5000 + 4000); // first GO
    expect(timer.getSnapshot().round).toBe(1);

    // GO -> DONE (1.4s) -> RESETTING (2s) -> READYSET (3s) -> GO (4s)
    vi.advanceTimersByTime(1400 + 2000 + 3000 + 4000);
    expect(timer.getSnapshot()).toEqual({ state: 'GO', round: 2 });
  });

  it('beeps quietly on standby and loudly on go and stop', () => {
    const { timer, calls } = build();
    timer.start();
    vi.advanceTimersByTime(5000);
    expect(calls.at(-1)).toEqual({ kind: 'tone', frequency: 440, gain: 0.3 });

    vi.advanceTimersByTime(4000);
    expect(calls.at(-1)).toEqual({ kind: 'blip', frequency: 880, gain: 1, durationMs: 100 });

    vi.advanceTimersByTime(1400);
    expect(calls.at(-1)).toEqual({ kind: 'blip', frequency: 880, gain: 1, durationMs: 100 });
  });

  it('jitters the standby delay within +/- randomness', () => {
    const late = build(() => 1); // jitter = +randomness
    late.timer.start();
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(4000 + 3000 - 1);
    expect(late.timer.getSnapshot().state).toBe('READYSET');
    vi.advanceTimersByTime(1);
    expect(late.timer.getSnapshot().state).toBe('GO');

    vi.clearAllTimers();

    const early = build(() => 0); // jitter = -randomness
    early.timer.start();
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(4000 - 3000 - 1);
    expect(early.timer.getSnapshot().state).toBe('READYSET');
    vi.advanceTimersByTime(1);
    expect(early.timer.getSnapshot().state).toBe('GO');
  });

  it('never lets the standby drop below one second', () => {
    const { timer } = build(() => 0);
    timer.configure({ delay: 1, randomness: 5 }); // would be -4s unclamped
    timer.start();
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(999);
    expect(timer.getSnapshot().state).toBe('READYSET');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot().state).toBe('GO');
  });

  it('never schedules a negative reset when the interval is under two seconds', () => {
    const { timer } = build();
    timer.configure({ interval: 1 });
    timer.start();
    vi.advanceTimersByTime(1000 + 4000); // GO
    vi.advanceTimersByTime(1400); // DONE
    vi.advanceTimersByTime(2000); // RESETTING, with interval - 2s === -1s
    expect(timer.getSnapshot().state).toBe('RESETTING');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot().state).toBe('READYSET');
  });

  it('goes silent on stop and schedules nothing further', () => {
    const { timer, calls, states } = build();
    timer.start();
    vi.advanceTimersByTime(5000);
    expect(timer.getSnapshot().state).toBe('READYSET');

    timer.stop();
    expect(timer.getSnapshot().state).toBe('STOPPED');
    expect(calls.at(-1)).toEqual({ kind: 'silence' });

    const seen = states.length;
    vi.advanceTimersByTime(60_000);
    expect(states).toHaveLength(seen);
    expect(timer.getSnapshot().state).toBe('STOPPED');
  });

  it('ignores start while already running', () => {
    const { timer, states } = build();
    timer.start();
    vi.advanceTimersByTime(5000 + 4000);
    expect(timer.getSnapshot().round).toBe(1);

    timer.start();
    expect(timer.getSnapshot()).toEqual({ state: 'GO', round: 1 });
    expect(states.filter((state) => state === 'RESETTING')).toHaveLength(1);
  });

  it('resets the round counter on each new session', () => {
    const { timer } = build();
    timer.start();
    vi.advanceTimersByTime(5000 + 4000);
    expect(timer.getSnapshot().round).toBe(1);
    timer.stop();
    timer.start();
    expect(timer.getSnapshot().round).toBe(0);
  });

  it('picks up config changes made mid-session', () => {
    const { timer } = build();
    timer.start();
    vi.advanceTimersByTime(5000); // READYSET, standby already scheduled at 4s
    timer.configure({ target: 3 });
    vi.advanceTimersByTime(4000); // GO, now using the new goal time
    vi.advanceTimersByTime(2999);
    expect(timer.getSnapshot().state).toBe('GO');
    vi.advanceTimersByTime(1);
    expect(timer.getSnapshot().state).toBe('DONE');
  });

  it('stops notifying once unsubscribed', () => {
    const { beeper } = recordingBeeper();
    const timer = new ReactionTimer({ beeper, random: () => 0.5 });
    timer.configure(CONFIG);
    const seen: TimerState[] = [];
    const unsubscribe = timer.subscribe((snapshot) => seen.push(snapshot.state));

    timer.start();
    expect(seen).toEqual(['RESETTING']);

    unsubscribe();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual(['RESETTING']);
  });

  it('is inert after dispose', () => {
    const { timer, states } = build();
    timer.start();
    timer.dispose();
    // dispose() stops first, so subscribers see the final STOPPED before
    // being detached, then nothing more.
    expect(states).toEqual(['RESETTING', 'STOPPED']);
    vi.advanceTimersByTime(60_000);
    expect(timer.getSnapshot().state).toBe('STOPPED');
    expect(states).toEqual(['RESETTING', 'STOPPED']);
  });
});
