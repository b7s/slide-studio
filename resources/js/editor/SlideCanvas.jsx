import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: "open" });
    }
    shadowRef.current.innerHTML = html || "";
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
