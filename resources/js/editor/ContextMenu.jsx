import { useEffect, useRef } from "react";

/**
 * Lightweight positioned context menu rendered in the parent document (React
 * portal-ish: appended to document.body). No Radix dependency — controlled by
 * parent state. Closes on outside click or Escape.
 */
export default function ContextMenu({ position, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onAway, true);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onAway, true);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  if (!position) return null;

  let { x, y } = position;
  const maxW = 230;
  const pad = 12;
  if (x + maxW + pad > window.innerWidth) x = window.innerWidth - maxW - pad;
  if (y + pad + 8 > window.innerHeight && y - 12 - (items.length * 36) > 0) y -= items.length * 36;

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className="fixed z-[2147483647] min-w-[180px] max-w-[230px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 text-sm outline-none"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => item.separator ? (
        <div key={i} className="my-1 h-px bg-[var(--border)]" />
      ) : (
        <button
          key={i}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
          className={[
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
            item.disabled
              ? "cursor-default text-[var(--muted-foreground)]"
              : item.danger
                ? "text-[var(--red)] hover:bg-[var(--red)]/10"
                : "text-[var(--foreground)] hover:bg-[var(--secondary)]",
          ].join(" ")}
        >
          {item.icon && <span className="grid size-4 shrink-0 place-items-center">{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
