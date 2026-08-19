import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../App';

/**
 * jsdom has no layout, so every rect is zero. Give the slider slabs a real
 * geometry: 300px wide starting at x = 0.
 */
const TRACK_LEFT = 0;
const TRACK_WIDTH = 300;

function withLayout() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: TRACK_LEFT,
    y: 0,
    left: TRACK_LEFT,
    top: 0,
    right: TRACK_LEFT + TRACK_WIDTH,
    bottom: 100,
    width: TRACK_WIDTH,
    height: 100,
    toJSON: () => ({}),
  } as DOMRect);
}

/** The slab that owns a given labelled slider. */
function slabFor(label: string): HTMLElement {
  const input = screen.getByRole('slider', { name: label });
  const slab = input.parentElement;
  if (!slab) throw new Error(`no slab for ${label}`);
  return slab;
}

function at(fraction: number) {
  return TRACK_LEFT + TRACK_WIDTH * fraction;
}

function value(label: string) {
  return (screen.getByRole('slider', { name: label }) as HTMLInputElement).valueAsNumber;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('reactionTrainer.tourDisabled', 'true');
  withLayout();
  act(() => {
    render(<App />);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('dragging a slider', () => {
  it('sets the value where a drag begins', () => {
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.5), button: 0 });
    });
    // delay spans 1..10, so halfway is 5.5.
    expect(value('Starting Delay')).toBeCloseTo(5.5, 5);
  });

  // The reported bug: tapping worked, sweeping did not.
  it('follows the pointer as it sweeps across the slab', () => {
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.2), button: 0 });
    });
    const afterPress = value('Starting Delay');

    const seen: number[] = [];
    for (const fraction of [0.4, 0.6, 0.8, 1]) {
      act(() => {
        fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(fraction) });
      });
      seen.push(value('Starting Delay'));
    }

    expect(afterPress).toBeCloseTo(2.8, 5);
    expect(seen).toEqual([4.6, 6.4, 8.2, 10]);
  });

  it('drags downwards too, and clamps at the minimum', () => {
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.9), button: 0 });
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(-0.5) });
    });
    expect(value('Starting Delay')).toBe(1);
  });

  it('clamps at the maximum past the right edge', () => {
    const slab = slabFor('Goal Time');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.5), button: 0 });
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(2) });
    });
    expect(value('Goal Time')).toBe(10);
  });

  it('snaps to the step grid', () => {
    const slab = slabFor('Goal Time');
    act(() => {
      // Goal time steps by 0.02 across 0.2..10.
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.333), button: 0 });
    });
    const result = value('Goal Time');
    expect((Math.round(((result - 0.2) / 0.02) * 1e6) / 1e6) % 1).toBe(0);
  });

  it('ignores movement once the pointer is released', () => {
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.2), button: 0 });
      fireEvent.pointerUp(slab, { pointerId: 1 });
    });
    const released = value('Starting Delay');

    act(() => {
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(0.9) });
    });
    expect(value('Starting Delay')).toBe(released);
  });

  it('ignores a stray move that was never preceded by a press', () => {
    const slab = slabFor('Time Between Rounds');
    const before = value('Time Between Rounds');
    act(() => {
      fireEvent.pointerMove(slab, { pointerId: 7, clientX: at(0.9) });
    });
    expect(value('Time Between Rounds')).toBe(before);
  });

  it('ignores a second finger while one is already dragging', () => {
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.2), button: 0 });
    });
    const firstFinger = value('Starting Delay');

    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 2, clientX: at(0.9), button: 0 });
      fireEvent.pointerMove(slab, { pointerId: 2, clientX: at(0.95) });
    });
    expect(value('Starting Delay')).toBe(firstFinger);
  });

  it('ignores a right-click drag', () => {
    const slab = slabFor('Starting Delay');
    const before = value('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, {
        pointerId: 1,
        clientX: at(0.9),
        button: 2,
        pointerType: 'mouse',
      });
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(0.95) });
    });
    expect(value('Starting Delay')).toBe(before);
  });

  it('leaves the neighbouring sliders alone', () => {
    const before = value('Goal Time');
    const slab = slabFor('Starting Delay');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.8), button: 0 });
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(0.1) });
    });
    expect(value('Goal Time')).toBe(before);
  });

  it('still responds to the keyboard', () => {
    const input = screen.getByRole('slider', { name: 'Starting Delay' });
    act(() => {
      fireEvent.change(input, { target: { value: '7.3' } });
    });
    expect(value('Starting Delay')).toBeCloseTo(7.3, 5);
  });

  it('persists what a drag produced', () => {
    const slab = slabFor('Time Between Rounds');
    act(() => {
      fireEvent.pointerDown(slab, { pointerId: 1, clientX: at(0.25), button: 0 });
      fireEvent.pointerMove(slab, { pointerId: 1, clientX: at(0.75) });
      fireEvent.pointerUp(slab, { pointerId: 1 });
    });
    expect(window.localStorage.getItem('reactionTrainer.interval')).toBe(
      String(value('Time Between Rounds')),
    );
  });
});
