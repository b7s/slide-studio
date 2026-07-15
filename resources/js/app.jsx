import "./../css/app.css";
import React from "react";
import {createRoot} from "react-dom/client";
import {createInertiaApp} from "@inertiajs/react";
import {TooltipProvider} from "./Components/ui/tooltip";
import {Toaster} from "./Components/ui/sonner";
import {setTranslations} from "./lib/i18n";
import {setRoutes} from "./lib/routes";

// Initial translations + named-route map are seeded eagerly from
// `props.initialPage` inside `setup`. Inertia renders a single full-page
// route (the editor), so SPA navigation doesn't re-trigger a sync; this
// keeps `usePage()` out of the bundle bootstrap (it must run inside the
// Inertia provider, which is `<App>` — siblings can't read it).

createInertiaApp({
  resolve: (name) => {
    const pages = import.meta.glob("./Pages/**/*.jsx", { eager: true });
    return pages[`./Pages/${name}.jsx`];
  },
  setup({ el, App, props }) {
    const page = props.initialPage;
    if (page?.props?.translations) {
      setTranslations(page.props.translations);
    }
    if (page?.props?.routes) {
      setRoutes(page.props.routes);
    }

    // Apply a configurable highlight color from the environment (defaults are
    // declared in `app.css` as `--highlight`/`--highlight-strong`).
    const root = document.documentElement;
    if (import.meta.env.VITE_HIGHLIGHT_COLOR) {
      root.style.setProperty("--highlight", import.meta.env.VITE_HIGHLIGHT_COLOR);
    }
    if (import.meta.env.VITE_HIGHLIGHT_STRONG_COLOR) {
      root.style.setProperty("--highlight-strong", import.meta.env.VITE_HIGHLIGHT_STRONG_COLOR);
    }

    createRoot(el).render(
      <TooltipProvider delayDuration={300}>
        <App {...props} />
        <Toaster />
      </TooltipProvider>
    );
  },
});
