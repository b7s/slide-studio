import {forwardRef, useEffect, useImperativeHandle, useRef} from "react";
import {rewriteMediaUrlsToPreview} from "../lib/mediaUrl";

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
  const BASE_CSS = `.slide{color:#e8e8e8;font-family:system-ui,-apple-system,sans-serif}
ul,ol{margin:0;padding-left:1.4em}
li{margin:0}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: "open" });
    }
    // Always wrap the slide content in a real `.slide` root. This guarantees
    // `slideRoot()` (in slideEditor.js) resolves to a positioned container and
    // never to the injected <style> base element — otherwise inserted text
    // boxes get appended *inside* the <style> and never render. The wrapper is
    // 100% of the host (the 1600x900 frame) so absolutely-positioned slide
    // elements size/position against it.
    shadowRef.current.innerHTML =
      `<style data-slide-base="1">${BASE_CSS}</style>` +
      `<div class="slide" data-slide-root="1" style="position:relative;width:100%;height:100%;overflow:hidden">${rewriteMediaUrlsToPreview(html) || ""}</div>`;
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
