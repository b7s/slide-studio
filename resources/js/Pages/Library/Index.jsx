import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { ScrollArea } from "../../Components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../Components/ui/select";
import { Badge } from "../../Components/ui/badge";
import { Search, ArrowUp, ArrowDown, Plus, Loader2 } from "lucide-react";
import { fetchLibraryGroups, fetchPresentations, createPresentation } from "../../lib/api";
import { route } from "../../lib/routes";
import { __ } from "../../lib/i18n";
import PresentationCover from "./PresentationCover";

const PER_PAGE = 12;

export default function LibraryIndex() {
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated_at");
  const [dir, setDir] = useState("desc");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (groupKey, teamId, q, sortBy, sortDir, page, replace) => {
      const id = ++requestId.current;
      if (page === 1) setLoading(true);
      setError(null);
      try {
        const data = await fetchPresentations({
          group: groupKey,
          teamId,
          query: q,
          sort: sortBy,
          dir: sortDir,
          page,
          perPage: PER_PAGE,
        });
        if (id !== requestId.current) return;
        setItems((prev) => (replace ? data.presentations : [...prev, ...data.presentations]));
        setPagination({ page: data.pagination.page, hasMore: data.pagination.hasMore });
      } catch {
        if (id === requestId.current) setError(__("messages.errors.unexpected"));
      } finally {
        if (id === requestId.current && page === 1) setLoading(false);
      }
    },
    []
  );

  // Initial load: groups, then the first group's presentations.
  useEffect(() => {
    let cancelled = false;
    fetchLibraryGroups()
      .then((g) => {
        if (cancelled) return;
        setGroups(g);
        const first = g[0] ?? null;
        setActive(first);
        if (first) {
          load(first.key, first.team_id, "", sort, dir, 1, true);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(__("messages.errors.unexpected"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectGroup = (group) => {
    setActive(group);
    setItems([]);
    load(group.key, group.team_id, query, sort, dir, 1, true);
  };

  const onSearch = (value) => {
    setQuery(value);
    if (!active) return;
    load(active.key, active.team_id, value, sort, dir, 1, true);
  };

  const onSortChange = (value) => {
    setSort(value);
    if (!active) return;
    load(active.key, active.team_id, query, value, dir, 1, true);
  };

  const onDirToggle = () => {
    const next = dir === "asc" ? "desc" : "asc";
    setDir(next);
    if (!active) return;
    load(active.key, active.team_id, query, sort, next, 1, true);
  };

  const loadMore = () => {
    if (!active) return;
    load(active.key, active.team_id, query, sort, dir, pagination.page + 1, false);
  };

  const handleCreate = async () => {
    try {
      const { slug } = await createPresentation({ title: null, teamId: active?.team_id ?? null });
      router.visit(route("editor", { presentation: slug }));
    } catch {
      setError(__("messages.errors.unexpected"));
    }
  };

  const openPresentation = (presentation) => {
    router.visit(route("editor", { presentation: presentation.slug }));
  };

  const roleLabel = (role) => __(`messages.library.role_${role}`);

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
        <div className="px-4 py-4">
          <h1 className="text-lg font-semibold">{__("messages.library.title")}</h1>
        </div>
        <ScrollArea className="flex-1 px-2">
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {__("messages.library.spaces")}
          </p>
          <ul className="grid gap-1">
            {groups.map((group) => {
              const isActive = active && active.key === group.key && active.team_id === group.team_id;
              return (
                <li key={`${group.key}-${group.team_id ?? "shared"}`}>
                  <button
                    type="button"
                    onClick={() => selectGroup(group)}
                    className={[
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "bg-[var(--accent)] text-[var(--foreground)] border border-[var(--gold)]/50"
                        : "border border-transparent text-[var(--muted-foreground)] hover:bg-[var(--secondary)]",
                    ].join(" ")}
                  >
                    <span className="truncate">{group.label}</span>
                    <span className="ml-2 rounded-full bg-[var(--muted)] px-2 text-[11px] font-semibold">
                      {group.count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              placeholder={__("messages.library.search_placeholder")}
              className="h-10 pl-9"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[var(--muted-foreground)]">
              {__("messages.library.sort_by")}
            </span>
            <Select value={sort} onValueChange={onSortChange}>
              <SelectTrigger className="h-10 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">{__("messages.library.sort_updated")}</SelectItem>
                <SelectItem value="name">{__("messages.library.sort_name")}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label={dir === "asc" ? __("messages.library.dir_asc") : __("messages.library.dir_desc")}
              onClick={onDirToggle}
            >
              {dir === "asc" ? <ArrowUp /> : <ArrowDown />}
            </Button>
          </div>

          <Button onClick={handleCreate} className="ml-auto">
            <Plus />
            {__("messages.library.new_presentation")}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-[var(--muted-foreground)]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                {__("messages.sharing.loading")}
              </div>
            ) : error ? (
              <div className="py-20 text-center text-[var(--muted-foreground)]">{error}</div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-base font-semibold">{__("messages.library.empty")}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {__("messages.library.empty_hint")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((presentation) => (
                  <button
                    key={presentation.id}
                    type="button"
                    onClick={() => openPresentation(presentation)}
                    className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-left transition hover:bg-[var(--secondary)] hover:border-[var(--gold)]/40"
                  >
                    <PresentationCover html={presentation.cover_html} />
                    <div className="flex items-start justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{presentation.title}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted-foreground)]">
                          {__("messages.library.updated")}:{" "}
                          {new Date(presentation.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {roleLabel(presentation.role)}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && pagination.hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadMore}>
                  {__("messages.library.load_more")}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
