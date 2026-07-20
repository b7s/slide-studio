import {useEffect, useState} from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "../Components/ui/dialog";
import {Button} from "../Components/ui/button";
import {Input} from "../Components/ui/input";
import {Label} from "../Components/ui/label";
import {Loader2} from "lucide-react";
import {__} from "../lib/i18n";

export default function RenameDialog({
    open,
    title,
    description,
    label,
    initialValue = "",
    confirmLabel,
    onClose,
    onRename,
}) {
    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setValue(initialValue);
            setLoading(false);
        }
    }, [open, initialValue]);

    const submit = async () => {
        const trimmed = value.trim();
        if (!trimmed || loading) return;
        setLoading(true);
        try {
            await Promise.resolve(onRename?.(trimmed));
            onClose?.();
        } catch {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-1.5">
                    <Label htmlFor="rename-input">{label}</Label>
                    <Input
                        id="rename-input"
                        autoFocus
                        value={value}
                        disabled={loading}
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
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        {__("messages.dialog.cancel")}
                    </Button>
                    <Button onClick={submit} disabled={!value.trim() || loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                                {__("messages.dialog.saving")}
                            </>
                        ) : (
                            confirmLabel || __("messages.dialog.rename_confirm")
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
