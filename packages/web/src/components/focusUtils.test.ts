import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  focusFirstFocusable,
  focusLastFocusable,
  restoreFocus,
  trapFocus,
} from './focusUtils.js';

interface FakeElement {
  disabled?: boolean;
  focus: ReturnType<typeof vi.fn>;
}

function focusable(disabled = false): FakeElement {
  return { disabled, focus: vi.fn() };
}

function container(elements: FakeElement[]) {
  return {
    querySelectorAll: vi.fn(() => elements),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

afterEach(() => {
  restoreFocus();
  vi.unstubAllGlobals();
});

describe('focus utilities', () => {
  it('focuses the first and last enabled focusable elements', () => {
    const first = focusable();
    const disabled = focusable(true);
    const last = focusable();
    const root = container([first, disabled, last]);

    focusFirstFocusable(root as unknown as HTMLElement);
    focusLastFocusable(root as unknown as HTMLElement);

    expect(first.focus).toHaveBeenCalledOnce();
    expect(disabled.focus).not.toHaveBeenCalled();
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it('loops Tab and Shift+Tab within the container', () => {
    const first = focusable();
    const last = focusable();
    const root = container([first, last]);
    const previous = focusable();
    const documentStub = { activeElement: previous };
    vi.stubGlobal('document', documentStub);

    const cleanup = trapFocus(root as unknown as HTMLElement);
    const listener = root.addEventListener.mock.calls[0][1] as (event: KeyboardEvent) => void;
    const preventDefault = vi.fn();

    documentStub.activeElement = last;
    first.focus.mockClear();
    listener({ key: 'Tab', shiftKey: false, preventDefault } as unknown as KeyboardEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();

    preventDefault.mockClear();
    documentStub.activeElement = first;
    listener({ key: 'Tab', shiftKey: true, preventDefault } as unknown as KeyboardEvent);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();

    cleanup();
    expect(root.removeEventListener).toHaveBeenCalledWith('keydown', listener);
    expect(previous.focus).toHaveBeenCalledOnce();
  });

  it('restores focus explicitly to the element captured by the trap', () => {
    const previous = focusable();
    vi.stubGlobal('document', { activeElement: previous });
    const cleanup = trapFocus(container([]) as unknown as HTMLElement);

    restoreFocus();
    cleanup();

    expect(previous.focus).toHaveBeenCalledOnce();
  });

  it('restores nested focus traps in last-opened-first-closed order', () => {
    const outside = focusable();
    const parentButton = focusable();
    const documentStub = { activeElement: outside };
    vi.stubGlobal('document', documentStub);

    const cleanupParent = trapFocus(container([]) as unknown as HTMLElement);
    documentStub.activeElement = parentButton;
    const cleanupChild = trapFocus(container([]) as unknown as HTMLElement);

    cleanupChild();
    expect(parentButton.focus).toHaveBeenCalledOnce();
    cleanupParent();
    expect(outside.focus).toHaveBeenCalledOnce();
  });
});
