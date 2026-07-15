import {useCallback, useEffect, useRef, useState} from "react";
import {Button} from "../Components/ui/button";
import {Input} from "../Components/ui/input";
import {Label} from "../Components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "../Components/ui/select";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../Components/ui/dialog";
import {ImagePlus, Search} from "lucide-react";
import {__} from "../lib/i18n";
import {toast} from "sonner";
import {fetchAccessiblePresentations, fetchAssets, uploadAsset,} from "../lib/api";

const SORTS = [
  { key: "last_used:desc", sort: "last_used", dir: "desc", label: "messages.media.sort_recent_used" },
  { key: "last_used:asc", sort: "last_used", dir: "asc", label: "messages.media.sort_oldest_used" },
  { key: "uploaded:desc", sort: "uploaded", dir: "desc", label: "messages.media.sort_recent_uploaded" },
  { key: "uploaded:asc", sort: "uploaded", dir: "asc", label: "messages.media.sort_oldest_uploaded" },
];

export function MediaPickerDialog({ open, onClose, onPick, presentationId = null }) {
  const [presentations, setPresentations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filters, setFilters] = useState({
    presentation: "all",
    sort: "last_used",
    dir: "desc",
    search: "",
  });
  const fileRef = useRef(null);

  const loadAssets = useCallback(async (current) => {
    setLoading(true);
    try {
      const data = await fetchAssets({
        presentation: current.presentation,
        sort: current.sort,
        dir: current.dir,
        search: current.search,
      });
      setAssets(data);
    } catch {
      toast.error(__("messages.media.load_failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const decks = await fetchAccessiblePresentations();
        if (active) setPresentations(decks);
      } catch {
        /* non-fatal: filter just stays on "all" */
      }
    })();
    loadAssets(filters);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced refetch when filters change (search especially).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => loadAssets(filters), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, open, loadAssets]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await uploadAsset(file, filters.presentation === "all" ? null : filters.presentation);
      toast.success(__("messages.media.uploaded"));
      loadAssets(filters);
    } catch (err) {
      toast.error(err?.detail?.detail ?? __("messages.media.upload_failed"));
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  const currentSortKey = `${filters.sort}:${filters.dir}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-none !w-screen !h-screen !max-h-screen !rounded-none flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="size-5" />
            {__("messages.media.title")}
          </DialogTitle>
          <DialogDescription>{__("messages.media.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 py-2">
          <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_auto]">
            <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder={__("messages.media.search_placeholder")}
                  className="h-9 pl-8"
                />
              </div>

              <Label className="gap-1.5">
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                  {__("messages.media.filter_deck")}
                </span>
                <Select
                  value={String(filters.presentation)}
                  onValueChange={(v) => setFilters((f) => ({ ...f, presentation: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{__("messages.media.filter_all")}</SelectItem>
                    {presentations.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            </div>

            <Label className="gap-1.5">
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                {__("messages.media.sort_label")}
              </span>
              <Select
                value={currentSortKey}
                onValueChange={(v) => {
                  const [sort, dir] = v.split(":");
                  setFilters((f) => ({ ...f, sort, dir }));
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {__(s.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2">
            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-md bg-[var(--muted)]/40" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
                {__("messages.media.empty")}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() =>
                      onPick({
                        id: asset.id,
                        path: asset.path,
                        url: asset.url,
                      })
                    }
                    className="group relative aspect-square overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)] hover:ring-2 hover:ring-[var(--navy)]"
                    title={asset.path}
                  >
                    <img
                      src={asset.url}
                      alt={asset.path}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {uploading ? __("messages.media.uploading") : __("messages.media.upload")}
            </Button>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {__("messages.media.close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
