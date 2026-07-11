import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "../lib/api";
import { toast } from "sonner";

const EditorContext = createContext(null);

const AUTOSAVE_MS = 5000;

export function EditorProvider({
  children,
  config = {},
  initialSlides = [],
  presentationId = null,
  presentationSlug = null,
  initialFile = null,
}) {
  const [root, setRoot] = useState("deck");
  const deckRoot = config.deckRoot ?? "";
  const templateRoot = config.templateRoot ?? "";
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
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [revision, setRevision] = useState(null);
  const [statusKey, setStatusKey] = useState("messages.editor.ready");
  const [statusTone, setStatusTone] = useState("ready");
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selection, setSelection] = useState(null);

  const engineRef = useRef(null);
  const presentationIdRef = useRef(presentationId);
  const presentationSlugRef = useRef(presentationSlug);
  const autosaveTimer = useRef(null);
  const selectedFileRef = useRef(selectedFile);
  const htmlRef = useRef(html);
  const revisionRef = useRef(revision);

  selectedFileRef.current = selectedFile;
  htmlRef.current = html;
  revisionRef.current = revision;

  const loadSlides = useCallback(async (nextRoot) => {
    try {
      const list = await api.fetchSlides(nextRoot);
      setSlides(list);
    } catch {
      setStatusKey("messages.editor.load_error");
      setStatusTone("error");
    }
  }, []);

  const selectFile = useCallback(
    async (file) => {
      if (!file) return;
      setSelectedFile(file);
      setStatusKey("messages.editor.loading");
      setStatusTone("loading");
      const meta = slides.find((s) => s.file === file);
      try {
        const content = await api.fetchSlideHtml(file);
        setHtml(content);
        setSavedSnapshot(content);
        setRevision(meta?.revision ?? null);
        setStatusKey("messages.editor.ready");
        setStatusTone("ready");
      } catch {
        setStatusKey("messages.editor.load_error");
        setStatusTone("error");
      }
    },
    [slides]
  );

  const save = useCallback(async (overwrite = false) => {
    const file = selectedFileRef.current;
    if (!file) return;
    const body = htmlRef.current;
    setStatusKey("messages.editor.saving");
    setStatusTone("loading");
    try {
      const data = await api.saveSlide(file, {
        html: body,
        revision: overwrite ? null : revisionRef.current,
        overwrite,
      });
      setRevision(data.revision ?? null);
      setSavedSnapshot(body);
      setStatusKey("messages.editor.saved");
      setStatusTone("success");
    } catch (err) {
      if (err.code === 409) {
        setStatusKey("messages.errors.conflict");
        setStatusTone("error");
      } else {
        setStatusKey("messages.editor.save_error");
        setStatusTone("error");
      }
    }
  }, []);

  const duplicate = useCallback(
    async (name) => {
      const file = selectedFileRef.current;
      if (!file || !name) return;
      setStatusKey("messages.editor.saving");
      setStatusTone("loading");
      try {
        const copy = await api.duplicateSlide(file, { filename: name, title: null });
        await loadSlides(root);
        await selectFile(copy.file);
        setStatusKey("messages.editor.duplicated");
        setStatusTone("success");
      } catch {
        setStatusKey("messages.editor.duplicate_error");
        setStatusTone("error");
      }
    },
    [loadSlides, root, selectFile]
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

  const preview = useCallback(() => {
    const file = selectedFileRef.current;
    if (file) {
      window.open(api.slideHtmlUrl(file), "_blank");
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

  const onHtmlChange = useCallback((nextHtml) => {
    setHtml(nextHtml);
  }, []);

  // The Workspace registers the live slideEditor engine here so the toolbar
  // and inspector can dispatch commands against the iframe document.
  const registerEngine = useCallback((engine) => {
    engineRef.current = engine;
    if (!engine) setSelection(null);
  }, []);

  const onEngineSelection = useCallback((info) => {
    setSelection(info);
    setSelectedLabel(info ? info.tag : null);
  }, []);

  const cmd = useMemo(() => {
    const run = (fn) => (...args) => {
      const e = engineRef.current;
      if (e && typeof e[fn] === "function") e[fn](...args);
    };
    return {
      undo: run("undo"),
      redo: run("redo"),
      copy: run("copy"),
      cut: run("cut"),
      paste: run("paste"),
      remove: run("remove"),
      nudge: run("nudge"),
      bringForward: run("bringForward"),
      sendBackward: run("sendBackward"),
      group: run("group"),
      ungroup: run("ungroup"),
      clearFormatting: run("clearFormatting"),
      applyTextCommand: run("applyTextCommand"),
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

  const dirty = html !== "" && html !== savedSnapshot;

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

  // Debounced auto-save while dirty.
  useEffect(() => {
    if (!dirty) return undefined;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setStatusKey("messages.editor.autosave_pending");
    setStatusTone("loading");
    autosaveTimer.current = setTimeout(() => {
      save(true);
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, dirty]);

  const value = useMemo(
    () => ({
      root,
      setRoot,
      slides,
      selectedFile,
      dirty,
      statusKey,
      statusTone,
      selectedLabel,
      setSelectedLabel,
      editMode,
      toggleEditMode,
      selectFile,
      onHtmlChange,
      save,
      duplicate,
      reorder,
      reload,
      preview,
      generate,
      presentationId,
      presentationSlug,
      deckRoot,
      templateRoot,
      selection,
      registerEngine,
      onEngineSelection,
      cmd,
    }),
    [
      root,
      slides,
      selectedFile,
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
      generate,
      presentationId,
      presentationSlug,
      deckRoot,
      templateRoot,
      selection,
      registerEngine,
      onEngineSelection,
      cmd,
    ]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
