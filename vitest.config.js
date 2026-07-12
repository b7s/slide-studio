import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest config for the React/Inertia editor. Component tests run in jsdom
// with Testing Library; the setup file mocks browser-only globals and seeds
// the client translation/routing helpers so editor components render.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./resources/js/test/setup.js"],
    include: ["resources/js/**/*.test.{js,jsx}"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
  },
});
