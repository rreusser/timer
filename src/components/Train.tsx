import { Button } from './Button';
import styles from './Train.module.css';
import type { TimerState } from '../lib/timer';

interface TrainProps {
  state: TimerState;
  round: number;
  target: number;
  onStop: () => void;
}

const CUE: Record<TimerState, string> = {
  STOPPED: 'Stopped',
  RESETTING: 'Get ready',
  READYSET: 'Ready… set…',
  GO: 'Go!',
  DONE: 'Stop',
};

/**
 * The palette defined `orange`, `green` and `red` alongside the two greys but
 * never used them. They map onto the phases exactly, and a colour that reads
 * from across a room is worth more here than the cue text is.
 */
const BACKGROUND: Record<TimerState, string> = {
  STOPPED: 'var(--primary-very-dark)',
  RESETTING: 'var(--primary-dark)',
  READYSET: 'var(--orange-dark)',
  GO: 'var(--green-dark)',
  DONE: 'var(--red-dark)',
};

const STOP_COLORS = { light: 'var(--primary-light)', veryDark: 'var(--primary-very-dark)' };

export function Train({ state, round, target, onStop }: TrainProps) {
  return (
    <div className={styles.container}>
      <div className={styles.placeholder} style={{ backgroundColor: BACKGROUND[state] }}>
        {round > 0 && (
          <span className={styles.round}>
            Round {round} · goal {target.toFixed(2)}s
          </span>
        )}
        {/* aria-live announces each phase change to screen readers, which is
            the only cue a non-sighted user gets besides the beeps. */}
        <span className={styles.cue} role="status" aria-live="assertive">
          {CUE[state]}
        </span>
        {state === 'GO' && (
          <span
            // Keyed on the round so the animation restarts every repetition.
            key={round}
            className={styles.par}
            style={{ '--par-duration': `${target}s` } as React.CSSProperties}
          />
        )}
      </div>
      <Button label="Stop" onPress={onStop} colors={STOP_COLORS} />
    </div>
  );
}
