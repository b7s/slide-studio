import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { rewriteMediaUrlsToPreview } from "../lib/mediaUrl";
import { BASE_CSS } from "../lib/slideStyle";

// Faithful, isolated slide preview for the left-panel list. Each thumbnail
// renders the slide HTML inside its own open Shadow DOM (so any <style>/<script>
// in a slide cannot leak into the editor chrome) and scales the 1600x900 stage
// down to the thumbnail width with a transform — compositor-friendly, so a deck
// of previews stays cheap. Memoised so it only re-renders when its HTML or
// measured width actually changes.
const FRAME_W = 1600;
const FRAME_H = 900;

const THUMB_CSS = `${BASE_CSS}
.slide *{cursor:default!important;pointer-events:none!important;user-select:none!important}`;

function SlideThumb({ html, className = "" }) {
  const hostRef = useRef(null);
  const shadowRef = useRef(null);
  const [width, setWidth] = useState(0);

  // Measure the rendered width (before paint, to avoid a blank flash) so the
  // scale factor tracks the responsive thumbnail size.
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: "open" });
    }
    const scale = width > 0 ? width / FRAME_W : 0;
    shadowRef.current.innerHTML =
      `<style data-slide-base="1">${THUMB_CSS}</style>` +
      `<div class="slide" data-slide-root="1" style="position:absolute;top:0;left:0;width:${FRAME_W}px;height:${FRAME_H}px;overflow:hidden;transform:scale(${scale});transform-origin:top left">${rewriteMediaUrlsToPreview(html || "")}</div>`;
  }, [html, width]);

  return (
    <div
      ref={hostRef}
      className={`relative aspect-video overflow-hidden ${className || "w-full"}`}
    />
  );
}

export default memo(SlideThumb);
