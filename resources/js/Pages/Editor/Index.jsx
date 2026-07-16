import AppShell from "../../editor/AppShell";
import { EditorProvider } from "../../editor/EditorContext";

export default function Index({ config, slides, presentationId, presentationSlug, presentationTitle, selectedFile, permissions }) {
  // Both id and slug are part of the key so the editor remounts on either
  // navigation between presentations (different id) AND on rename (same id,
  // different slug). Without the slug part, a rename would keep the old
  // `initialSlides` cached in the provider because `useState` only honours the
  // initialiser on mount, not on prop changes.
  const providerKey = `${presentationId}:${presentationSlug ?? "anon"}`;
  return (
    <EditorProvider
      key={providerKey}
      config={config}
      initialSlides={slides}
      presentationId={presentationId}
      presentationSlug={presentationSlug}
      presentationTitle={presentationTitle}
      initialFile={selectedFile}
      permissions={permissions}
    >
      <AppShell />
    </EditorProvider>
  );
}
