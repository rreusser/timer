import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** The install prompt event, which TypeScript's DOM lib still omits. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** A new build is cached and waiting to take over. */
  needRefresh: boolean;
  /** The app has just become usable offline. */
  offlineReady: boolean;
  /** The browser has offered an install prompt we deferred. */
  canInstall: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
  dismissOfflineReady: () => void;
  install: () => void;
}

/**
 * Service worker lifecycle and install prompt, kept out of the components.
 *
 * The update is deliberately not applied automatically: taking over and
 * reloading mid-round would throw away a training session.
 */
export function usePwa(): PwaState {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress the browser's own mini-infobar so the app can offer the
      // prompt at a moment that makes sense.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredPrompt(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    // A prompt can only be used once, whatever the user chooses.
    setDeferredPrompt(null);
    void prompt.prompt().catch(() => {});
  }, [deferredPrompt]);

  const applyUpdate = useCallback(() => {
    setNeedRefresh(false);
    void updateServiceWorker(true);
  }, [setNeedRefresh, updateServiceWorker]);

  const dismissUpdate = useCallback(() => setNeedRefresh(false), [setNeedRefresh]);
  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady]);

  return {
    needRefresh,
    offlineReady,
    canInstall: deferredPrompt !== null,
    applyUpdate,
    dismissUpdate,
    dismissOfflineReady,
    install,
  };
}
