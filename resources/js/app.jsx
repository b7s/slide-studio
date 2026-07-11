import "./../css/app.css";
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createInertiaApp, usePage } from "@inertiajs/react";
import { TooltipProvider } from "./Components/ui/tooltip";
import { Toaster } from "./Components/ui/sonner";
import { setTranslations } from "./lib/i18n";
import { setRoutes } from "./lib/routes";

function I18nSync() {
  const { props } = usePage();
  useEffect(() => {
    if (props.translations) {
      setTranslations(props.translations);
    }
    if (props.routes) {
      setRoutes(props.routes);
    }
  }, [props.translations, props.routes]);
  return null;
}

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

    createRoot(el).render(
      <TooltipProvider delayDuration={300}>
        <App {...props} />
        <I18nSync />
        <Toaster />
      </TooltipProvider>
    );
  },
});
