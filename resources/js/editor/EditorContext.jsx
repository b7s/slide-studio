import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {router} from "@inertiajs/react";
import {route} from "../lib/routes";
import * as api from "../lib/api";
import { toast } from "sonner";
import { __ } from "../lib/i18n";
import { SLIDE_BG, SLIDE_COLOR, SLIDE_FONT } from "../lib/slideStyle";

const EditorContext = createContext(null);

const AUTOSAVE_MS = 5000;
const AUTOSAVE_MAX_MS = 10000;

export function EditorProvider({
  children,
  config = {},
  initialSlides = [],
  presentationId = null,
  presentationSlug = null,
  presentationTitle = null,
  initialFile = null,
  permissions = { role: "viewer", canEdit: false, canShare: false, canDelete: false },
}) {
  const [root, setRoot] = useState("deck");
  const deckRoot = config.deckRoot ?? "";
  const templateRoot = config.templateRoot ?? "";
  const [presentationTitleState, setPresentationTitle] = useState(presentationTitle);
  const [slides, setSlides] = useState(() =>
    initialSlides.map((s) => ({
      file: s.file,
      title: s.title,
      number: String(s.number ?? ""),
      revision: s.revision ?? null,
      source_mode: s.source_mode ?? "deck",
    }))
  );
  const [selectedFile, setSelectedFile] = useState(
    initialFile ?? slides[0]?.file ?? initialSlides[0]?.file ?? null
  );
  const [html, setHtml] = useState("");
  const [loadNonce, setLoadNonce] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [revision, setRevision] = useState(null);
  const [statusKey, setStatusKey] = useState("messages.editor.ready");
  const [statusTone, setStatusTone] = useState("ready");
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [slideFullscreen, setSlideFullscreen] = useState(false);

  const engineRef = useRef(null);
  const presentationIdRef = useRef(presentationId);
  const presentationSlugRef = useRef(presentationSlug);
  const autosaveTimer = useRef(null);
  const selectedFileRef = useRef(selectedFile);
  const htmlRef = useRef(html);
  const revisionRef = useRef(revision);
  const savedSnapshotRef = useRef(savedSnapshot);
  // Save serialization: only one save request may be in flight at a time. If
  // another save is requested while one is running we remember it and re-run
  // afterwards with the *latest* snapshot. This is what prevents an older,
  // slower request from committing after a newer one and reverting content
  // (the "content disappears" bug — visible as html_length jumping downward).
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  // Timestamp of the first edit in the current dirty streak, so the debounced
  // autosave is capped by AUTOSAVE_MAX_MS instead of resetting on every key.
  const dirtySinceRef = useRef(null);

  selectedFileRef.current = selectedFile;
  htmlRef.current = html;
  revisionRef.current = revision;
  savedSnapshotRef.current = savedSnapshot;
  // Sync the cross-action refs when the parent swaps the presentation (e.g.
  // navigating from one `/presentations/<slug>` to another inside the same SPA
  // session). Even though `<EditorProvider key={presentationId}>` already
  // forces a remount, defensive syncing protects against subtle ordering bugs
  // and future call sites that might bypass the `key`.
  presentationIdRef.current = presentationId;
  presentationSlugRef.current = presentationSlug;


  const loadSlides = useCallback(async (nextRoot) => {
    try {
      const list = await api.fetchSlides(nextRoot, presentationIdRef.current);
      setSlides(list);
    } catch {
      setStatusKey("messages.editor.load_error");
      setStatusTone("error");
    }
  }, []);

  const save = useCallback(async (overwrite = false) => {
    const file = selectedFileRef.current;
    if (!file) return;
    if (!permissions?.canEdit) return;

    // Coalesce concurrent saves. If a request is already in flight, mark that a
    // follow-up is needed and return: the running save re-runs once it finishes
    // with whatever the latest snapshot is. Two saves never race, so an older
    // payload can no longer land after a newer one.
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    const body = htmlRef.current;
    // Skip the round-trip when nothing actually changed: avoids redundant
    // network calls and the "Saved" toast flicker on a passive autosave.
    if (!overwrite && body === savedSnapshotRef.current) return;

    savingRef.current = true;
    setStatusKey("messages.editor.saving");
    setStatusTone("loading");
    let succeeded = false;
    try {
      const data = await api.saveSlide(file, {
        html: body,
        revision: overwrite ? null : revisionRef.current,
        overwrite,
      }, presentationIdRef.current);
      setRevision(data.revision ?? null);
      revisionRef.current = data.revision ?? null;
      setSavedSnapshot(body);
      // Update the ref synchronously so the follow-up check below (and any
      // "dirty" comparison) sees the just-persisted snapshot immediately,
      // without waiting for the next render to reassign the ref from state.
      savedSnapshotRef.current = body;
      setStatusKey("messages.editor.saved");
      setStatusTone("success");
      succeeded = true;
    } catch (err) {
      if (err.code === 409) {
        setStatusKey("messages.errors.conflict");
        setStatusTone("error");
      } else {
        setStatusKey("messages.editor.save_error");
        setStatusTone("error");
      }
    } finally {
      savingRef.current = false;
    }

    // Only chain a follow-up after a *successful* save: retrying on failure
    // would spin forever (the snapshot never advances). If edits arrived while
    // this save was in flight, flush the latest snapshot so the newest content
    // always wins.
    if (succeeded && (pendingSaveRef.current || htmlRef.current !== savedSnapshotRef.current)) {
      pendingSaveRef.current = false;
      await save(true);
    } else if (!succeeded) {
      pendingSaveRef.current = false;
    }
  }, [permissions]);

  const selectFile = useCallback(
    async (file) => {
      if (!file) return;
      // Flush any pending edits to the slide we are leaving before its debounced
      // autosave timer is replaced by the new slide's — otherwise switching
      // (or re-clicking the same slide) re-fetches the last-saved state from the
      // server and silently discards unsaved edits.
      const leaving = selectedFileRef.current;
      if (leaving && permissions?.canEdit && htmlRef.current !== savedSnapshotRef.current) {
        await save(true);
      }
      setSelectedFile(file);
      setStatusKey("messages.editor.loading");
      setStatusTone("loading");
      const meta = slides.find((s) => s.file === file);
      try {
        const content = await api.fetchSlideHtml(file, presentationIdRef.current);
        setHtml(content);
        setSavedSnapshot(content);
        setLoadNonce((n) => n + 1);
        setRevision(meta?.revision ?? null);
        setStatusKey("messages.editor.ready");
        setStatusTone("ready");
      } catch {
        setStatusKey("messages.editor.load_error");
        setStatusTone("error");
      }
    },
    [slides, permissions, save]
  );

  const duplicate = useCallback(
    async (file, title) => {
      if (!file || !title?.trim()) return;
      if (!permissions?.canEdit) return;
      setStatusKey("messages.editor.saving");
      setStatusTone("loading");
      try {
        const copy = await api.duplicateSlide(file, { title: title.trim() }, presentationIdRef.current);
        await loadSlides(root);
        await selectFile(copy.file);
        setStatusKey("messages.editor.duplicated");
        setStatusTone("success");
        toast.success(__("messages.editor.duplicated"));
      } catch {
        setStatusKey("messages.editor.duplicate_error");
        setStatusTone("error");
        toast.error(__("messages.editor.duplicate_error"));
      }
    },
    [loadSlides, root, permissions, selectFile]
  );

  const reorder = useCallback(
    async (order) => {
      if (!presentationIdRef.current) return;
      try {
        await api.reorderSlides(presentationIdRef.current, order);
        await loadSlides(root);
      } catch {
        setStatusKey("messages.editor.reorder_error");
        setStatusTone("error");
      }
    },
    [loadSlides, root]
  );

  const reload = useCallback(() => {
    selectFile(selectedFileRef.current);
  }, [selectFile]);

  const createSlide = useCallback(
    async (title = null) => {
      const presentationId = presentationIdRef.current;
      if (!presentationId) return;
      if (!permissions?.canEdit) return;
      setStatusKey("messages.editor.saving");
      setStatusTone("loading");
      try {
        const created = await api.createSlide(presentationId, { title });
        await loadSlides(root);
        await selectFile(created.file);
        setStatusKey("messages.editor.created");
        setStatusTone("success");
        toast.success(__("messages.editor.created"));
      } catch {
        setStatusKey("messages.editor.create_error");
        setStatusTone("error");
        toast.error(__("messages.editor.create_error"));
      }
    },
    [loadSlides, root, permissions, selectFile]
  );

  // Structural operation history (slide create/delete/reorder). Content edits
  // are owned by the canvas engine; this stack reverses deck-level changes via
  // Ctrl+Z / Ctrl+Y so a removed slide can be brought back.
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const historyBusyRef = useRef(false);

  const selectFallback = useCallback(
    (list, removedFile) => {
      if (list.length === 0) return null;
      const idx = list.findIndex((s) => s.file === removedFile);
      const next = idx > 0 ? list[idx - 1] : list[0];
      return next?.file ?? list[0].file;
    },
    []
  );

  const deleteSlide = useCallback(
    async (file) => {
      const presentationId = presentationIdRef.current;
      if (!presentationId || !file) return;
      if (!permissions?.canEdit) return;
      if (historyBusyRef.current) return;
      const snapshot = slides.find((s) => s.file === file);
      if (!snapshot) return;

      historyBusyRef.current = true;
      setStatusKey("messages.editor.saving");
      setStatusTone("loading");
      try {
        await api.deleteSlide(file, presentationIdRef.current);
        undoStackRef.current.push({ type: "delete", slide: snapshot });
        redoStackRef.current = [];
        await loadSlides(root);
        const fallback = selectFallback(slides, file);
        if (selectedFileRef.current === file && fallback) selectFile(fallback);
        setStatusKey("messages.editor.deleted");
        setStatusTone("success");
        toast.success(__("messages.editor.deleted"));
      } catch {
        setStatusKey("messages.editor.delete_error");
        setStatusTone("error");
        toast.error(__("messages.editor.delete_error"));
      } finally {
        historyBusyRef.current = false;
      }
    },
    [slides, root, permissions, loadSlides, selectFile, selectFallback]
  );

  const undo = useCallback(async () => {
    if (historyBusyRef.current) return true;
    const entry = undoStackRef.current.pop();
    if (!entry) return false;
    if (entry.type === "delete") {
      historyBusyRef.current = true;
      try {
        const restored = await api.restoreSlide({
          presentationId: presentationIdRef.current,
          filename: entry.slide.file,
          title: entry.slide.title,
          position: parseInt(entry.slide.number, 10) || 1,
          html: entry.slide.html,
          sourceMode: entry.slide.source_mode,
          revision: entry.slide.revision,
        });
        redoStackRef.current.push(entry);
        await loadSlides(root);
        await selectFile(restored.file);
        setStatusKey("messages.editor.restored");
        setStatusTone("success");
        toast.success(__("messages.editor.restored"));
      } catch {
        undoStackRef.current.push(entry);
        setStatusKey("messages.editor.restore_error");
        setStatusTone("error");
        toast.error(__("messages.editor.restore_error"));
      } finally {
        historyBusyRef.current = false;
      }
    }
    return true;
  }, [root, loadSlides, selectFile]);

  const redo = useCallback(async () => {
    if (historyBusyRef.current) return true;
    const entry = redoStackRef.current.pop();
    if (!entry) return false;
    if (entry.type === "delete") {
      historyBusyRef.current = true;
      try {
        await api.deleteSlide(entry.slide.file, presentationIdRef.current);
        undoStackRef.current.push(entry);
        await loadSlides(root);
        const fallback = selectFallback(slides, entry.slide.file);
        if (selectedFileRef.current === entry.slide.file && fallback) selectFile(fallback);
        setStatusKey("messages.editor.deleted");
        setStatusTone("success");
        toast.success(__("messages.editor.deleted"));
      } catch {
        redoStackRef.current.push(entry);
        setStatusKey("messages.editor.delete_error");
        setStatusTone("error");
        toast.error(__("messages.editor.delete_error"));
      } finally {
        historyBusyRef.current = false;
      }
    }
    return true;
  }, [slides, root, loadSlides, selectFile, selectFallback]);

  const renameSlide = useCallback(async (file, title) => {
    if (!file || !title?.trim()) return;
    if (!permissions?.canEdit) return;
    setStatusKey("messages.editor.saving");
    setStatusTone("loading");
    try {
      const renamed = await api.renameSlide(file, { title: title.trim() }, presentationIdRef.current);
      setSlides((prev) =>
        prev.map((s) =>
          s.file === file
            ? { ...s, file: renamed.file, title: renamed.title, revision: renamed.revision }
            : s
        )
      );
      if (selectedFileRef.current === file) {
        await selectFile(renamed.file);
      }
      // A rename invalidates the structural undo history because file keys
      // change; clear it so a stale "delete" can't resurrect under the old
      // filename.
      undoStackRef.current = [];
      redoStackRef.current = [];
      setStatusKey("messages.editor.renamed");
      setStatusTone("success");
      toast.success(__("messages.editor.renamed"));
    } catch {
      setStatusKey("messages.editor.rename_error");
      setStatusTone("error");
      toast.error(__("messages.editor.rename_error"));
    }
  }, [permissions, selectFile]);

  // Rename the current presentation. Update both the local title state and the
  // persisted record; slug/title changes are server-authoritative. The server
  // also regenerates the slug from the title, so a reload on the OLD URL
  // would 404 against Presentation::where(slug, ...). After a successful
  // rename we replace the current URL with the new one so the user's URL bar
  // (and a manual reload) reflects the new presentation.
  //
  // Inertia v3 caveat: `router.replace(props)` only replaces client-side
  // props — it does NOT change the URL. To change the URL we use
  // `router.visit(url, { replace: true })`, which swaps the current history
  // entry instead of pushing a new one (so the back button still works).
  const renamePresentation = useCallback(async (title) => {
    const slug = presentationSlugRef.current;
    const trimmed = title?.trim();
    if (!slug || !trimmed) return;
    if (!permissions?.canEdit) return;
    setStatusKey("messages.editor.saving");
    setStatusTone("loading");
    try {
      const updated = await api.renamePresentation(slug, { title: trimmed });
      const newTitle = updated?.title ?? trimmed;
      const newSlug = updated?.slug ?? null;
      if (newTitle) setPresentationTitle(newTitle);

      // If the slug changed, swap the URL in place so a reload still resolves
      // the route binding against the NEW presentation URL.
      if (newSlug && newSlug !== slug) {
        presentationSlugRef.current = newSlug;
        router.visit(route("editor", { presentation: newSlug }), { replace: true });
      }
      setStatusKey("messages.presentation.renamed");
      setStatusTone("success");
      toast.success(__("messages.presentation.renamed"));
    } catch {
      setStatusKey("messages.presentation.rename_error");
      setStatusTone("error");
      toast.error(__("messages.presentation.rename_error"));
    }
  }, [permissions]);

  // Copy a template slide into the current presentation's deck. Templates mode
  // lists slides with source_mode = Template; this materialises a new deck
  // slide (source_mode = Deck) from the template's HTML, then switches the
  // root back to the deck and selects the freshly created slide.
  const copyTemplate = useCallback(
    async (file, title = null) => {
      const presentationId = presentationIdRef.current;
      if (!file || !presentationId) return;
      setStatusKey("messages.templates.copying");
      setStatusTone("loading");
      try {
        const copy = await api.copyTemplateToDeck(file, { presentationId, title });
        setRoot("deck");
        await loadSlides("deck");
        await selectFile(copy.file);
        setStatusKey("messages.templates.copied");
        setStatusTone("success");
        toast.success(__("messages.templates.copied"));
      } catch {
        setStatusKey("messages.templates.copy_error");
        setStatusTone("error");
        toast.error(__("messages.templates.copy_error"));
      }
    },
    [loadSlides, selectFile]
  );

  const preview = useCallback(async () => {
    const file = selectedFileRef.current;
    const presentationId = presentationIdRef.current;
    if (!file) return;
    try {
      const html = await api.fetchSlideHtml(file, presentationId);
      const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${file}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;min-height:100dvh;background:${SLIDE_BG};display:flex;align-items:center;justify-content:center;font-family:${SLIDE_FONT}}
.slide{width:1600px;height:900px;background:${SLIDE_BG};color:${SLIDE_COLOR};position:relative;overflow:hidden;max-width:100vw;max-height:100dvh;object-fit:contain}
.slide>*{position:absolute}
.slide,.slide *{pointer-events:none!important}
ul,ol{margin:0;padding-left:1.4em}li{margin:0}
</style>
</head>
<body>${html}</body>
</html>`;
      const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      // fallback: open raw URL
      window.open(api.slideHtmlUrl(file, presentationId), "_blank");
    }
  }, []);

  // AI generation hook. Kicks off generation for the current presentation and
  // polls until completion or failure, refreshing the slide list on success.
  const generate = useCallback(
    async (prompt, maxSlides = null) => {
      const slug = presentationSlugRef.current;
      if (!slug) throw new Error("editor.no_presentation");

      const started = await api.generateSlides(slug, { prompt, maxSlides });

      const poll = async () => {
        const status = await api.generationStatus(started.generation_id);
        if (status.status === "completed") {
          await loadSlides(root);
          setStatusKey("messages.ai.generation_done");
          setStatusTone("success");
          toast.success(__("messages.ai.generation_done"));
          return;
        }
        if (status.status === "failed") {
          setStatusKey("messages.ai.generation_failed");
          setStatusTone("error");
          toast.error(__("messages.ai.generation_failed"));
          return;
        }
        setTimeout(poll, 1500);
      };

      setStatusKey("messages.ai.generating");
      setStatusTone("loading");
      toast.loading(__("messages.ai.generating"));
      poll();

      return started;
    },
    [loadSlides, root]
  );

  const toggleEditMode = useCallback(() => setEditMode((v) => !v), []);
  const toggleSlideFullscreen = useCallback(() => setSlideFullscreen((v) => !v), []);

  const onHtmlChange = useCallback((nextHtml) => {
    setHtml(nextHtml);
  }, []);

  // The Workspace registers the live slideEditor engine here so the toolbar
  // and inspector can dispatch commands against the shadow-rooted slide.
  const registerEngine = useCallback((engine) => {
    engineRef.current = engine;
    if (!engine) setSelection(null);
  }, []);

  const onEngineSelection = useCallback((info) => {
    setSelection(info);
    setSelectedLabel(info ? info.path : null);
  }, []);

  const cmd = useMemo(() => {
    const run = (fn) => (...args) => {
      const e = engineRef.current;
      if (e && typeof e[fn] === "function") return e[fn](...args);
    };
    return {
      undo: run("undo"),
      redo: run("redo"),
      copy: run("copy"),
      cut: run("cut"),
      paste: run("paste"),
      duplicate: run("duplicate"),
      remove: run("remove"),
      nudge: run("nudge"),
      bringForward: run("bringForward"),
      sendBackward: run("sendBackward"),
      group: run("group"),
      ungroup: run("ungroup"),
      clearFormatting: run("clearFormatting"),
      insertText: run("insertText"),
      insertIcon: run("insertIcon"),
      insertTable: run("insertTable"),
      insertImageBox: run("insertImageBox"),
      insertRow: run("insertRow"),
      deleteRow: run("deleteRow"),
      insertColumn: run("insertColumn"),
      deleteColumn: run("deleteColumn"),
      moveRow: run("moveRow"),
      moveColumn: run("moveColumn"),
      setRowHeight: run("setRowHeight"),
      setColumnWidth: run("setColumnWidth"),
      setText: run("setText"),
      setHtml: run("setHtml"),
      getHtml: run("getHtml"),
      getSelected: run("getSelected"),
      selectByPath: run("selectByPath"),
      moveElement: run("moveElement"),
      getLayerTree: run("getLayerTree"),
      getSlideRoot: run("getSlideRoot"),
      setIcon: run("setIcon"),
      removeIcon: run("removeIcon"),
      setIconSize: run("setIconSize"),
      applyTextCommand: run("applyTextCommand"),
      setTextColor: run("setTextColor"),
      saveSelection: run("saveSelection"),
      restoreSelection: run("restoreSelection"),
      applyList: run("applyList"),
      beginTextEdit: run("beginTextEdit"),
      exitTextEdit: run("exitTextEdit"),
      setStyle: run("setStyle"),
      setStyles: run("setStyles"),
    };
  }, []);

  // Load slides whenever the root (deck/templates) changes.
  useEffect(() => {
    loadSlides(root);
  }, [root, loadSlides]);

  // Keep a valid selection as the slide list changes.
  useEffect(() => {
    if (slides.length > 0 && !slides.some((s) => s.file === selectedFile)) {
      selectFile(slides[0].file);
    }
  }, [slides, selectedFile, selectFile]);

  // First paint: select the initial slide.
  useEffect(() => {
    if (selectedFile) selectFile(selectedFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = permissions?.canEdit && html !== "" && html !== savedSnapshot;

  // Surface definitive outcomes (and failures) as toasts. Transient states such
  // as "saving" / "auto-saving" stay in the status bar only.
  const lastToastKey = useRef(null);
  useEffect(() => {
    if (!statusKey) return;
    if (statusKey === lastToastKey.current) return;
    lastToastKey.current = statusKey;

    const tone = statusTone;
    const message = __(statusKey);
    if (tone === "success") toast.success(message);
    else if (tone === "error") toast.error(message);
  }, [statusKey, statusTone]);

  // Debounced auto-save while dirty (skipped for read-only viewers).
  // Uses both a resetting debounce (AUTOSAVE_MS) and a guaranteed max interval
  // (AUTOSAVE_MAX_MS) so saves always happen within a bounded window even under
  // continuous edits.  Also flushes on pagehide/beforeunload to avoid losing
  // the last change.
  useEffect(() => {
    if (!dirty) {
      dirtySinceRef.current = null;
      return undefined;
    }
    if (!permissions?.canEdit) return undefined;

    // Remember when the current dirty streak began so the debounce can be
    // capped: a single resetting debounce would starve indefinitely under
    // continuous typing. One timer only — no separate max timer that could
    // double-fire alongside the debounce.
    if (dirtySinceRef.current === null) dirtySinceRef.current = Date.now();

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    const elapsed = Date.now() - dirtySinceRef.current;
    const delay = Math.min(AUTOSAVE_MS, Math.max(0, AUTOSAVE_MAX_MS - elapsed));

    setStatusKey("messages.editor.autosave_pending");
    setStatusTone("loading");
    autosaveTimer.current = setTimeout(() => {
      dirtySinceRef.current = null;
      save(true);
    }, delay);

    const flush = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") return;
      const file = selectedFileRef.current;
      if (!file || !permissions?.canEdit) return;
      const body = htmlRef.current;
      if (body === savedSnapshotRef.current) return;
      // sendBeacon is the only reliable unload flush; the async save below is a
      // best-effort fallback for environments without sendBeacon.
      const sent = api.saveSlideBeacon(file, { html: body, revision: null, overwrite: true }, presentationIdRef.current);
      if (!sent) save(true);
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, dirty, permissions?.canEdit]);

  const value = useMemo(
    () => ({
      root,
      setRoot,
      slides,
      selectedFile,
      html,
      dirty,
      statusKey,
      statusTone,
      selectedLabel,
      setSelectedLabel,
      editMode,
      toggleEditMode,
      slideFullscreen,
      toggleSlideFullscreen,
      selectFile,
      onHtmlChange,
      save,
      duplicate,
      reorder,
      reload,
      preview,
      copyTemplate,
      generate,
      presentationId,
      presentationSlug,
      presentationTitle: presentationTitleState,
      permissions,
      slideKey: loadNonce,
      deckRoot,
      templateRoot,
      selection,
      registerEngine,
      onEngineSelection,
      cmd,
      slideFullscreen,
      toggleSlideFullscreen,
      createSlide,
      deleteSlide,
      renameSlide,
      renamePresentation,
      undo,
      redo,
    }),
    [
      root,
      slides,
      selectedFile,
      html,
      dirty,
      statusKey,
      statusTone,
      selectedLabel,
      editMode,
      toggleEditMode,
      selectFile,
      onHtmlChange,
      save,
      duplicate,
      reorder,
      reload,
      preview,
      copyTemplate,
      generate,
      presentationId,
      presentationSlug,
      presentationTitleState,
      permissions,
      loadNonce,
      deckRoot,
      templateRoot,
      selection,
      registerEngine,
      onEngineSelection,
      cmd,
      createSlide,
      deleteSlide,
      renameSlide,
      renamePresentation,
      undo,
      redo,
      slideFullscreen,
      toggleSlideFullscreen,
    ]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
