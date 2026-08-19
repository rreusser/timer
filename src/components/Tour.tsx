import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './Tour.module.css';

interface TourProps {
  onDismiss: () => void;
  onDisable: () => void;
}

const GOT_IT_COLORS = { light: 'var(--primary-light)', veryDark: 'var(--primary-very-dark)' };
const NEVER_COLORS = { light: 'var(--secondary-light)', veryDark: 'var(--secondary-very-dark)' };

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, distinguished by touch support.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** The iOS share glyph, inline so it can never 404 or go out of date. */
function ShareIcon() {
  return (
    <svg
      className={styles.share}
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 1.2v11" />
      <path d="M4.6 4.6 8 1.2l3.4 3.4" />
      <path d="M4 7.6H2.2v11h11.6v-11H12" />
    </svg>
  );
}

export function Tour({ onDismiss, onDisable }: TourProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const showInstallHint = isIos() && !isStandalone();

  // Move focus into the dialog so keyboard and screen-reader users land here,
  // and send Escape back out.
  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <div className={styles.outerContainer}>
      <div
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-heading"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className={styles.content}>
          <h1 className={styles.heading} id="tour-heading">
            Reaction Trainer
          </h1>
          <p className={styles.body}>
            Welcome! This app helps you train your reaction time for performing a task. You can set
            up a starting delay, a goal time, and the amount of time to reset and get ready for the
            next test.
          </p>
          <p className={styles.body}>
            Turn your volume up: a quiet tone means <em>stand by</em>, and the loud beep is your cue
            to go. A second beep marks your goal time.
          </p>
          {showInstallHint && (
            <p className={styles.install}>
              The best way to use this app is to add it to your home screen: tap
              <ShareIcon />
              Share, then <strong>Add to Home Screen</strong>.
            </p>
          )}
          <p className={styles.body}>
            Comments? Questions?
            <br />
            <a href="mailto:rsreusser+reactiontimer@gmail.com" className={styles.link}>
              Let me know
            </a>
          </p>
        </div>
        <div className={styles.item}>
          <Button onPress={onDismiss} fontSize={1.2} label="Got it!" colors={GOT_IT_COLORS} />
        </div>
        <div className={styles.item}>
          <Button
            onPress={onDisable}
            fontSize={1.2}
            label="Don't show me this again"
            colors={NEVER_COLORS}
          />
        </div>
      </div>
    </div>
  );
}
