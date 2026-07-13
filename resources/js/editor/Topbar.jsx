import { useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { Button } from "../Components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../Components/ui/tabs";
import { Badge } from "../Components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "../Components/ui/tooltip";
import { GenerateDialog } from "./GenerateDialog";
import { ShareDialog } from "./ShareDialog";
import {
    PanelLeft,
    FolderOpen,
    HelpCircle,
    Eye,
    RotateCw,
    Code2,
    ArrowDownToLine,
    SlidersHorizontal,
    Sparkles,
    Share2,
    Library, PanelRight,
} from "lucide-react";
import { useEditorPanels } from "./EditorPanelsContext";
import { useEditor } from "./EditorContext";
import { __ } from "../lib/i18n";
import { route } from "../lib/routes";
import { cn } from "../Components/lib/utils";

function IconTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function Topbar({
  className,
  root,
  setRoot,
  deckPath,
  templatePath,
  selectedFile,
  unsaved,
  sidebarInline,
  inspectorInline,
  sidebarCanInline,
  inspectorCanInline,
  onToggleSidebar,
  onToggleInspector,
  onOpenSidebarSheet,
  onOpenInspectorSheet,
  onOpenHelp,
  onOpenPaths,
  onSave,
  onReload,
  onPreview,
}) {
  const { dirty, save, reload, preview, generate, presentationSlug, permissions } = useEditor();
  const effectiveDirty = unsaved ?? dirty;
  const [generateOpen, setGenerateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const canShare = permissions?.canShare ?? false;
  const readOnly = !(permissions?.canEdit ?? false);

  return (
    <header className={cn("z-30 col-span-full flex flex-wrap items-center justify-between gap-2 panel p-2.5 sm:px-4", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {!sidebarInline && sidebarCanInline && (
          <IconTip label={__("messages.topbar.open_slides")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_slides")} aria-pressed={false} onClick={onToggleSidebar}>
              <PanelLeft />
            </Button>
          </IconTip>
        )}
        {!sidebarInline && !sidebarCanInline && (
          <IconTip label={__("messages.topbar.slides_panel_tip")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_slides")} onClick={onOpenSidebarSheet}>
              <PanelLeft />
            </Button>
          </IconTip>
        )}
        {sidebarInline && (
          <IconTip label={__("messages.topbar.hide_slides")}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={__("messages.topbar.hide_slides")}
              aria-pressed={true}
              onClick={onToggleSidebar}
            >
              <PanelLeft />
            </Button>
          </IconTip>
        )}
        <div className="flex items-center gap-3">
          <div className="brand-icon size-9">
            <span className="text-sm font-bold text-white">{app.short}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight">{app.name}</h1>
            <p className="truncate text-[11px] font-medium text-[var(--muted-foreground)]">
              {selectedFile || deckPath || __("messages.topbar.loading_presentation")}
            </p>
          </div>
          <Badge>{__("messages.topbar.local_badge")}</Badge>
          <IconTip label={__("messages.library.title")}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={__("messages.library.title")}
              onClick={() => router.visit(route("library"))}
            >
              <Library />
            </Button>
          </IconTip>
          {readOnly && (
            <Badge variant="danger">
              {__("messages.sharing.readonly_mode")}
            </Badge>
          )}
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
        <IconTip label={__("messages.ai.generate")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.ai.generate")} onClick={() => setGenerateOpen(true)} disabled={!permissions?.canEdit}>
            <Sparkles />
          </Button>
        </IconTip>
        <IconTip label={__("messages.sharing.title")}>
          <Button variant="ghost" size="icon" aria-label={__("messages.sharing.title")} onClick={() => setShareOpen(true)}>
            <Share2 />
          </Button>
        </IconTip>
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
          <Button variant="ghost" size="icon" aria-label={__("messages.topbar.preview")} onClick={onPreview ?? preview}>
            <Eye />
          </Button>
        </IconTip>
        {!inspectorInline && inspectorCanInline && (
          <IconTip label={__("messages.topbar.open_props")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_props")} aria-pressed={false} onClick={onToggleInspector}>
              <PanelRight />
            </Button>
          </IconTip>
        )}
        {!inspectorInline && !inspectorCanInline && (
          <IconTip label={__("messages.topbar.props")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.open_props")} onClick={onOpenInspectorSheet}>
              <PanelRight />
            </Button>
          </IconTip>
        )}
        {inspectorInline && (
          <IconTip label={__("messages.topbar.hide_props")}>
            <Button variant="ghost" size="icon" aria-label={__("messages.topbar.hide_props")} aria-pressed={true} onClick={onToggleInspector}>
              <PanelRight />
            </Button>
          </IconTip>
        )}
        <UserMenu />
      </div>

      <GenerateDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerate={generate}
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        presentationSlug={presentationSlug}
        canShare={canShare}
      />
    </header>
  );
}

function UserMenu() {
  const user = usePage().props.auth?.user;
  const app = usePage().props.app ?? { name: "Slide Studio", short: "SS" };
  const initials = user?.name
    ? user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const handleLogout = (e) => {
    e.preventDefault();
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/logout";
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (csrf) {
      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "_token";
      tokenInput.value = csrf;
      form.appendChild(tokenInput);
    }
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="relative flex items-center gap-2 pl-2 border-l border-[var(--border)] ml-1">
      <div
        className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[color-mix(in_srgb,var(--gold)_60%,white)] text-[10px] font-bold text-white"
        aria-hidden
      >
        {initials}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        aria-label={user?.name ? `${user.name} — ${__("messages.auth.logout")}` : __("messages.auth.logout")}
      >
        <span className="hidden sm:inline">{__("messages.auth.logout")}</span>
        <span className="sm:hidden">⎋</span>
      </Button>
    </div>
  );
}
