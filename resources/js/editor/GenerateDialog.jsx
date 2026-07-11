import { useState } from "react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../Components/ui/dialog";
import { Sparkles } from "lucide-react";
import { __ } from "../lib/i18n";
import { toast } from "sonner";

export function GenerateDialog({ open, onClose, onGenerate }) {
  const [prompt, setPrompt] = useState("");
  const [maxSlides, setMaxSlides] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onGenerate(prompt.trim(), maxSlides);
      onClose();
    } catch (err) {
      setError(err.message ?? __("messages.ai.generation_failed"));
      toast.error(__("messages.ai.generation_failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            {__("messages.ai.generate_title")}
          </DialogTitle>
          <DialogDescription>
            {__("messages.ai.prompt_label")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt">{__("messages.ai.prompt_label")}</Label>
              <textarea
                id="prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={__("messages.ai.prompt_placeholder")}
                className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-sm focus:border-[var(--focus)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxSlides">{__("messages.ai.max_slides_label")}</Label>
              <Input
                id="maxSlides"
                type="number"
                min="1"
                max="20"
                value={maxSlides}
                onChange={(e) => setMaxSlides(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                {__("messages.ai.close")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? __("messages.ai.generating") : __("messages.ai.start")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}