import {createElement, useCallback, useEffect, useRef, useState} from "react";
import {Button} from "../Components/ui/button";
import {Badge} from "../Components/ui/badge";
import {Tooltip, TooltipContent, TooltipTrigger} from "../Components/ui/tooltip";
import {Popover, PopoverContent, PopoverTrigger} from "../Components/ui/popover";
import {useEditor} from "./EditorContext";
import {__} from "../lib/i18n";
import {cn} from "../Components/lib/utils";
import {touchAsset} from "../lib/api";
import {ICON_CATALOG} from "./icons.config";
import {MediaPickerDialog} from "./MediaPickerDialog";
import SlideCanvas from "./SlideCanvas";
import ContextMenu from "./ContextMenu";
import TextToolbar from "./TextToolbar";
import {
    AlertCircle,
    CheckCircle2,
    Clipboard,
    ClipboardCopy,
    Copy,
    CornerUpLeft,
    CornerUpRight,
    FilesIcon,
    Group as GroupIcon,
    GripVertical,
    ImagePlus,
    Loader2,
    Maximize,
    Minimize2,
    Minus,
    Plus,
    Redo2,
    Save,
    Scissors,
    Shapes,
    Table,
    Trash2,
    Type,
    Undo2,
    Ungroup,
    ZoomIn,
    ZoomOut,
} from "lucide-react";

function IconTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

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
    onHtmlChange,
    registerEngine,
    onEngineSelection,
    cmd,
    save,
    reload,
    permissions,
    slideFullscreen,
    toggleSlideFullscreen,
    presentationId,
    undo: undoStructural,
    redo: redoStructural,
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
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  onHtmlChangeRef.current = onHtmlChange;
  onSelectionRef.current = onEngineSelection;
  editModeRef.current = editMode;
  slideFullscreenRef.current = slideFullscreen;
  toggleSlideFullscreenRef.current = toggleSlideFullscreen;
  const undoRef = useRef(undoStructural);
  const redoRef = useRef(redoStructural);
  undoRef.current = undoStructural;
  redoRef.current = redoStructural;

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y first revert deck-level changes (slide
  // removal, etc.) recorded in the structural history; only when that stack is
  // empty does the canvas engine's own content undo run.
  const runUndo = useCallback(async () => {
    const handled = await undoRef.current();
    if (!handled && engineRef.current?.undo) engineRef.current.undo();
  }, []);
  const runRedo = useCallback(async () => {
    const handled = await redoRef.current();
    if (!handled && engineRef.current?.redo) engineRef.current.redo();
  }, []);
  const [zoom, setZoom] = useState(100);
  const [menu, setMenu] = useState(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [mediaOpen, setMediaOpen] = useState(false);
  // Floating text toolbar: visible while a box is in text-edit mode. `rect` is
  // the selected box's viewport rect (emitted by the engine on enter/move).
  const [textToolbar, setTextToolbar] = useState({ active: false, rect: null });
  const [pan, setPan] = useState({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const readOnly = !(permissions?.canEdit ?? false);

  const onPanStart = useCallback((e) => {
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    setPan({ active: true, startX: e.clientX, startY: e.clientY, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop });
    stage.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  const onPanMove = useCallback((e) => {
    if (!pan.active) return;
    const stage = stageRef.current;
    if (!stage) return;
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    stage.scrollLeft = pan.scrollLeft - dx;
    stage.scrollTop = pan.scrollTop - dy;
  }, [pan.active, pan.startX, pan.startY, pan.scrollLeft, pan.scrollTop]);

  const onPanEnd = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.style.cursor = "";
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    setPan({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  }, []);

  useEffect(() => {
    if (pan.active) {
      window.addEventListener("pointermove", onPanMove);
      window.addEventListener("pointerup", onPanEnd);
      return () => {
        window.removeEventListener("pointermove", onPanMove);
        window.removeEventListener("pointerup", onPanEnd);
      };
    }
  }, [pan.active, onPanMove, onPanEnd]);

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
        stage: stageRef.current,
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
      // Undo/redo: structural history first, then canvas content undo.
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) runRedo();
        else runUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        runRedo();
        return;
      }
      // F2 toggles text-edit mode on the selected box (PowerPoint-style).
      if (e.key === "F2") {
        e.preventDefault();
        if (engine.isTextEditing()) engine.exitTextEdit();
        else engine.beginTextEdit();
        return;
      }
      // Bail only while the user is actively typing text inside an editable
      // region (the box's own text-edit session, an input, or a textarea). A
      // merely *selected* box is contenteditable+focused but not in text-edit
      // mode, so Delete/Backspace must still remove it (and arrows must still
      // nudge it). We therefore check the engine's text-edit flag, not the
      // broader `isEditingText()`, and we must not rely on `isContentEditable`.
      if (engine.isTextEditing() || /^(input|textarea)$/i.test(e.target.tagName)) {
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
      <CheckCircle2 className="icon-inline text-[var(--highlight-strong)]" />
    );

  const handleIconPick = (name) => {
    if (selection?.icon) cmd.setIcon(name);
    else cmd.insertIcon(name);
    setIconOpen(false);
  };

  const handleTableInsert = () => {
    cmd.insertTable(tableRows, tableCols);
    setTableOpen(false);
  };

  const handleMediaPick = (asset) => {
    cmd.insertImageBox(asset);
    setMediaOpen(false);
    if (presentationId) touchAsset(asset.id, presentationId).catch(() => {});
  };

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
      <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-between px-4">
        {/* Pan grip handle */}
        <div
          className="flex items-center px-2 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={onPanStart}
          aria-label={__("messages.workspace.pan_canvas")}
          title={__("messages.workspace.pan_canvas")}
        >
          <GripVertical className="size-4 text-[var(--muted-foreground)]/50 hover:text-[var(--muted-foreground)]" />
        </div>
        <div className="toolbar-group">
          <IconTip label={__("messages.workspace.undo")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.undo")} onClick={runUndo} className="tool-icon">
              <Undo2 />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.redo")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.redo")} onClick={runRedo} className="tool-icon">
              <Redo2 />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <IconTip label={__("messages.workspace.copy")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.copy")} onClick={cmd.copy} disabled={!selection} className="tool-icon">
              <Copy />
            </Button>
          </IconTip>
          <IconTip label={__("messages.workspace.cut")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.cut")} onClick={cmd.cut} disabled={!selection} className="tool-icon">
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
              disabled={!selection}
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
              disabled={!selection}
              className="text-[var(--red)] hover:bg-[var(--red)]/10"
            >
              <Trash2 />
            </Button>
          </IconTip>
        </div>
        <div className="toolbar-group" data-type="editor">
          <IconTip label={__("messages.workspace.insert_text")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.insert_text")} onClick={cmd.insertText} disabled={readOnly} className="tool-icon">
              <Type />
            </Button>
          </IconTip>
          <span className="sep-v" />
          <Popover open={iconOpen} onOpenChange={setIconOpen}>
            <IconTip label={__("messages.workspace.insert_icon")}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.insert_icon")} disabled={readOnly} className="tool-icon">
                  <Shapes />
                </Button>
              </PopoverTrigger>
            </IconTip>
            <PopoverContent className="w-64 max-h-72 overflow-auto p-2" align="end" side="bottom">
              <div className="grid grid-cols-6 gap-1.5">
                {Object.keys(ICON_CATALOG).map((name) => {
                  const entry = ICON_CATALOG[name];
                  const segments = entry.entries ?? [{ tag: entry.tag, attrs: entry.attrs }];
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      aria-label={name}
                      onClick={() => handleIconPick(name)}
                      className="grid aspect-square place-items-center rounded-md border border-[var(--border)] bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--navy)]/5"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        {segments.map((seg, i) => {
                          const { key, ...rest } = seg.attrs;
                          void key;
                          return createElement(seg.tag, { key: i, ...rest });
                        })}
                      </svg>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={tableOpen} onOpenChange={setTableOpen}>
            <IconTip label={__("messages.workspace.insert_table")}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.insert_table")} disabled={readOnly} className="tool-icon">
                  <Table />
                </Button>
              </PopoverTrigger>
            </IconTip>
            <PopoverContent className="w-56 space-y-3 p-3" align="end" side="bottom">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">{__("messages.workspace.table_rows")}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" aria-label={__("messages.workspace.table_rows_dec")} disabled={tableRows <= 1} onClick={() => setTableRows((v) => Math.max(1, v - 1))}>
                      <Minus />
                    </Button>
                    <span className="inline-flex min-w-[1.5rem] justify-center text-sm font-semibold tabular-nums">{tableRows}</span>
                    <Button variant="outline" size="icon-sm" aria-label={__("messages.workspace.table_rows_inc")} disabled={tableRows >= 20} onClick={() => setTableRows((v) => Math.min(20, v + 1))}>
                      <Plus />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">{__("messages.workspace.table_cols")}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-sm" aria-label={__("messages.workspace.table_cols_dec")} disabled={tableCols <= 1} onClick={() => setTableCols((v) => Math.max(1, v - 1))}>
                      <Minus />
                    </Button>
                    <span className="inline-flex min-w-[1.5rem] justify-center text-sm font-semibold tabular-nums">{tableCols}</span>
                    <Button variant="outline" size="icon-sm" aria-label={__("messages.workspace.table_cols_inc")} disabled={tableCols >= 20} onClick={() => setTableCols((v) => Math.min(20, v + 1))}>
                      <Plus />
                    </Button>
                  </div>
                </div>
              </div>
              <Button variant="secondary" className="w-full" onClick={handleTableInsert}>
                {__("messages.workspace.table_insert")}
              </Button>
            </PopoverContent>
          </Popover>
          <IconTip label={__("messages.workspace.insert_media")}>
            <Button variant="ghost" size="icon-sm" aria-label={__("messages.workspace.insert_media")} disabled={readOnly} className="tool-icon" onClick={() => setMediaOpen(true)}>
              <ImagePlus />
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
            return (
              <TextToolbar
                style={style}
                selection={selection}
                cmd={cmd}
                side={above ? "top" : "bottom"}
                boundaryRef={stageRef}
              />
            );
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
          {dirty && <Badge variant="highlight">{__("messages.workspace.unsaved")}</Badge>}
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

      <MediaPickerDialog
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onPick={handleMediaPick}
        presentationId={presentationId}
      />
    </section>
  );
}
