/**
 * The four numbers that describe a training round.
 *
 * A round runs: RESETTING -> READYSET -> GO -> DONE -> RESETTING -> ...
 *
 *   delay       seconds of "ready... set..." before the GO beep
 *   randomness  the delay is jittered by +/- this many seconds, so the GO beep
 *               is never predictable
 *   target      the par time: seconds between the GO beep and the STOP beep
 *   interval    seconds between the start of one round and the next
 */
export interface TimerConfig {
  delay: number;
  randomness: number;
  target: number;
  interval: number;
}

export const CONFIG_KEYS = ['delay', 'randomness', 'target', 'interval'] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

export const DEFAULT_CONFIG: TimerConfig = {
  delay: 4,
  randomness: 3,
  target: 1.4,
  interval: 5,
};

export interface ConfigBounds {
  min: number;
  max: number;
  step: number;
  digits: number;
  label: string;
  units: string;
  prefix?: string;
  /** Screen-reader description of what the control does. */
  hint: string;
}

export const CONFIG_BOUNDS: Record<ConfigKey, ConfigBounds> = {
  delay: {
    min: 1,
    max: 10,
    step: 0.1,
    digits: 1,
    label: 'Starting Delay',
    units: 's',
    hint: 'Seconds to wait before the go beep',
  },
  randomness: {
    min: 0,
    max: 5,
    step: 0.1,
    digits: 1,
    label: 'Starting Delay Randomness',
    units: 's',
    prefix: '±',
    hint: 'How much the starting delay is randomly varied',
  },
  target: {
    // The original allowed a goal time of 0, which fires the stop beep in the
    // same tick as the go beep. Clamped to something a human can act on.
    min: 0.2,
    max: 10,
    step: 0.02,
    digits: 2,
    label: 'Goal Time',
    units: 's',
    hint: 'Par time: seconds between the go beep and the stop beep',
  },
  interval: {
    min: 1,
    max: 10,
    step: 0.1,
    digits: 1,
    label: 'Time Between Rounds',
    units: 's',
    hint: 'Seconds from the start of one round to the start of the next',
  },
};

const STORAGE_PREFIX = 'reactionTrainer.';

function clampToBounds(key: ConfigKey, value: number): number {
  const { min, max } = CONFIG_BOUNDS[key];
  return Math.min(max, Math.max(min, value));
}

/**
 * Read the saved config, falling back to defaults for anything missing,
 * unparseable or out of range. Never throws: private-mode Safari and
 * cookie-blocking browsers make `localStorage` access itself throw.
 */
export function loadConfig(storage: Storage | undefined = safeStorage()): TimerConfig {
  const config = { ...DEFAULT_CONFIG };
  if (!storage) return config;

  for (const key of CONFIG_KEYS) {
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_PREFIX + key) ?? storage.getItem(key);
    } catch {
      return config;
    }
    if (raw === null) continue;
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) config[key] = clampToBounds(key, value);
  }
  return config;
}

export function saveConfig(
  config: TimerConfig,
  storage: Storage | undefined = safeStorage(),
): void {
  if (!storage) return;
  try {
    for (const key of CONFIG_KEYS) {
      storage.setItem(STORAGE_PREFIX + key, String(config[key]));
    }
  } catch {
    // Storage is full or blocked. Losing persistence is not worth crashing over.
  }
}

export function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
