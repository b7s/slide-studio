import {useState} from "react";
import {Bold, Italic, List, ListOrdered, Palette, Trash2} from "lucide-react";
import {Button} from "../Components/ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "../Components/ui/tooltip";
import {Popover, PopoverContent, PopoverTrigger} from "../Components/ui/popover";
import {__} from "../lib/i18n";
import {cn} from "../Components/lib/utils";
import {toHex} from "../lib/color";

function IconTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// A few brand-aligned swatches plus a free native color input.
const QUICK_COLORS = ["#ffffff", "#111111", "#e11d48", "#f59e0b", "#22c55e", "#3b82f6"];

// Options mirror the Inspector's list styles. `null` clears the list.
const LIST_OPTIONS = [
  { k: null, label: __("messages.editor.text_toolbar.list_none") },
  { k: "disc", label: __("messages.inspector.list_disc") },
  { k: "circle", label: __("messages.inspector.list_circle") },
  { k: "square", label: __("messages.inspector.list_square") },
  { k: "ordered", label: __("messages.inspector.list_ordered") },
];

export default function TextToolbar({ style, selection, cmd, side = "top", boundaryRef = null }) {
  const [colorOpen, setColorOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const pd = (e) => e.preventDefault();

  const currentColor = toHex(selection?.styles?.color || "");
  const currentList = (() => {
    if (!selection?.list) return null;
    if (selection.list.tag === "ol") return "ordered";
    const t = selection.list.style || "disc";
    return t === "circle" ? "circle" : t === "square" ? "square" : "disc";
  })();

  const handleColor = (c) => {
    cmd.restoreSelection();
    cmd.setTextColor(c);
    setColorOpen(false);
  };

  const handleList = (k) => {
    cmd.restoreSelection();
    cmd.applyList(k);
    setListOpen(false);
  };

  return (
    <div className="toolbar-group absolute z-30" style={style} data-text-toolbar>
      <IconTip label={__("messages.inspector.bold")}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={__("messages.inspector.bold")}
          className="tool-icon"
          onMouseDown={pd}
          onClick={() => cmd.applyTextCommand("bold")}
        >
          <Bold />
        </Button>
      </IconTip>
      <IconTip label={__("messages.inspector.italic")}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={__("messages.inspector.italic")}
          className="tool-icon"
          onMouseDown={pd}
          onClick={() => cmd.applyTextCommand("italic")}
        >
          <Italic />
        </Button>
      </IconTip>

      <span className="sep-v" />

      <Popover open={listOpen} onOpenChange={setListOpen}>
        <IconTip label={__("messages.editor.text_toolbar.list")}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={__("messages.editor.text_toolbar.list")}
              className={cn("tool-icon", currentList && "text-[var(--highlight-strong)]")}
              onMouseDown={(e) => {
                pd(e);
                cmd.saveSelection();
              }}
            >
              {currentList === "ordered" ? <ListOrdered /> : <List />}
            </Button>
          </PopoverTrigger>
        </IconTip>
        <PopoverContent
          className="w-44 p-1"
          align="center"
          side={side}
          collisionBoundary={boundaryRef?.current ?? undefined}
          collisionPadding={8}
          data-text-toolbar
        >
          {LIST_OPTIONS.map((opt) => (
            <button
              key={String(opt.k)}
              type="button"
              onMouseDown={pd}
              onClick={() => handleList(opt.k)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--navy)]/5",
                currentList === opt.k && "bg-[var(--navy)]/10 text-[var(--navy)]"
              )}
            >
              <span className="w-4 text-center">
                {opt.k === "ordered" ? <ListOrdered className="size-4" /> : opt.k ? <List className="size-4" /> : "—"}
              </span>
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <span className="sep-v" />

      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={__("messages.editor.text_toolbar.text_color")}
            className="tool-icon relative"
            onMouseDown={(e) => {
              pd(e);
              cmd.saveSelection();
            }}
          >
            <Palette />
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-full border border-white"
              style={{ background: currentColor }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-44 p-2"
          align="center"
          side={side}
          collisionBoundary={boundaryRef?.current ?? undefined}
          collisionPadding={8}
          data-text-toolbar
        >
          <div className="grid grid-cols-6 gap-1.5">
            {QUICK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onMouseDown={pd}
                onClick={() => handleColor(c)}
                className="h-6 w-6 rounded-md border border-[var(--border)]"
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="color"
              value={currentColor}
              onMouseDown={pd}
              onChange={(e) => handleColor(e.target.value)}
              className="h-6 w-6 rounded border-0 bg-transparent p-0"
            />
            {__("messages.editor.text_toolbar.text_color")}
          </label>
        </PopoverContent>
      </Popover>

      <span className="sep-v" />

      <IconTip label={__("messages.editor.text_toolbar.delete_box")}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={__("messages.editor.text_toolbar.delete_box")}
          className="tool-icon text-[var(--red)] hover:bg-[var(--red)]/10"
          onMouseDown={pd}
          onClick={() => cmd.remove()}
        >
          <Trash2 />
        </Button>
      </IconTip>
    </div>
  );
}
