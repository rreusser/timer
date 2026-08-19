import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// A controllable stand-in for the service worker registration hook, so the
// update and offline-ready states can be driven from a test.
const sw = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: vi.fn(async () => {}),
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
};

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [sw.offlineReady, sw.setOfflineReady],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

const { App } = await import('../App');

/** Stand-in for the browser's deferred install prompt. */
function installPromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('reactionTrainer.tourDisabled', 'true');
  sw.needRefresh = false;
  sw.offlineReady = false;
  sw.updateServiceWorker.mockClear();
  sw.setNeedRefresh.mockClear();
  sw.setOfflineReady.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderApp() {
  act(() => {
    render(<App />);
  });
}

function fireInstallPrompt() {
  const event = installPromptEvent();
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('PWA notices', () => {
  it('shows nothing by default', () => {
    renderApp();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers to install once the browser defers its prompt', () => {
    renderApp();
    const event = fireInstallPrompt();

    expect(screen.getByText(/Install this app/)).toBeInTheDocument();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('suppresses the browser mini-infobar so the prompt can be offered later', () => {
    renderApp();
    const event = installPromptEvent();
    const prevented = vi.spyOn(event, 'preventDefault');
    act(() => {
      window.dispatchEvent(event);
    });
    expect(prevented).toHaveBeenCalled();
  });

  it('never offers the same install prompt twice', () => {
    renderApp();
    fireInstallPrompt();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(screen.queryByText(/Install this app/)).not.toBeInTheDocument();
  });

  it('stays out of the way once the install notice is dismissed', () => {
    renderApp();
    fireInstallPrompt();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });
    expect(screen.queryByText(/Install this app/)).not.toBeInTheDocument();
  });

  it('drops the offer once the app is installed', () => {
    renderApp();
    fireInstallPrompt();
    expect(screen.getByText(/Install this app/)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByText(/Install this app/)).not.toBeInTheDocument();
  });

  it('asks before applying an update rather than reloading', () => {
    sw.needRefresh = true;
    renderApp();

    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    });
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('reports when the app has become usable offline', () => {
    sw.offlineReady = true;
    renderApp();
    expect(screen.getByText('Ready to use offline.')).toBeInTheDocument();
  });

  it('prefers the update notice over the install offer', () => {
    sw.needRefresh = true;
    renderApp();
    fireInstallPrompt();

    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
    expect(screen.queryByText(/Install this app/)).not.toBeInTheDocument();
  });

  // The whole reason the update is a prompt and not registerType: 'autoUpdate'.
  it('hides every notice during a training session', () => {
    sw.needRefresh = true;
    sw.offlineReady = true;
    renderApp();
    fireInstallPrompt();
    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    });

    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Install this app/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to use offline.')).not.toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();

    // And it comes back when the session ends.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    });
    expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
  });
});
