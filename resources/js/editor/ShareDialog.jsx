import { useState, useEffect, useCallback } from "react";
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../Components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../Components/ui/select";
import { Share2, Loader2, Trash2, X } from "lucide-react";
import { __ } from "../lib/i18n";
import { toast } from "sonner";
import {
  fetchShares,
  updateShare,
  removeShare,
  searchUsers,
} from "../lib/api";

export function ShareDialog({ open, onClose, presentationSlug, canShare }) {
  const [shares, setShares] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chosenRole, setChosenRole] = useState("viewer");
  const [busy, setBusy] = useState(false);

  const loadShares = useCallback(async () => {
    if (!presentationSlug) return;
    setLoadingShares(true);
    try {
      const data = await fetchShares(presentationSlug);
      setShares(data.shares ?? []);
    } catch {
      toast.error(__("messages.errors.unexpected_detail"));
    } finally {
      setLoadingShares(false);
    }
  }, [presentationSlug]);

  useEffect(() => {
    if (open) loadShares();
  }, [open, loadShares]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsers(query.trim());
        const existingIds = new Set([
          ...shares.map((s) => s.id),
        ]);
        setResults((data.users ?? []).filter((u) => !existingIds.has(u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, shares]);

  const handleAdd = async () => {
    if (!selectedUser) return;
    setBusy(true);
    try {
      await updateShare(presentationSlug, selectedUser.id, chosenRole);
      setSelectedUser(null);
      setQuery("");
      setResults([]);
      await loadShares();
      toast.success(__("messages.sharing.shared_with"));
    } catch {
      toast.error(__("messages.errors.unexpected_detail"));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    setBusy(true);
    try {
      await updateShare(presentationSlug, userId, role);
      await loadShares();
    } catch {
      toast.error(__("messages.errors.unexpected_detail"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId) => {
    setBusy(true);
    try {
      await removeShare(presentationSlug, userId);
      await loadShares();
    } catch {
      toast.error(__("messages.errors.unexpected_detail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="size-5" />
            {__("messages.sharing.title")}
          </DialogTitle>
          <DialogDescription>
            {__("messages.sharing.shared_with")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!canShare && (
            <p className="text-sm text-[var(--muted-foreground)]">
              {__("messages.sharing.only_owner_can_share")}
            </p>
          )}

          {canShare && (
            <div className="grid gap-2">
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={__("messages.sharing.search_placeholder")}
                disabled={busy}
              />
              {searching && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  <Loader2 className="mr-1 inline size-3 animate-spin" />
                  {__("messages.sharing.searching")}
                </p>
              )}
              {results.length > 0 && (
                <div className="rounded-md border border-[var(--border)]">
                  {results.slice(0, 6).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(user);
                        setQuery(user.name);
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between border-b border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--muted)] last:border-b-0"
                    >
                      <span>{user.name}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {user.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && results.length === 0 && !searching && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {__("messages.sharing.no_users_found")}
                </p>
              )}

              {selectedUser && (
                <div className="flex items-center gap-2">
                  <Select value={chosenRole} onValueChange={setChosenRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">{__("messages.sharing.role_owner")}</SelectItem>
                      <SelectItem value="editor">{__("messages.sharing.role_editor")}</SelectItem>
                      <SelectItem value="viewer">{__("messages.sharing.role_viewer")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={handleAdd} disabled={busy}>
                    {__("messages.sharing.add")}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSelectedUser(null); setQuery(""); }}>
                    <X />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            {loadingShares ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                <Loader2 className="mr-1 inline size-3 animate-spin" />
                {__("messages.sharing.loading")}
              </p>
            ) : shares.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {__("messages.sharing.no_users_found")}
              </p>
            ) : (
              shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{share.name}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">{share.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={share.role}
                      onValueChange={(v) => handleRoleChange(share.id, v)}
                      disabled={busy || !canShare}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{__("messages.sharing.role_owner")}</SelectItem>
                        <SelectItem value="editor">{__("messages.sharing.role_editor")}</SelectItem>
                        <SelectItem value="viewer">{__("messages.sharing.role_viewer")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {canShare && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={__("messages.sharing.remove")}
                        onClick={() => handleRemove(share.id)}
                        disabled={busy}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogClose asChild>
          <Button type="button" variant="outline">
            {__("messages.ai.close")}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
