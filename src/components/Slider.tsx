import { useId } from 'react';
import styles from './Slider.module.css';

interface SliderColors {
  dark: string;
  veryLight: string;
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  digits: number;
  label: string;
  units?: string;
  prefix?: string;
  hint?: string;
  colors: SliderColors;
}

/**
 * A full-width slab that doubles as a slider: the fill shows the value and
 * dragging anywhere across it sets the value.
 *
 * The original hand-rolled this from mousemove/touchmove listeners, which is
 * why it had no keyboard support and needed a 2% overshoot "buffer" hack to
 * make the ends reachable. Here a transparent <input type="range"> lies over
 * the slab and does all of that natively.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  digits,
  label,
  units,
  prefix,
  hint,
  colors,
}: SliderProps) {
  const hintId = useId();
  const position = max === min ? 0 : (value - min) / (max - min);
  const text = `${prefix ?? ''}${value.toFixed(digits)}${units ?? ''}`;

  return (
    <div className={styles.container}>
      <span
        className={styles.fill}
        style={{
          transform: `translate3d(${100 * (position - 1)}%, 0, 0)`,
          backgroundColor: colors.dark,
        }}
      />
      <span className={styles.content}>
        <span className={styles.value}>
          {prefix && <span className={styles.units}>{prefix}</span>}
          {value.toFixed(digits)}
          {units && <span className={styles.units}>{units}</span>}
        </span>
        <span className={styles.label}>{label}</span>
      </span>
      <input
        className={styles.input}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        aria-valuetext={text}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      {hint && (
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
    </div>
  );
}
