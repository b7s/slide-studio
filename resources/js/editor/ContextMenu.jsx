import { useEffect, useRef } from "react";

/**
 * Lightweight positioned context menu rendered in the parent document (appended
 * to document.body). No Radix dependency — controlled by parent state. Closes on
 * outside click or Escape. Shared by the slide canvas and the left-panel slides
 * so right-click menus look and behave identically across the app.
 *
 * Items shape: { label, icon?, onClick?, danger?, disabled?, separator? }
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
  if (y + pad + 8 > window.innerHeight && y - 12 - (items.length * 34) > 0) y -= items.length * 34;

  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      className="fixed z-[2147483647] min-w-[180px] max-w-[230px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-sm shadow-[0_12px_34px_-10px_rgba(23,35,45,0.35)] outline-none ring-1 ring-black/[0.04]"
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
            "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors duration-150",
            item.disabled
              ? "cursor-default text-[var(--muted-foreground)]"
              : item.danger
                ? "text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                : "text-[var(--foreground)] hover:bg-[var(--secondary)]",
          ].join(" ")}
        >
          {item.icon && (
            <span className={[
              "grid size-4 shrink-0 place-items-center transition-colors",
              item.danger ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)] group-hover:text-[var(--highlight)]",
            ].join(" ")}>
              {item.icon}
            </span>
          )}
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
