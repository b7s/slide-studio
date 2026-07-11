import AppShell from "../../editor/AppShell";
import { EditorProvider } from "../../editor/EditorContext";

export default function Index({ config, slides, presentationId, selectedFile }) {
  return (
    <EditorProvider
      config={config}
      initialSlides={slides}
      presentationId={presentationId}
      initialFile={selectedFile}
    >
      <AppShell />
    </EditorProvider>
  );
}
