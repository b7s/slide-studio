import { useEffect, useRef, useState } from "react";

const FRAME_W = 1600;
const FRAME_H = 900;

export default function PresentationCover({ html }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const ro = new ResizeObserver(() => {
      const width = el.clientWidth;
      setScale(Math.max(0.05, Math.min(1, width / FRAME_W)));
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-[var(--navy)]"
    >
      <iframe
        title="cover"
        srcDoc={html || ""}
        style={{
          width: `${FRAME_W}px`,
          height: `${FRAME_H}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          border: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
