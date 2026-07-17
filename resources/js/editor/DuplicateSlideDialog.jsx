import {useEffect, useState} from "react";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "../Components/ui/dialog";
import {Button} from "../Components/ui/button";
import {Input} from "../Components/ui/input";
import {Label} from "../Components/ui/label";
import {__} from "../lib/i18n";

// Reusable duplicate dialog. Receives the slide under the cursor and a
// pre-filled human-readable title (e.g. `"Capa (cópia)"`); on confirm calls
// `onDuplicate(newTitle)` so the caller can hand it to the existing
// DuplicateSlide transition. The HTML filename is derived server-side from
// the title (slug + .html), so the user only ever sees/inputs the name —
// no path or extension fiddling.
export default function DuplicateSlideDialog({ open, initialTitle = "", onClose, onDuplicate }) {
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    if (open) setValue(initialTitle);
  }, [open, initialTitle]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onDuplicate(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{__("messages.sidebar.duplicate_title")}</DialogTitle>
          <DialogDescription>{__("messages.sidebar.duplicate_dialog_desc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="duplicate-slide-input">{__("messages.sidebar.duplicate_label")}</Label>
          <Input
            id="duplicate-slide-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {__("messages.sidebar.remove_cancel")}
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            {__("messages.sidebar.duplicate_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
