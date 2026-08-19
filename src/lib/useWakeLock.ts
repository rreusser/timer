import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release(): Promise<void>;
  released: boolean;
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Hold a screen wake lock while `active`. A training session is minutes of
 * standing still watching the phone, which is exactly when the screen would
 * otherwise dim and lock. Silently does nothing where unsupported.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | undefined;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          void next.release().catch(() => {});
          return;
        }
        sentinel = next;
      } catch {
        // Denied (battery saver, background tab). Not worth surfacing.
      }
    };

    // The lock is dropped whenever the page is hidden, so re-take it on return.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => {});
      sentinel = undefined;
    };
  }, [active]);
}
