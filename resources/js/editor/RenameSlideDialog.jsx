import {useEffect, useState} from "react";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "../Components/ui/dialog";
import {Button} from "../Components/ui/button";
import {Input} from "../Components/ui/input";
import {Label} from "../Components/ui/label";
import {__} from "../lib/i18n";

// Reusable rename dialog. Receives the current slide title (or fallback) and
// calls `onRename(newTitle)` when confirmed. The HTML filename is derived
// server-side from the new title (slug + .html), so the user only enters the
// human-readable name here.
export default function RenameSlideDialog({ open, initialTitle = "", onClose, onRename }) {
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    if (open) setValue(initialTitle);
  }, [open, initialTitle]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onRename(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{__("messages.sidebar.rename_title")}</DialogTitle>
          <DialogDescription>{__("messages.sidebar.rename_desc")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="rename-slide-input">{__("messages.sidebar.rename_label")}</Label>
          <Input
            id="rename-slide-input"
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
            {__("messages.sidebar.rename_confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
