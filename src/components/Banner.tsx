import styles from './Banner.module.css';

interface BannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

/**
 * A single-line notice above the current screen. It takes part in the column
 * layout rather than floating over it, so it can never swallow a drag meant
 * for the slider underneath.
 */
export function Banner({ message, actionLabel, onAction, onDismiss }: BannerProps) {
  return (
    <div className={styles.container} role="status">
      <span className={styles.message}>{message}</span>
      {actionLabel && onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
