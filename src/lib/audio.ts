/**
 * The beeper.
 *
 * The original app built its AudioContext at module scope, which is why the
 * app went silent: since Chrome 71 / Safari 11 an AudioContext created outside
 * a user gesture starts `suspended` and stays that way. Here the context is
 * created lazily and resumed inside the click handler that starts a session,
 * and every envelope is scheduled on the audio clock rather than with
 * `setTimeout`, so beeps stay sample-accurate when the main thread is busy.
 */
export interface Beeper {
  /** Must be called from inside a user-gesture handler. */
  unlock(): Promise<void>;
  /** Start a sustained tone (used for the "ready... set..." standby tone). */
  tone(frequency: number, gain: number): void;
  /** A short burst that returns to silence on its own. */
  blip(frequency: number, gain: number, durationMs: number): void;
  silence(): void;
  dispose(): void;
}

/** Time constant for gain ramps. Long enough to avoid an audible click. */
const RAMP = 0.005;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  );
}

/**
 * On iOS, Web Audio defaults to the "ambient" audio session, which the
 * hardware ring/silent switch mutes. A training app whose whole point is an
 * audible cue has to opt into playback instead (Safari 16.4+).
 */
function claimPlaybackSession(): void {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = 'playback';
  } catch {
    // Not settable on this browser.
  }
}

export function createBeeper(): Beeper {
  let ctx: AudioContext | undefined;
  let osc: OscillatorNode | undefined;
  let gain: GainNode | undefined;

  // Rebuilds the graph on demand. `dispose()` deliberately leaves no latch
  // behind: React StrictMode runs effect cleanups on a component it is about
  // to remount, and a one-way teardown there silenced the whole app in dev.
  function ensure(): AudioContext | undefined {
    if (ctx) return ctx;

    const Ctor = getAudioContextCtor();
    if (!Ctor) return undefined;

    claimPlaybackSession();
    ctx = new Ctor();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);

    osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    osc.connect(gain);
    // A single oscillator runs for the lifetime of the page; loudness is
    // controlled entirely by the gain node. Oscillators cannot be restarted
    // once stopped, which is what broke the original's start()/stop() pair.
    osc.start();

    return ctx;
  }

  function setGainAt(value: number, when: number): void {
    if (!gain || !ctx) return;
    gain.gain.setTargetAtTime(value, when, RAMP);
  }

  return {
    async unlock(): Promise<void> {
      const context = ensure();
      if (!context) return;
      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          // Some browsers reject resume() outside a gesture. Nothing to do
          // but stay silent; the rest of the app still works.
        }
      }
    },

    tone(frequency: number, level: number): void {
      const context = ensure();
      if (!context || !osc) return;
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      setGainAt(level, context.currentTime);
    },

    blip(frequency: number, level: number, durationMs: number): void {
      const context = ensure();
      if (!context || !osc) return;
      const now = context.currentTime;
      osc.frequency.setValueAtTime(frequency, now);
      setGainAt(level, now);
      setGainAt(0, now + durationMs / 1000);
    },

    silence(): void {
      if (!ctx) return;
      setGainAt(0, ctx.currentTime);
    },

    dispose(): void {
      try {
        osc?.stop();
      } catch {
        // Already stopped.
      }
      osc?.disconnect();
      gain?.disconnect();
      void ctx?.close().catch(() => {});
      ctx = undefined;
      osc = undefined;
      gain = undefined;
    },
  };
}

/** A no-op beeper, used in tests and when Web Audio is unavailable. */
export function createSilentBeeper(): Beeper {
  return {
    unlock: async () => {},
    tone: () => {},
    blip: () => {},
    silence: () => {},
    dispose: () => {},
  };
}
