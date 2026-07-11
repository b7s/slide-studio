import { createContext, useContext, useEffect, useState } from "react";

const EditorPanelsContext = createContext(null);

function readFlag(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key, value) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {}
}

export function EditorPanelsProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readFlag("editor:sidebarCollapsed", false)
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useState(() =>
    readFlag("editor:inspectorCollapsed", false)
  );

  useEffect(() => writeFlag("editor:sidebarCollapsed", sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => writeFlag("editor:inspectorCollapsed", inspectorCollapsed), [inspectorCollapsed]);

  return (
    <EditorPanelsContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        inspectorCollapsed,
        setInspectorCollapsed,
      }}
    >
      {children}
    </EditorPanelsContext.Provider>
  );
}

export function useEditorPanels() {
  const ctx = useContext(EditorPanelsContext);
  if (!ctx) throw new Error("useEditorPanels must be used within EditorPanelsProvider");
  return ctx;
}
