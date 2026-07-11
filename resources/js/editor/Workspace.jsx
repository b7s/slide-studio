import { useEffect, useRef, useState } from "react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import {
  Undo2,
  Redo2,
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { __ } from "../lib/i18n";

const FRAME_W = 1600;
const FRAME_H = 900;

export default function Workspace({
  selectedFile,
  selectedLabel,
  dirty,
  status,
  statusTone,
  onSave,
}) {
  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const pad = 64;
      const scale = Math.min(
        (el.clientWidth - pad) / FRAME_W,
        (el.clientHeight - 140) / FRAME_H
      );
      setZoom(Math.max(25, Math.min(200, Math.round(scale * 100))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statusIcon =
    statusTone === "error" ? (
      <AlertCircle className="size-3.5 text-[var(--red)]" />
    ) : statusTone === "loading" ? (
      <Loader2 className="size-3.5 animate-spin text-[var(--navy-2)]" />
    ) : statusTone === "success" ? (
      <CheckCircle2 className="size-3.5 text-[var(--success)]" />
    ) : (
      <CheckCircle2 className="size-3.5 text-[var(--gold-strong)]" />
    );

  const toolBtn =
    "text-[var(--ink-soft)] hover:text-[var(--foreground)] hover:bg-[var(--navy)]/5";

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-white/90 p-1 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.undo")} className={toolBtn}>
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.redo")} className={toolBtn}>
            <Redo2 />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.copy")} className={toolBtn}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.cut")} className={toolBtn}>
            <Scissors />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.paste")} className={toolBtn}>
            <Clipboard />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={__("messages.workspace.delete")}
            className="text-[var(--red)] hover:bg-[var(--red)]/10"
          >
            <Trash2 />
          </Button>
        </div>
        <span className="pointer-events-auto hidden max-w-[260px] truncate rounded-xl border border-[var(--border)] bg-white/90 px-3 py-2 text-xs text-[var(--muted-foreground)] shadow-lg backdrop-blur sm:inline-block">
          {selectedLabel || __("messages.workspace.select_element")}
        </span>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-white/90 p-1 shadow-lg backdrop-blur">
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.zoom_out")} onClick={() => setZoom((z) => Math.max(25, z - 10))} className={toolBtn}>
            <ZoomOut />
          </Button>
          <span className="inline-flex min-w-[46px] justify-center text-xs font-semibold tabular-nums">
            {zoom}%
          </span>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.zoom_in")} onClick={() => setZoom((z) => Math.min(200, z + 10))} className={toolBtn}>
            <ZoomIn />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.fit")} className={toolBtn}>
            <Maximize />
          </Button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative grid flex-1 place-items-center overflow-auto bg-[radial-gradient(circle,rgba(23,35,45,0.1)_1px,transparent_1.25px)] p-6 pt-24"
        style={{ backgroundSize: "22px 22px" }}
      >
        <div
          className="aspect-video w-[1600px] origin-center rounded-xl bg-[var(--navy)] shadow-2xl"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          <iframe
            ref={frameRef}
            title={__("messages.workspace.preview_title")}
            className="size-full rounded-xl border-0"
            sandbox="allow-same-origin allow-scripts"
            src={selectedFile ? `/api/v1/slides/html?file=${encodeURIComponent(selectedFile)}` : "about:blank"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--card)]/70 px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
          {statusIcon}
          {status}
        </span>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="gold">{__("messages.workspace.unsaved")}</Badge>}
          <Button variant="save" size="sm" disabled={!dirty} onClick={onSave}>
            <Save />
            {__("messages.workspace.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
