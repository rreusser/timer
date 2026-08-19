import { Button } from './Button';
import { Slider } from './Slider';
import styles from './Menu.module.css';
import { CONFIG_BOUNDS, CONFIG_KEYS, type ConfigKey, type TimerConfig } from '../lib/config';

interface MenuProps {
  config: TimerConfig;
  onChange: (key: ConfigKey, value: number) => void;
  onStart: () => void;
}

const SLIDER_COLORS = { dark: 'var(--secondary-dark)', veryLight: 'var(--secondary-very-light)' };
const START_COLORS = { light: 'var(--primary-light)', veryDark: 'var(--primary-very-dark)' };

export function Menu({ config, onChange, onStart }: MenuProps) {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Reaction Trainer</h1>
      {CONFIG_KEYS.map((key) => {
        const bounds = CONFIG_BOUNDS[key];
        return (
          <Slider
            key={key}
            value={config[key]}
            onChange={(value) => onChange(key, value)}
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            digits={bounds.digits}
            label={bounds.label}
            units={bounds.units}
            {...(bounds.prefix ? { prefix: bounds.prefix } : {})}
            hint={bounds.hint}
            colors={SLIDER_COLORS}
          />
        );
      })}
      <Button label="Start" onPress={onStart} colors={START_COLORS} />
    </div>
  );
}
