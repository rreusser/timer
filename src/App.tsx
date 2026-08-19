import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import styles from './App.module.css';
import { Menu } from './components/Menu';
import { Train } from './components/Train';
import { Tour } from './components/Tour';
import { createBeeper } from './lib/audio';
import {
  loadConfig,
  safeStorage,
  saveConfig,
  type ConfigKey,
  type TimerConfig,
} from './lib/config';
import { ReactionTimer } from './lib/timer';
import { useWakeLock } from './lib/useWakeLock';

const TOUR_DISABLED_KEY = 'reactionTrainer.tourDisabled';
const LEGACY_TOUR_DISABLED_KEY = 'tourDisabled';

function tourWasDisabled(): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    return (
      storage.getItem(TOUR_DISABLED_KEY) !== null ||
      storage.getItem(LEGACY_TOUR_DISABLED_KEY) !== null
    );
  } catch {
    return false;
  }
}

export function App() {
  const [config, setConfig] = useState<TimerConfig>(loadConfig);
  const [screen, setScreen] = useState<'menu' | 'train'>('menu');
  const [tourVisible, setTourVisible] = useState(() => !tourWasDisabled());

  // One beeper and one timer for the lifetime of the app. A lazy useState
  // initialiser is the stable way to hold them: no AudioContext exists until
  // the beeper is first asked to make a sound.
  const [{ beeper, timer }] = useState(() => {
    const created = createBeeper();
    return { beeper: created, timer: new ReactionTimer({ beeper: created }) };
  });

  const { state, round } = useSyncExternalStore(timer.subscribe, timer.getSnapshot);

  useEffect(() => {
    return () => {
      timer.dispose();
      beeper.dispose();
    };
  }, [timer, beeper]);

  // Keep the engine and localStorage in step with the sliders, live — the
  // original only re-read config when the train screen mounted.
  useEffect(() => {
    timer.configure(config);
    saveConfig(config);
  }, [timer, config]);

  useWakeLock(screen === 'train');

  const handleChange = useCallback((key: ConfigKey, value: number) => {
    setConfig((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleStart = useCallback(() => {
    // This runs inside the click handler, which is the only place a browser
    // will let an AudioContext start.
    void beeper.unlock();
    setScreen('train');
    timer.start();
  }, [beeper, timer]);

  const handleStop = useCallback(() => {
    timer.stop();
    setScreen('menu');
  }, [timer]);

  const dismissTour = useCallback(() => setTourVisible(false), []);

  const disableTour = useCallback(() => {
    try {
      safeStorage()?.setItem(TOUR_DISABLED_KEY, 'true');
    } catch {
      // Persisting the preference is best effort.
    }
    setTourVisible(false);
  }, []);

  // Stop a session that is running when the tab goes away, so a phone locked
  // mid-session does not beep from a pocket later.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && screen === 'train') {
        timer.stop();
        setScreen('menu');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [screen, timer]);

  return (
    <div className={styles.main}>
      {screen === 'train' ? (
        <Train state={state} round={round} target={config.target} onStop={handleStop} />
      ) : (
        <Menu config={config} onChange={handleChange} onStart={handleStart} />
      )}
      {tourVisible && screen === 'menu' && <Tour onDismiss={dismissTour} onDisable={disableTour} />}
    </div>
  );
}
