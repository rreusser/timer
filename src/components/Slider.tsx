import { useCallback, useId, useRef } from 'react';
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
 * The drag is driven by pointer events on the slab rather than by the range
 * input underneath. A native range input only begins a drag when the gesture
 * starts on its thumb, which is unreachable here (the thumb is invisible), so
 * on WebKit a touch could set a value by tapping but never sweep it. Handling
 * pointers directly also lets us capture the pointer, so a finger that wanders
 * off the slab vertically keeps driving this slider instead of grabbing the
 * one below it.
 *
 * The input stays for keyboard and assistive technology, which is why it keeps
 * its onChange.
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
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const position = max === min ? 0 : (value - min) / (max - min);
  const text = `${prefix ?? ''}${value.toFixed(digits)}${units ?? ''}`;

  // Snap to the step grid measured from `min`, then round away the binary
  // floating point dust that 0.1-sized steps accumulate.
  const snap = useCallback(
    (raw: number) => {
      const clamped = Math.min(max, Math.max(min, raw));
      const stepped = min + Math.round((clamped - min) / step) * step;
      return Number(Math.min(max, Math.max(min, stepped)).toFixed(digits));
    },
    [min, max, step, digits],
  );

  const valueAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return value;
      return snap(min + (max - min) * ((clientX - rect.left) / rect.width));
    },
    [min, max, snap, value],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Ignore right/middle clicks and any finger after the first.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (activePointer.current !== null) return;

    event.preventDefault();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(valueAt(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    onChange(valueAt(event.clientX));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className={styles.container}
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
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
