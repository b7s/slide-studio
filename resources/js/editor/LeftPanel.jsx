import {useCallback, useEffect, useRef, useState} from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import {Button} from "../Components/ui/button";
import {Input} from "../Components/ui/input";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "../Components/ui/dialog";
import {Tooltip, TooltipContent, TooltipTrigger} from "../Components/ui/tooltip";
import {ChevronDown, ChevronUp, Copy, CopyPlus, Edit3, Files, List, Plus, Trash2} from "lucide-react";
import {useEditor} from "./EditorContext";
import SlideThumb from "./SlideThumb";
import RenameSlideDialog from "./RenameSlideDialog";
import DuplicateSlideDialog from "./DuplicateSlideDialog";
import {__} from "../lib/i18n";
import {cn} from "../Components/lib/utils";

export default function LeftPanel({ slides, selectedFile, onSelect, count }) {
  const { root, selectFile, duplicate, reorder, copyTemplate, createSlide, deleteSlide, renameSlide, permissions } = useEditor();
  const readOnly = !(permissions?.canEdit ?? false);
  const [dupName, setDupName] = useState("");
  const [compact, setCompact] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  // Right-click context-menu state. `ctx` holds the slide under the cursor;
  // `ctxPos` the viewport position (fixed menu coordinates).
  const [ctx, setCtx] = useState(null);
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 });
  const [renameTarget, setRenameTarget] = useState(null);
  const [duplicateTarget, setDuplicateTarget] = useState(null);
  // Drag-and-drop reorder state. The current drag uses native HTML5 DnD; the
  // drops' index/target are mirrored in refs so the synchronous `onDrop`
  // handler reads the latest values without waiting for a re-render.
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const draggedIndexRef = useRef(null);
  const dropTargetRef = useRef(null);
  // Refs to the scrollable viewport (Radix ScrollArea) and the list element.
  const viewportRef = useRef(null);
  const listRef = useRef(null);

  const commitReorder = useCallback(
    (from, target) => {
      const list = [...slides];
      if (from < 0 || from >= list.length) return;
      const insertIndex = target.before ? target.index : target.index + 1;
      if (insertIndex > from) {
        if (insertIndex - 1 === from) return;
      } else if (insertIndex === from) {
        return;
      }
      const [moved] = list.splice(from, 1);
      list.splice(insertIndex, 0, moved);
      const order = {};
      list.forEach((s, i) => {
        order[s.file] = i;
      });
      reorder(order);
      onSelect(moved.file);
    },
    [slides, reorder, onSelect]
  );

  const handleDuplicate = () => {
    const name = dupName.trim();
    if (!name || !selectedFile) return;
    duplicate(selectedFile, name);
    setDupName("");
  };

  const handleCreate = () => {
    createSlide();
  };

  // Sensible default filename for the duplicate dialog: strip the `.html`
  // extension, append the localized copy suffix (e.g. "(cópia)"), and put
  // `.html` back. Kept inline so the dialog can pre-fill without sending
  // the user back to the bottom of the panel.
  const defaultDuplicateFilename = (file) => {
    const suffix = __("messages.slide.copy_suffix") || "(copy)";
    const base = file.replace(/\.html$/i, "");
    return `${base} ${suffix}.html`;
  };

  const move = (direction) => {
    const index = slides.findIndex((s) => s.file === selectedFile);
    if (index < 0) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const order = {};
    next.forEach((s, i) => {
      order[s.file] = i;
    });
    reorder(order);
    selectFile(moved.file);
  };

  const onKeyDown = (e) => {
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      move(e.key === "ArrowUp" ? "up" : "down");
    }
  };

  // Close the right-click context menu on Escape.
  useEffect(() => {
    if (!ctx) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setCtx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ctx]);

  return (
    <div
      className="panel-sidebar flex h-full flex-col overflow-hidden p-4"
      onKeyDown={onKeyDown}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{__("messages.sidebar.title")}</h2>
          <p className="text-[11.5px] font-medium text-[var(--muted-foreground)]">
            {__(`messages.sidebar.count`, { count })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {root !== "templates" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label={__("messages.sidebar.new_slide_tip")} onClick={handleCreate}>
                  <Plus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{__("messages.sidebar.new_slide")}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={__("messages.sidebar.toggle_grid")}
                aria-pressed={compact}
                onClick={() => setCompact((v) => !v)}
              >
                <List />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{__("messages.sidebar.grid_view")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollAreaPrimitive.Root className="relative flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport
          ref={viewportRef}
          className="h-full w-full rounded-[inherit] pr-2"
          onDragOver={(e) => {
            // Attribute the drag to the nearest <li> when the cursor is in
            // the empty padding above the first item or below the last (where
            // there's no <li> to intercept). Without this, the browser stops
            // treating the list as a drop target and the cursor turns into the
            // "no-drop" icon — which is what the user sees as "drag stops".
            e.preventDefault();
            if (!e.dataTransfer) return;
            e.dataTransfer.dropEffect = "move";
            const viewport = viewportRef.current;
            if (!viewport) return;
            // Auto-scroll when the cursor is near the top/bottom edges of the
            // visible viewport (25 px buffer). Each event arrived because the
            // browser is already animating the drag, so a small constant nudge
            // is enough to drift the list in the desired direction.
            const rect = viewport.getBoundingClientRect();
            const buffer = 32;
            if (e.clientY < rect.top + buffer) {
              viewport.scrollTop = Math.max(0, viewport.scrollTop - 16);
            } else if (e.clientY > rect.bottom - buffer) {
              viewport.scrollTop = Math.min(
                viewport.scrollHeight,
                viewport.scrollTop + 16
              );
            }
          }}
        >
          {slides.length === 0 ? (
            <div
              className="grid gap-1 rounded-xl border border-dashed border-[var(--border)] p-4 text-center"
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              }}
            >
              <strong className="text-[var(--foreground)]">{__("messages.sidebar.empty_title")}</strong>
              <span className="text-[11.5px] text-[var(--muted-foreground)]">
                {__("messages.sidebar.empty_hint")}
              </span>
            </div>
          ) : (
            <ul
              ref={listRef}
              className={cn("grid gap-2", compact && "grid-cols-2 gap-1.5")}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              }}
            >
              {slides.map((slide, index) => {
                const active = slide.file === selectedFile;
                const isTemplate = root === "templates";
                const dropHere = dropTarget && dropTarget.index === index;
                const isDragging = draggedIndex === index;
                const isOtherDragging = draggedIndex !== null && !isDragging;
                return (
                  <li
                    key={slide.file}
                    className={cn("group relative transition-opacity", isOtherDragging && "opacity-60", isDragging && "opacity-40")}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(index));
                      draggedIndexRef.current = index;
                      setDraggedIndex(index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const before = e.clientY - rect.top < rect.height / 2;
                      dropTargetRef.current = { index, before };
                      setDropTarget((prev) => (prev?.index === index && prev.before === before ? prev : { index, before }));
                    }}
                    onDragLeave={(e) => {
                      // Ignore "leaves" into a descendant of the same `<li>`
                      // (the inner select button or thumbnail) — those fire
                      // even when the cursor stays over the slide and would
                      // otherwise flicker the indicator off.
                      const next = e.relatedTarget;
                      if (next && e.currentTarget.contains(next)) return;
                      if (dropTargetRef.current?.index === index) {
                        dropTargetRef.current = null;
                        setDropTarget((prev) => (prev?.index === index ? null : prev));
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = draggedIndexRef.current ?? Number(e.dataTransfer.getData("text/plain"));
                      const target = dropTargetRef.current ?? { index, before: true };
                      if (Number.isFinite(from)) commitReorder(from, target);
                      draggedIndexRef.current = null;
                      dropTargetRef.current = null;
                      setDraggedIndex(null);
                      setDropTarget(null);
                    }}
                    onDragEnd={() => {
                      draggedIndexRef.current = null;
                      dropTargetRef.current = null;
                      setDraggedIndex(null);
                      setDropTarget(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtx({ file: slide.file, title: slide.title });
                      setCtxPos({ x: e.clientX, y: e.clientY });
                    }}
                  >
                   {dropHere && dropTarget.before && (
                     <span aria-hidden className="pointer-events-none absolute inset-x-1 top-0 z-10 h-0.5 rounded-full bg-[var(--highlight)] shadow-[var(--highlight-strong)]" />
                   )}
                   {dropHere && !dropTarget.before && (
                     <span aria-hidden className="pointer-events-none absolute inset-x-1 bottom-0 z-10 h-0.5 rounded-full bg-[var(--highlight)] shadow-[var(--highlight-strong)]" />
                   )}
                   <button
                     type="button"
                     draggable={false}
                     onClick={() => onSelect(slide.file)}
                     aria-current={active ? "true" : undefined}
                       className={[
                         "slide-item",
                         compact
                           ? "flex w-full items-center justify-center rounded-md p-1"
                           : "flex w-full items-center gap-3 rounded-xl p-2",
                         active
                           ? "border-[var(--paper)] bg-[var(--paper)]"
                           : "border-[var(--border)] hover:bg-[var(--secondary)]",
                       ].join(" ")}
                     >
                        <span className={cn("relative aspect-video shrink-0 overflow-hidden rounded-md", compact ? "w-full" : "w-24")}>
                          <SlideThumb html={slide.html} className={compact ? "w-full" : "w-24"} />
                         <span className="pointer-events-none absolute left-1 top-1 rounded bg-[var(--navy)]/80 px-1 text-[10px] font-bold text-white">
                           {slide.number}
                         </span>
                       </span>
                      {!compact && (
                      <span className="grid min-w-0 content-center gap-1">
                        <span className="truncate text-[12.5px] font-semibold leading-tight">
                          {slide.title || slide.file}
                        </span>
                        <span className="truncate text-[10.5px] text-[var(--muted-foreground)]">
                          {slide.file}
                        </span>
                      </span>
                      )}
                    </button>
                   <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                     {isTemplate && (
                       <Tooltip>
                         <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label={__("messages.templates.copy_to_deck")}
                              className="bg-[var(--card)]"
                              draggable={false}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyTemplate(slide.file);
                              }}
                            >
                             <CopyPlus />
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>{__("messages.templates.copy_to_deck")}</TooltipContent>
                       </Tooltip>
                     )}
                     <Tooltip>
                       <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            aria-label={__("messages.sidebar.remove_tip")}
                            className="bg-[var(--card)]"
                            draggable={false}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(slide);
                            }}
                          >
                           <Trash2 />
                         </Button>
                       </TooltipTrigger>
                       <TooltipContent>{__("messages.sidebar.remove")}</TooltipContent>
                     </Tooltip>
                   </div>
                   </li>
                 );
               })}
            </ul>
          )}
        </ScrollAreaPrimitive.Viewport>
        <ScrollAreaPrimitive.Scrollbar
          orientation="vertical"
          className="flex w-2 touch-none select-none p-0.5 transition-colors"
        >
          <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--border)]" />
        </ScrollAreaPrimitive.Scrollbar>
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>

      {root !== "templates" && (
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <Input
          placeholder={__("messages.sidebar.duplicate_placeholder")}
          className="h-10"
          value={dupName}
          onChange={(e) => setDupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDuplicate();
          }}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={__("messages.sidebar.duplicate")} onClick={handleDuplicate}>
              <Files />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{__("messages.sidebar.duplicate_tip")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={__("messages.sidebar.move_up")}
              onClick={() => move("up")}
            >
              <ChevronUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{__("messages.sidebar.move_up_tip")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={__("messages.sidebar.move_down")}
              onClick={() => move("down")}
            >
              <ChevronDown />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{__("messages.sidebar.move_down_tip")}</TooltipContent>
        </Tooltip>
      </div>
      )}

      <div className="sr-only">
        <span>{__("messages.sidebar.alt_hint")}</span>
      </div>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{__("messages.sidebar.remove_confirm_title")}</DialogTitle>
            <DialogDescription>
              {pendingDelete ? pendingDelete.title || pendingDelete.file : ""}
              {" — "}
              {__("messages.sidebar.remove_confirm_desc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {__("messages.sidebar.remove_cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const slide = pendingDelete;
                setPendingDelete(null);
                if (slide) deleteSlide(slide.file);
              }}
            >
              {__("messages.sidebar.remove_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RenameSlideDialog
        open={renameTarget !== null}
        initialTitle={renameTarget?.title || renameTarget?.file || ""}
        onClose={() => setRenameTarget(null)}
        onRename={(name) => {
          const target = renameTarget;
          setRenameTarget(null);
          if (target) renameSlide(target.file, name);
        }}
      />

      <DuplicateSlideDialog
        open={duplicateTarget !== null}
        initialFile={duplicateTarget?.defaultFilename || duplicateTarget?.file || ""}
        onClose={() => setDuplicateTarget(null)}
        onDuplicate={(name) => {
          const target = duplicateTarget;
          setDuplicateTarget(null);
          if (target) duplicate(target.file, name);
        }}
      />

      {ctx && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setCtx(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtx(null);
            }}
          />
          <div
            role="menu"
            className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl"
            style={{ left: ctxPos.x, top: ctxPos.y }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--secondary)]"
              onClick={() => {
                setRenameTarget({ file: ctx.file, title: ctx.title });
                setCtx(null);
              }}
            >
              <Edit3 className="size-4 text-[var(--muted-foreground)]" />
              {__("messages.sidebar.rename")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={readOnly}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              onClick={() => {
                setDuplicateTarget({ file: ctx.file, defaultFilename: defaultDuplicateFilename(ctx.file) });
                setCtx(null);
              }}
            >
              <Copy className="size-4 text-[var(--muted-foreground)]" />
              {__("messages.sidebar.duplicate")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={readOnly}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--secondary)] text-[var(--destructive)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              onClick={() => {
                setPendingDelete({ file: ctx.file, title: ctx.title });
                setCtx(null);
              }}
            >
              <Trash2 className="size-4" />
              {__("messages.sidebar.remove")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
