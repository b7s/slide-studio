import "@testing-library/jest-dom";
import { setTranslations } from "../lib/i18n";

// Seed an empty translation map so `__()` resolves unknown keys to the key
// itself (mirrors lib/i18n default behaviour). Tests assert on stable keys.
setTranslations({});

// Mark the environment as act-aware so React 18 flushes state updates
// synchronously inside Testing Library without the "not configured for
// act(...)" warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// EditorContext references a bare global `__` helper. Provide the same
// fallback semantics as lib/i18n for the test runtime.
globalThis.__ = (key, replace) => {
  let str = typeof key === "string" ? key : String(key);

  if (replace && typeof replace === "object") {
    for (const [token, value] of Object.entries(replace)) {
      str = str.split(`:${token}`).join(String(value));
    }
  }

  return str;
};

// jsdom does not implement matchMedia — components (useMediaQuery, AppShell
// responsive logic) rely on it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Shadow-DOM canvas + ResizeObserver are not present in jsdom.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.open) {
  window.open = () => null;
}
