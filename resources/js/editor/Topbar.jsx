import { useState } from "react";
import { Button } from "../Components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Badge } from "../Components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "../Components/ui/tooltip";
import {
  PanelLeft,
  FolderOpen,
  HelpCircle,
  Eye,
  RotateCw,
  Code2,
  ArrowDownToLine,
  SlidersHorizontal,
} from "lucide-react";
import { useEditorPanels } from "./EditorPanelsContext";
import { __ } from "../lib/i18n";

function IconTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function Topbar({
  root,
  setRoot,
  deckPath,
  templatePath,
  selectedFile,
  unsaved,
  sidebarInline,
  inspectorInline,
  onToggleSidebar,
  onToggleInspector,
  onOpenSidebarSheet,
  onOpenInspectorSheet,
  onOpenHelp,
  onOpenPaths,
}) {
  return (
    <header className="z-30 col-span-full flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-[0_1px_2px_rgba(23,35,45,0.05),0_18px_42px_-34px_rgba(23,35,45,0.32)] sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {!sidebarInline && (
          <IconTip label={__("messages.topbar.slides_panel_tip")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_slides")} onClick={onOpenSidebarSheet}>
              <PanelLeft />
            </Button>
          </IconTip>
        )}
        {sidebarInline && (
          <IconTip label={onToggleSidebar ? __("messages.topbar.hide_slides") : __("messages.topbar.slides")}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={__("messages.topbar.hide_slides")}
              aria-pressed={false}
              onClick={onToggleSidebar}
            >
              <PanelLeft />
            </Button>
          </IconTip>
        )}
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-[#16283a] to-[#0a141d] shadow-md">
            <span className="text-sm font-bold text-white">G4</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight">{__("messages.app.name")}</h1>
            <p className="truncate text-[11px] font-medium text-[var(--muted-foreground)]">
              {selectedFile || deckPath || __("messages.topbar.loading_presentation")}
            </p>
          </div>
          <Badge>{__("messages.topbar.local_badge")}</Badge>
        </div>
      </div>

      <div className="order-last w-full sm:order-none sm:w-auto">
        <Tabs value={root} onValueChange={setRoot}>
          <TabsList>
            <TabsTrigger value="deck">{__("messages.root.deck")}</TabsTrigger>
            <TabsTrigger value="templates">{__("messages.root.templates")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-1.5">
        <IconTip label={__("messages.topbar.folders")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.topbar.folders")} onClick={onOpenPaths}>
            <FolderOpen />
          </Button>
        </IconTip>
        <IconTip label={__("messages.topbar.help")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.topbar.help")} onClick={onOpenHelp}>
            <HelpCircle />
          </Button>
        </IconTip>
        <IconTip label={__("messages.topbar.preview")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.topbar.preview")}>
            <Eye />
          </Button>
        </IconTip>
        <IconTip label={__("messages.topbar.reload")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.topbar.reload")}>
            <RotateCw />
          </Button>
        </IconTip>
        <IconTip label={__("messages.topbar.save_html")}>
          <Button variant="save" disabled={!unsaved} className="gap-1.5">
            <Code2 className="hidden sm:block" />
            <span className="hidden sm:inline">{__("messages.topbar.save_changes")}</span>
            <ArrowDownToLine className="sm:hidden" />
          </Button>
        </IconTip>
        {!inspectorInline && (
          <IconTip label={__("messages.topbar.props")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_props")} onClick={onOpenInspectorSheet}>
              <SlidersHorizontal />
            </Button>
          </IconTip>
        )}
        {inspectorInline && (
          <IconTip label={__("messages.topbar.hide_props")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.hide_props")} onClick={onToggleInspector}>
              <SlidersHorizontal />
            </Button>
          </IconTip>
        )}
      </div>
    </header>
  );
}
