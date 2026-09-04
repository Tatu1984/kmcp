import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Everything jsdom is missing that the portal's components assume.
 *
 * jsdom implements the DOM, not a browser: it has no layout engine and no
 * pointer capture, so the Radix primitives this codebase builds on — every
 * menu, dialog and popover — throw on open rather than render. The shims below
 * are the minimum that makes them behave, and each is a stub only because
 * nothing under test depends on the real measurement.
 *
 * If a component ever needs a real size or a real match, that is a sign it
 * wants an end-to-end test rather than a better fake.
 */

// Radix asks whether an element has captured the pointer before it will open a
// menu on pointerdown. jsdom has no pointer capture at all.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
}

// Called when a menu moves focus to an item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!("DOMRect" in globalThis)) {
  globalThis.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
    top = 0;
    left = 0;
    right = 0;
    bottom = 0;
    toJSON() {
      return this;
    }
  } as unknown as typeof DOMRect;
}

// `use-mobile` and the sidebar read this on mount.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

/**
 * Unmount between tests. Without this a component from an earlier test is still
 * in the document, and `getByRole` finds two of everything — which reads as a
 * duplicate-rendering bug that is not there.
 */
afterEach(() => {
  cleanup();
});
