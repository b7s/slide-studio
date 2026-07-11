import { useEffect, useState } from "react";
import { Button } from "../Components/ui/button";
import { __ } from "../lib/i18n";

const STORAGE_KEY = "slide-studio:browser-warning-dismissed";

function isSafari(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("chrome") || ua.includes("chromium") || ua.includes("firefox") || ua.includes("edg")) {
    return false;
  }
  return ua.includes("safari") || ua.includes("iphone") || ua.includes("ipad") || ua.includes("macintosh");
}

export function SafariCompatBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    if (isSafari(navigator.userAgent)) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  return (
    <div
      role="alert"
      className="col-span-full flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-2.5 text-sm"
    >
      <div>
        <p className="font-semibold">{__("messages.browser.warn_title")}</p>
        <p className="text-[var(--muted-foreground)]">{__("messages.browser.warn_body")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={dismiss}>
        {__("messages.browser.dismiss")}
      </Button>
    </div>
  );
}
