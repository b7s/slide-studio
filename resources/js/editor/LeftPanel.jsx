import { Badge } from "../Components/ui/badge";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { ScrollArea } from "../Components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "../Components/ui/tooltip";
import { List, Files } from "lucide-react";
import { __ } from "../lib/i18n";

export default function LeftPanel({ slides, selectedFile, onSelect, count }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{__("messages.sidebar.title")}</h2>
          <p className="text-[11.5px] font-medium text-[var(--muted-foreground)]">
            {__(`messages.sidebar.count`, { count })}
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={__("messages.sidebar.toggle_grid")}>
              <List />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{__("messages.sidebar.grid_view")}</TooltipContent>
        </Tooltip>
      </div>

      <ScrollArea className="flex-1 -mr-2 pr-2">
        {slides.length === 0 ? (
          <div className="grid gap-1 rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
            <strong className="text-[var(--foreground)]">{__("messages.sidebar.empty_title")}</strong>
            <span className="text-[11.5px] text-[var(--muted-foreground)]">
              {__("messages.sidebar.empty_hint")}
            </span>
          </div>
        ) : (
          <ul className="grid gap-2">
            {slides.map((slide) => {
              const active = slide.file === selectedFile;
              return (
                <li key={slide.file}>
                  <button
                    type="button"
                    onClick={() => onSelect(slide.file)}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "flex w-full items-stretch gap-3 rounded-xl border p-2 text-left transition",
                      active
                        ? "border-[var(--gold)] bg-[var(--accent)] shadow-[0_0_0_1px_var(--gold)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:bg-white hover:shadow-sm",
                    ].join(" ")}
                  >
                    <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-[var(--navy)] shadow-sm">
                      <span className="absolute left-1 top-1 rounded bg-[var(--navy)]/80 px-1 text-[10px] font-bold text-white">
                        {slide.number}
                      </span>
                    </span>
                    <span className="grid min-w-0 content-center gap-1">
                      <span className="truncate text-[12.5px] font-semibold leading-tight">
                        {slide.title || slide.file}
                      </span>
                      <span className="truncate text-[10.5px] text-[var(--muted-foreground)]">
                        {slide.file}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <Input placeholder={__("messages.sidebar.duplicate_placeholder")} className="h-10" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={__("messages.sidebar.duplicate")}>
              <Files />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{__("messages.sidebar.duplicate_tip")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
