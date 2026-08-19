import styles from './Button.module.css';

export interface ButtonColors {
  light: string;
  veryDark: string;
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  colors: ButtonColors;
  fontSize?: number;
}

/**
 * A full-bleed slab button.
 *
 * The original listened for both `onClick` and `onTouchStart`, which double
 * fired on some devices and needed a global `touchstart` preventDefault to
 * stay usable. A real <button> plus `touch-action: manipulation` gets the same
 * responsiveness with keyboard and screen-reader support for free.
 */
export function Button({ label, onPress, colors, fontSize = 2 }: ButtonProps) {
  return (
    <button
      type="button"
      className={styles.container}
      onClick={onPress}
      style={{ backgroundColor: colors.light, color: colors.veryDark }}
    >
      <span className={styles.content} style={{ fontSize: `${fontSize}em` }}>
        {label}
      </span>
    </button>
  );
}
