import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { useEditor } from "./EditorContext";
import { slideHtmlUrl } from "../lib/api";
import { __ } from "../lib/i18n";
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
  Pencil,
} from "lucide-react";

const FRAME_W = 1600;
const FRAME_H = 900;

export default function Workspace() {
  const {
    selectedFile,
    dirty,
    statusKey,
    statusTone,
    selectedLabel,
    editMode,
    toggleEditMode,
    onHtmlChange,
    registerEngine,
    onEngineSelection,
    cmd,
    save,
    reload,
  } = useEditor();

  const stageRef = useRef(null);
  const frameRef = useRef(null);
  const engineRef = useRef(null);
  const onHtmlChangeRef = useRef(onHtmlChange);
  const onSelectionRef = useRef(onEngineSelection);
  const editModeRef = useRef(editMode);
  onHtmlChangeRef.current = onHtmlChange;
  onSelectionRef.current = onEngineSelection;
  editModeRef.current = editMode;
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

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    let disposed = false;
    const onLoad = async () => {
      engineRef.current?.destroy();
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      const { createSlideEditor } = await import("./slideEditor");
      if (disposed) return;
      const engine = createSlideEditor({
        doc,
        win,
        onChange: (h) => onHtmlChangeRef.current(h),
        onSelection: (info) => onSelectionRef.current(info),
        onEditingChange: () => {},
      });
      engine.setEditing(editModeRef.current);
      engineRef.current = engine;
      registerEngine(engine);
    };
    frame.addEventListener("load", onLoad);
    return () => {
      disposed = true;
      frame.removeEventListener("load", onLoad);
      engineRef.current?.destroy();
      engineRef.current = null;
      registerEngine(null);
    };
  }, [registerEngine, selectedFile]);

  useEffect(() => {
    engineRef.current?.setEditing(editMode);
  }, [editMode]);

  // Keyboard shortcuts (bound to the parent document; the engine forwards
  // iframe events via bubbling because same-origin frames share focus flow).
  useEffect(() => {
    const onKey = (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) engine.redo();
        else engine.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        engine.redo();
        return;
      }
      if (editModeRef.current) return;
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); engine.copy(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); engine.cut(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); engine.paste(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); engine.remove(); return; }
      if (e.key === "Escape") { engine.clearSelection(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") { e.preventDefault(); engine.nudge(0, -step); }
      else if (e.key === "ArrowDown") { e.preventDefault(); engine.nudge(0, step); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); engine.nudge(-step, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); engine.nudge(step, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.undo")} onClick={cmd.undo} className={toolBtn}>
            <Undo2 />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.redo")} onClick={cmd.redo} className={toolBtn}>
            <Redo2 />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.copy")} onClick={cmd.copy} className={toolBtn}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.cut")} onClick={cmd.cut} className={toolBtn}>
            <Scissors />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.paste")} onClick={cmd.paste} className={toolBtn}>
            <Clipboard />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={__("messages.workspace.delete")}
            onClick={cmd.remove}
            className="text-[var(--red)] hover:bg-[var(--red)]/10"
          >
            <Trash2 />
          </Button>
        </div>
        <span className="pointer-events-auto hidden max-w-[260px] truncate rounded-xl border border-[var(--border)] bg-white/90 px-3 py-2 text-xs text-[var(--muted-foreground)] shadow-lg backdrop-blur sm:inline-block">
          {selectedLabel || __("messages.workspace.select_element")}
        </span>
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-white/90 p-1 shadow-lg backdrop-blur">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={__("messages.workspace.edit_slide")}
            aria-pressed={editMode}
            onClick={toggleEditMode}
            className={editMode ? "text-[var(--gold-strong)] bg-[var(--navy)]/5" : toolBtn}
          >
            <Pencil />
          </Button>
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
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
            src={selectedFile ? slideHtmlUrl(selectedFile) : "about:blank"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--card)]/70 px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
          {statusIcon}
          {__(statusKey)}
        </span>
        <div className="flex items-center gap-2">
          {dirty && <Badge variant="gold">{__("messages.workspace.unsaved")}</Badge>}
          <Button variant="ghost" size="sm" onClick={reload} aria-label={__("messages.topbar.reload")}>
            {__("messages.workspace.reload")}
          </Button>
          <Button variant="save" size="sm" disabled={!dirty} onClick={() => save(false)}>
            <Save />
            {__("messages.workspace.save")}
          </Button>
        </div>
      </div>
    </section>
  );
}
