import { useState } from "react";
import { EditorPanelsProvider, useEditorPanels } from "./EditorPanelsContext";
import { useEditor } from "./EditorContext";
import { useMediaQuery } from "./useMediaQuery";
import Topbar from "./Topbar";
import LeftPanel from "./LeftPanel";
import Workspace from "./Workspace";
import Inspector from "./Inspector";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../Components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "../Components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../Components/ui/dialog";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Button } from "../Components/ui/button";
import { __ } from "../lib/i18n";

function HelpDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{__("messages.help.title")}</DialogTitle>
          <DialogDescription>
            {__("messages.help.desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <div>
            <p className="mb-1 font-semibold">{__("messages.help.structure_heading")}</p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--secondary)] p-3 text-xs">
              my-presentation/{"\n"}├── 01-capa.html{"\n"}├── 02-agenda.html{"\n"}└── assets/logo.svg
            </pre>
          </div>
          <div>
            <p className="mb-1 font-semibold">{__("messages.help.editing_heading")}</p>
            <p className="text-[var(--muted-foreground)]">
              {__("messages.help.editing_body")}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{__("messages.help.got_it")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PathsPopover({ anchor, open, onOpenChange, deckRoot, templateRoot }) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{anchor}</PopoverTrigger>
      <PopoverContent align="end" className="w-[min(560px,calc(100vw-2rem))]">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{__("messages.paths.deck_label")}</Label>
            <div className="flex gap-2">
              <Input defaultValue={deckRoot} />
              <Button variant="secondary" size="sm">{__("messages.paths.choose")}</Button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{__("messages.paths.templates_label")}</Label>
            <div className="flex gap-2">
              <Input defaultValue={templateRoot} />
              <Button variant="secondary" size="sm">{__("messages.paths.choose")}</Button>
            </div>
          </div>
          <Button className="w-full" onClick={() => onOpenChange(false)}>{__("messages.paths.open")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Shell() {
  const {
    root,
    setRoot,
    slides,
    selectedFile,
    selectFile,
    dirty,
    statusKey,
    statusTone,
    selectedLabel,
    save,
    reload,
    preview,
    deckRoot,
    templateRoot,
  } = useEditor();
  const { sidebarCollapsed, setSidebarCollapsed, inspectorCollapsed, setInspectorCollapsed } =
    useEditorPanels();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");

  const sidebarInline = isLg && !sidebarCollapsed;
  const inspectorInline = isXl && !inspectorCollapsed;

  const [pathsOpen, setPathsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarSheet, setSidebarSheet] = useState(false);
  const [inspectorSheet, setInspectorSheet] = useState(false);

  const gridCols = isXl
    ? inspectorInline
      ? sidebarInline
        ? "lg:grid-cols-[304px_minmax(0,1fr)_352px]"
        : "lg:grid-cols-[0px_minmax(0,1fr)_352px]"
      : sidebarInline
        ? "lg:grid-cols-[304px_minmax(0,1fr)_0px]"
        : "lg:grid-cols-[0px_minmax(0,1fr)_0px]"
    : sidebarInline
      ? "lg:grid-cols-[304px_minmax(0,1fr)]"
      : "lg:grid-cols-[0px_minmax(0,1fr)]";

  return (
    <div className="grid h-[100dvh] w-screen grid-rows-[auto_minmax(0,1fr)] gap-2 bg-[var(--frame)] p-2">
      <Topbar
        root={root}
        setRoot={setRoot}
        deckPath={deckRoot}
        templatePath={templateRoot}
        selectedFile={selectedFile}
        unsaved={dirty}
        sidebarInline={sidebarInline}
        inspectorInline={inspectorInline}
        onToggleSidebar={() => setSidebarCollapsed(true)}
        onToggleInspector={() => setInspectorCollapsed(true)}
        onOpenSidebarSheet={() => setSidebarSheet(true)}
        onOpenInspectorSheet={() => setInspectorSheet(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenPaths={() => setPathsOpen(true)}
        onSave={save}
        onReload={reload}
        onPreview={preview}
      />

      <div className={`grid min-h-0 gap-2 ${gridCols}`}>
        {sidebarInline && (
          <aside className="hidden min-h-0 lg:block">
            <LeftPanel
              slides={slides}
              selectedFile={selectedFile}
              onSelect={selectFile}
              count={slides.length}
            />
          </aside>
        )}

        <main className="relative col-start-1 min-h-0 lg:col-start-auto">
          <Workspace />
        </main>

        {inspectorInline && (
          <aside className="hidden min-h-0 lg:block">
            <Inspector />
          </aside>
        )}
      </div>

      <PathsPopover
        open={pathsOpen}
        onOpenChange={setPathsOpen}
        deckRoot={deckRoot}
        templateRoot={templateRoot}
        anchor={
          <button className="hidden" aria-hidden tabIndex={-1} />
        }
      />

      <Sheet open={sidebarSheet} onOpenChange={setSidebarSheet}>
        <SheetContent side="left" className="w-[88%] max-w-sm p-0">
          <SheetHeader>
            <SheetTitle>{__("messages.sidebar.title")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 p-4 pt-0">
            <LeftPanel
              slides={slides}
              selectedFile={selectedFile}
              onSelect={(f) => {
                selectFile(f);
                setSidebarSheet(false);
              }}
              count={slides.length}
            />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={inspectorSheet} onOpenChange={setInspectorSheet}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{__("messages.inspector.tab_props")}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 p-4 pt-0">
            <Inspector />
          </div>
        </SheetContent>
      </Sheet>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

export default function AppShell() {
  return (
    <EditorPanelsProvider>
      <Shell />
    </EditorPanelsProvider>
  );
}
