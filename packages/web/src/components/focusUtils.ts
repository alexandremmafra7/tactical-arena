const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const previousActiveElements: { focus: () => void }[] = [];

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !(element as HTMLButtonElement).disabled,
  );
}

export function focusFirstFocusable(container: HTMLElement): void {
  getFocusableElements(container)[0]?.focus();
}

export function focusLastFocusable(container: HTMLElement): void {
  getFocusableElements(container).at(-1)?.focus();
}

export function restoreFocus(): void {
  previousActiveElements.pop()?.focus();
}

export function trapFocus(container: HTMLElement): () => void {
  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  if (activeElement && typeof (activeElement as HTMLElement).focus === 'function') {
    previousActiveElements.push(activeElement as HTMLElement);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = typeof document === 'undefined' ? null : document.activeElement;

    if (event.shiftKey && (current === first || !focusable.includes(current as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !focusable.includes(current as HTMLElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handleKeyDown);
  focusFirstFocusable(container);

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;
    container.removeEventListener('keydown', handleKeyDown);
    restoreFocus();
  };
}
