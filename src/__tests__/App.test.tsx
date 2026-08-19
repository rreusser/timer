import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App';

// jsdom has no AudioContext, so the beeper degrades to a no-op on its own and
// these tests exercise the real component tree without any audio mocking.

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderApp() {
  return act(() => {
    render(<App />);
  });
}

function press(name: string) {
  act(() => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('App', () => {
  it('greets a first-time visitor with the tour', () => {
    renderApp();
    expect(screen.getByRole('dialog', { name: 'Reaction Trainer' })).toBeInTheDocument();
  });

  it('dismisses the tour without remembering the choice', () => {
    renderApp();
    press('Got it!');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('reactionTrainer.tourDisabled')).toBeNull();
  });

  it('remembers when the tour is turned off for good', () => {
    renderApp();
    press("Don't show me this again");
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    cleanup();
    renderApp();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('respects the original app’s tourDisabled flag', () => {
    window.localStorage.setItem('tourDisabled', 'true');
    renderApp();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the four settings as accessible sliders', () => {
    renderApp();
    press('Got it!');

    const labels = [
      'Starting Delay',
      'Starting Delay Randomness',
      'Goal Time',
      'Time Between Rounds',
    ];
    for (const label of labels) {
      expect(screen.getByRole('slider', { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('slider')).toHaveLength(4);
  });

  it('persists a settings change and shows it immediately', () => {
    renderApp();
    press('Got it!');

    const slider = screen.getByRole('slider', { name: 'Goal Time' });
    act(() => {
      fireEvent.change(slider, { target: { value: '2.5' } });
    });

    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(window.localStorage.getItem('reactionTrainer.target')).toBe('2.5');
  });

  it('runs a round through every phase and back to the menu', () => {
    renderApp();
    press('Got it!');

    // delay 4s, randomness 0 so the standby is exact, par 1.4s, 5s rounds.
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Starting Delay Randomness' }), {
        target: { value: '0' },
      });
    });

    press('Start');
    expect(screen.getByText('Get ready')).toBeInTheDocument();

    tick(5000);
    expect(screen.getByText('Ready… set…')).toBeInTheDocument();

    tick(4000);
    expect(screen.getByText('Go!')).toBeInTheDocument();
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();

    tick(1400);
    expect(screen.getByText('Stop', { selector: 'span[role="status"]' })).toBeInTheDocument();

    tick(2000);
    expect(screen.getByText('Get ready')).toBeInTheDocument();

    press('Stop');
    expect(screen.getByRole('slider', { name: 'Goal Time' })).toBeInTheDocument();
  });

  it('stops a running session when the page is hidden', () => {
    renderApp();
    press('Got it!');
    press('Start');
    expect(screen.getByText('Get ready')).toBeInTheDocument();

    act(() => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByRole('slider', { name: 'Goal Time' })).toBeInTheDocument();
  });
});
