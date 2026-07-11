import AppShell from "../../editor/AppShell";
import { EditorProvider } from "../../editor/EditorContext";

export default function Index({ config, slides, presentationId, presentationSlug, selectedFile, permissions }) {
  return (
    <EditorProvider
      config={config}
      initialSlides={slides}
      presentationId={presentationId}
      presentationSlug={presentationSlug}
      initialFile={selectedFile}
      permissions={permissions}
    >
      <AppShell />
    </EditorProvider>
  );
}
