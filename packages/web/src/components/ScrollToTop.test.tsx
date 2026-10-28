import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ScrollToTop, resetScrollToTop } from './ScrollToTop.js';

describe('ScrollToTop Component and Helper', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('renders null without producing markup', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/clubs/123/briefing']}>
        <ScrollToTop />
      </MemoryRouter>
    );
    expect(html).toBe('');
  });

  it('resets window scroll and document scrollTop to 0 with instant behavior', () => {
    const scrollToMock = vi.fn();
    (globalThis as unknown as { window: { scrollTo: typeof scrollToMock } }).window = {
      scrollTo: scrollToMock,
    };
    (globalThis as unknown as { document: { documentElement: { scrollTop: number }; body: { scrollTop: number } } }).document = {
      documentElement: { scrollTop: 750 },
      body: { scrollTop: 750 },
    };

    resetScrollToTop('instant');

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(globalThis.document.documentElement.scrollTop).toBe(0);
    expect(globalThis.document.body.scrollTop).toBe(0);
  });

  it('resets with smooth behavior when requested', () => {
    const scrollToMock = vi.fn();
    (globalThis as unknown as { window: { scrollTo: typeof scrollToMock } }).window = {
      scrollTo: scrollToMock,
    };
    (globalThis as unknown as { document: { documentElement: { scrollTop: number }; body: { scrollTop: number } } }).document = {
      documentElement: { scrollTop: 200 },
      body: { scrollTop: 200 },
    };

    resetScrollToTop('smooth');

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  });
});
