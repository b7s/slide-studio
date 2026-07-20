import {forwardRef, useEffect, useImperativeHandle, useRef} from "react";
import {rewriteMediaUrlsToPreview} from "../lib/mediaUrl";
import {BASE_CSS} from "../lib/slideStyle";

/**
 * SlideCanvas — renders slide HTML inside an open Shadow DOM root. CSS from
 * the slide is scoped to the shadow root (no leakage into editor chrome), but
 * the host lives in the same document so React/Radix overlays, context menus
 * and drag handlers all work natively — no iframe bridging needed.
 *
 * Critical: this component writes `innerHTML` exactly once, when it mounts
 * (or remounts). The engine (slideEditor.js) owns the live DOM and writes
 * directly to the shadow root from that point on. Rewriting `innerHTML` on
 * every `html` prop change would blow away the engine's selection/overlay
 * on each keystroke — so parent consumers must remount via the React `key`
 * prop on every fresh slide load (see EditorContext `slideKey` / `loadNonce`).
 */
const SlideCanvas = forwardRef(function SlideCanvas(
  { html = "", frameWidth = 1600, frameHeight = 900, className = "" },
  ref
) {
  const hostRef = useRef(null);
  const shadowRef = useRef(null);

  useImperativeHandle(ref, () => ({
    get host() { return hostRef.current; },
    get shadow() { return shadowRef.current; },
  }), []);

  // Default colour/font live on `.slide` and *inherit* to descendants. We must
  // NOT put `*` here: a `*` rule applies `color` directly to every element,
  // which overrides inherited values and breaks children inheriting a parent's
  // (inline) colour/font — e.g. a <b> inside a red <div> would turn grey instead
  // of red. Scoping to `.slide` lets explicit styles win via the cascade while
  // inheritance flows colour/font down to every child that doesn't set its own.
  // BASE_CSS is imported from ../lib/slideStyle (shared with the preview doc).

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: "open" });
    }
    // The persisted slide HTML may be either:
    //   - the full `<div class="slide" …>…</div>` element (root styles such as
    //     background/font are part of it), or
    //   - just its inner content (legacy saves).
    // Wrap the legacy case so `slideRoot()` still resolves to a positioned
    // container; when the root element is already present, inject it verbatim
    // so its own styles survive the reload.
    const raw = rewriteMediaUrlsToPreview(html) || "";
    const probe = document.createElement("div");
    probe.innerHTML = raw;
    const rootEl = probe.firstElementChild;
    const wrapped =
      rootEl && rootEl.classList && rootEl.classList.contains("slide")
        ? raw
        : `<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%;overflow:hidden">${raw}</div>`;
    shadowRef.current.innerHTML =
      `<style data-slide-base="1">${BASE_CSS}</style>` + wrapped;
    // Intentionally empty deps so this runs only on mount/remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        display: "block",
      }}
    />
  );
});

export default SlideCanvas;
