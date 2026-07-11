import { useState } from "react";
import AppShell from "../../editor/AppShell";
import { __ } from "../../lib/i18n";

export default function Index({ config, slides, selectedFile: initialFile }) {
  const [root, setRoot] = useState("deck");
  const [selectedFile, setSelectedFile] = useState(initialFile || (slides[0]?.file ?? null));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(__("messages.editor.ready"));
  const [statusTone, setStatusTone] = useState("ready");
  const [selectedLabel, setSelectedLabel] = useState(null);

  const handleSelect = (file) => {
    setSelectedFile(file);
    setDirty(false);
    setStatus(__("messages.editor.ready"));
    setStatusTone("ready");
  };

  const handleSave = () => {
    setStatus(__("messages.editor.saving"));
    setStatusTone("loading");
    // Wire to POST /api/slides/{file} in Phase 5.
    setTimeout(() => {
      setDirty(false);
      setStatus(__("messages.editor.saved"));
      setStatusTone("success");
    }, 400);
  };

  return (
    <AppShell
      root={root}
      setRoot={setRoot}
      slides={slides}
      selectedFile={selectedFile}
      onSelect={handleSelect}
      selectedLabel={selectedLabel}
      dirty={dirty}
      status={status}
      statusTone={statusTone}
      onSave={handleSave}
    />
  );
}
