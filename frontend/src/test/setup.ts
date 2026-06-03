import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia; ThemeContext reads it on init.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom Element lacks scrollTo; ChatView calls it.
Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});
