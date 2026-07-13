import { useEffect, useRef, useState } from "react";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "../Components/ui/tooltip";
import { useEditor } from "./EditorContext";
import { __ } from "../lib/i18n";
import { cn } from "../Components/lib/utils";

function IconTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
import SlideCanvas from "./SlideCanvas";
import ContextMenu from "./ContextMenu";
import TextToolbar from "./TextToolbar";
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
    Minimize2,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Pencil,
    Type,
    ClipboardCopy,
    CornerUpRight,
    CornerUpLeft,
    Group as GroupIcon,
    Ungroup, FilesIcon,
} from "lucide-react";

const FRAME_W = 1600;
const FRAME_H = 900;

export default function Workspace() {
  const {
    html,
    selectedFile,
    slideKey,
    dirty,
    statusKey,
    statusTone,
    selectedLabel,
    selection,
    editMode,
    toggleEditMode,
    onHtmlChange,
    registerEngine,
    onEngineSelection,
    cmd,
    save,
    reload,
    permissions,
    slideFullscreen,
    toggleSlideFullscreen,
  } = useEditor();

  const stageRef = useRef(null);
  const slideRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const onHtmlChangeRef = useRef(onHtmlChange);
  const onSelectionRef = useRef(onEngineSelection);
  const editModeRef = useRef(editMode);
  const slideFullscreenRef = useRef(slideFullscreen);
  const toggleSlideFullscreenRef = useRef(toggleSlideFullscreen);
  onHtmlChangeRef.current = onHtmlChange;
  onSelectionRef.current = onEngineSelection;
  editModeRef.current = editMode;
  slideFullscreenRef.current = slideFullscreen;
  toggleSlideFullscreenRef.current = toggleSlideFullscreen;
  const [zoom, setZoom] = useState(100);
  const [menu, setMenu] = useState(null);
  // Floating text toolbar: visible while a box is in text-edit mode. `rect` is
  // the selected box's viewport rect (emitted by the engine on enter/move).
  const [textToolbar, setTextToolbar] = useState({ active: false, rect: null });

  const readOnly = !(permissions?.canEdit ?? false);

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

  // Center the scroll on the slide whenever a new slide loads, so the user
  // lands looking at the middle of the canvas rather than the top-left.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const timer = setTimeout(() => {
      stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    }, 0);
    return () => clearTimeout(timer);
  }, [slideKey]);

  // (Re)build the engine whenever the slide HTML is replaced (new file).
  // We key on `slideKey` (EditorContext.loadNonce, bumped on every fresh
  // load) — not on `selectedFile` (which can be set before the HTML arrives)
  // and not on the live `html` string (which changes on every keystroke).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.shadow) return undefined;
    let disposed = false;
    let engine = null;

    (async () => {
      const shadow = canvas.shadow;
      if (disposed) return;
      const { createSlideEditor } = await import("./slideEditor");
      if (disposed) return;
      engine = createSlideEditor({
        root: shadow,
        onChange: (h) => onHtmlChangeRef.current(h),
        onSelection: (info) => onSelectionRef.current(info),
        onEditingChange: () => {},
        onTextEditingChange: (active, rect) => setTextToolbar({ active, rect }),
        onContextMenu: (x, y, hasSelection) => {
          setMenu({ x, y, hasSelection });
        },
      });
      engine.setEditing(editModeRef.current);
      engineRef.current = engine;
      registerEngine(engine);
    })();

    return () => {
      disposed = true;
      engine?.destroy();
      engineRef.current = null;
      registerEngine(null);
    };
  }, [registerEngine, slideKey]);

  useEffect(() => {
    engineRef.current?.setEditing(editMode);
  }, [editMode]);

  // Keyboard shortcuts (same-document events now — no iframe focus bridging needed).
  useEffect(() => {
    const onKey = (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const mod = e.ctrlKey || e.metaKey;
      // Undo/redo always work even when editing text
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
      // F2 toggles text-edit mode on the selected box (PowerPoint-style).
      if (e.key === "F2") {
        e.preventDefault();
        if (engine.isTextEditing()) engine.exitTextEdit();
        else engine.beginTextEdit();
        return;
      }
      // Bail if the user is typing inside an editable element (contenteditable,
      // input, textarea). The browser handles native keys there.
      if (engine.isEditingText() || /^(input|textarea)$/i.test(e.target.tagName) || e.target.isContentEditable) {
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        engine.duplicate();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); engine.copy(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); engine.cut(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); engine.paste(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); engine.remove(); return; }
      if (e.key === "Escape") { if (slideFullscreenRef.current) toggleSlideFullscreenRef.current(); else engine.clearSelection(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") { e.preventDefault(); engine.nudge(0, -step); }
      else if (e.key === "ArrowDown") { e.preventDefault(); engine.nudge(0, step); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); engine.nudge(-step, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); engine.nudge(step, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the floating text toolbar glued to its box while the stage scrolls or
  // the window resizes (the engine only re-emits the rect on box movement).
  useEffect(() => {
    if (!textToolbar.active) return undefined;
    const stage = stageRef.current;
    const reposition = () => {
      const el = engineRef.current?.getSelected();
      if (el) setTextToolbar((t) => ({ ...t, rect: el.getBoundingClientRect() }));
    };
    stage?.addEventListener("scroll", reposition);
    window.addEventListener("resize", reposition);
    return () => {
      stage?.removeEventListener("scroll", reposition);
      window.removeEventListener("resize", reposition);
    };
  }, [textToolbar.active]);

  const statusIcon =
    statusTone === "error" ? (
      <AlertCircle className="icon-inline text-[var(--red)]" />
    ) : statusTone === "loading" ? (
      <Loader2 className="icon-inline animate-spin text-[var(--navy-2)]" />
    ) : statusTone === "success" ? (
      <CheckCircle2 className="icon-inline text-[var(--success)]" />
    ) : (
      <CheckCircle2 className="icon-inline text-[var(--gold-strong)]" />
    );

  const contextItems = menu && menu.hasSelection ? [
    { icon: <ClipboardCopy className="size-3.5" />, label: __("messages.context_menu.duplicate"), onClick: cmd.duplicate },
    { separator: true },
    { icon: <Copy className="size-3.5" />, label: __("messages.context_menu.copy"), onClick: cmd.copy },
    { icon: <Scissors className="size-3.5" />, label: __("messages.context_menu.cut"), onClick: cmd.cut },
    { icon: <Clipboard className="size-3.5" />, label: __("messages.context_menu.paste"), onClick: cmd.paste },
    { separator: true },
    { icon: <CornerUpRight className="size-3.5" />, label: __("messages.context_menu.bring_forward"), onClick: cmd.bringForward },
    { icon: <CornerUpLeft className="size-3.5" />, label: __("messages.context_menu.send_backward"), onClick: cmd.sendBackward },
    { icon: <GroupIcon className="size-3.5" />, label: __("messages.context_menu.group"), onClick: cmd.group },
    { icon: <Ungroup className="size-3.5" />, label: __("messages.context_menu.ungroup"), onClick: cmd.ungroup },
    { separator: true },
    { icon: <Trash2 className="size-3.5" />, label: __("messages.context_menu.delete"), onClick: cmd.remove, danger: true },
  ] : [
    { icon: <Clipboard className="size-3.5" />, label: __("messages.context_menu.paste"), onClick: cmd.paste },
  ];

  return (
    <section className="panel relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {slideFullscreen && (
        <button onClick={toggleSlideFullscreen} className="absolute right-4 top-4 z-20 flex size-8 items-center justify-center rounded-md bg-[var(--navy)]/80 text-white hover:bg-[var(--navy)]">
          <Minimize2 className="size-4" />
        </button>
      )}
      {!slideFullscreen && (
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex items-center justify-between px-4">
        <div className="toolbar-group">
          <IconTip label={__("messages.workspace.undo")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.undo")} onClick={cmd.undo} className="tool-icon">
              <Undo2 />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.redo")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.redo")} onClick={cmd.redo} className="tool-icon">
              <Redo2 />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <IconTip label={__("messages.workspace.copy")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.copy")} onClick={cmd.copy} className="tool-icon">
              <Copy />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.cut")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.cut")} onClick={cmd.cut} className="tool-icon">
              <Scissors />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.paste")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.paste")} onClick={cmd.paste} className="tool-icon">
              <Clipboard />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <IconTip label={__("messages.context_menu.duplicate")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={__("messages.context_menu.duplicate")}
              onClick={cmd.duplicate}
              className="tool-icon"
            >
              <FilesIcon />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.delete")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={__("messages.workspace.delete")}
              onClick={cmd.remove}
              className="text-[var(--red)] hover:bg-[var(--red)]/10"
            >
              <Trash2 />
            </Button>
          </IconTip>
        </div>
        <div className="toolbar-group" data-type="editor">
          <IconTip label={__("messages.workspace.edit_slide")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={__("messages.workspace.edit_slide")}
              aria-pressed={editMode}
              onClick={toggleEditMode}
              disabled={readOnly}
              className={editMode ? "text-[var(--gold-strong)] bg-[var(--navy)]/5" : "tool-icon"}
            >
              <Pencil />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.insert_text")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.insert_text")} onClick={cmd.insertText} disabled={readOnly} className="tool-icon">
              <Type />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <IconTip label={__("messages.workspace.zoom_out")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.zoom_out")} onClick={() => setZoom((z) => Math.max(25, z - 10))} className="tool-icon">
              <ZoomOut />
            </Button>
          </IconTip>
          <span className="inline-flex min-w-[46px] justify-center text-xs font-semibold tabular-nums">
            {zoom}%
          </span>
          <IconTip label={__("messages.workspace.zoom_in")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.zoom_in")} onClick={() => setZoom((z) => Math.min(200, z + 10))} className="tool-icon">
              <ZoomIn />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <IconTip label={slideFullscreen ? __("messages.workspace.exit_fullscreen") : __("messages.workspace.fit")}>
            <Button variant="ghost" size="icon-sm" aria-label={slideFullscreen ? __("messages.workspace.exit_fullscreen") : __("messages.workspace.fit")} onClick={toggleSlideFullscreen} className="tool-icon">
              {slideFullscreen ? <Minimize2 /> : <Maximize />}
            </Button>
          </IconTip>
        </div>
      </div>
      )}

      <div
        ref={stageRef}
        data-stage
        className={cn("relative grid flex-1 place-items-center overflow-auto", slideFullscreen ? "bg-[var(--navy)] p-0" : "bg-[radial-gradient(circle,rgba(23,35,45,0.1)_1px,transparent_1.25px)] p-6 pt-24")}
        style={slideFullscreen ? {} : { backgroundSize: "22px 22px" }}
      >
        <div
          ref={slideRef}
          className={cn("relative bg-[var(--navy)]", slideFullscreen ? "rounded-none" : "rounded-xl")}
          style={{ width: `${FRAME_W}px`, height: `${FRAME_H}px`, transform: `scale(${zoom / 100})`, transformOrigin: "center" }}
        >
          <SlideCanvas
            key={slideKey}
            ref={canvasRef}
            html={html}
            frameWidth={FRAME_W}
            frameHeight={FRAME_H}
            className="rounded-xl overflow-hidden border-1 border-gray-300 shadow-2xl"
          />
        </div>

        {!slideFullscreen &&
          textToolbar.active &&
          (() => {
            if (!textToolbar.rect || !stageRef.current) return null;
            const stage = stageRef.current;
            const sr = stage.getBoundingClientRect();
            const x = textToolbar.rect.left - sr.left + stage.scrollLeft;
            const y = textToolbar.rect.top - sr.top + stage.scrollTop;
            const above = y > 64;
            const style = {
              left: Math.max(8, x),
              top: above ? y - 56 : y + textToolbar.rect.height + 12,
            };
            return <TextToolbar style={style} selection={selection} cmd={cmd} />;
          })()}
      </div>

      {!slideFullscreen && (
      <div className="status-bar">
          <div className="flex min-w-0 flex-1 items-center gap-2">
              <IconTip label={__(statusKey)}>
                  <span className="status-bar__text">{statusIcon}</span>
              </IconTip>
              <span className="sep-v"></span>
              <span className="toolbar-label">
                {selectedLabel || __("messages.workspace.select_element")}
              </span>
          </div>
          <div className="status-bar__actions">
          {dirty && <Badge variant="gold">{__("messages.workspace.unsaved")}</Badge>}
          <Button variant="ghost" size="sm" onClick={reload} aria-label={__("messages.topbar.reload")}>
            {__("messages.workspace.reload")}
          </Button>
          <Button variant="save" size="sm" title={__("messages.topbar.save_changes")} disabled={!dirty || readOnly} onClick={() => save(false)}>
            <Save />
            {__("messages.workspace.save")}
          </Button>
        </div>
      </div>
      )}

      <ContextMenu
        position={menu}
        items={contextItems}
        onClose={() => setMenu(null)}
      />
    </section>
  );
}
