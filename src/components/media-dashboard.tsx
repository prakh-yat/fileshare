"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  ImageIcon,
  LayoutDashboard,
  Link2,
  List,
  Loader2,
  LogOut,
  MoreVertical,
  Move,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ViewMode = "grid" | "list";
type ActiveScope = "mine" | "shared";
type SortMode = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";
type FilterMode = "all" | "file" | "folder";

type MediaItem = {
  id: string;
  ghlId?: string;
  name: string;
  type: "file" | "folder";
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  parentId?: string | null;
  ownerName?: string;
  ownerEmail?: string | null;
  isOwner: boolean;
  sharedWithMe: boolean;
  canRename: boolean;
  canMove: boolean;
  canDelete: boolean;
  canShare: boolean;
  raw: Record<string, unknown>;
};

type Crumb = {
  id: string | null;
  name: string;
};

type DialogState =
  | { kind: "folder" }
  | { kind: "rename"; item: MediaItem }
  | { kind: "move"; item?: MediaItem }
  | { kind: "share"; items: MediaItem[] }
  | { kind: "delete"; items: MediaItem[]; status: "trashed" | "deleted" }
  | { kind: "preview"; item: MediaItem }
  | null;

type Toast = {
  type: "success" | "error" | "info";
  message: string;
};

type MediaDashboardProps = {
  initialStorageReady: boolean;
};

export function MediaDashboard({ initialStorageReady }: MediaDashboardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeScope, setActiveScope] = useState<ActiveScope>("mine");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [knownFolders, setKnownFolders] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "Files" }]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [textValue, setTextValue] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentFolder = crumbs[crumbs.length - 1];
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );
  const selectedOwnerItems = selectedItems.filter((item) => item.canMove && item.canDelete);
  const selectedShareableItems = selectedItems.filter((item) => item.canShare);
  const canBulkManage =
    selectedItems.length > 0 && selectedOwnerItems.length === selectedItems.length;
  const canBulkShare =
    selectedItems.length > 0 && selectedShareableItems.length === selectedItems.length;
  const hasStorageReady = initialStorageReady;

  const showToast = useCallback((message: string, type: Toast["type"] = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const loadMedia = useCallback(async () => {
    if (!hasStorageReady) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "100",
      });

      const [sortBy, sortOrder] =
        sortMode === "updated-desc"
          ? ["updatedAt", "desc"]
          : sortMode === "updated-asc"
            ? ["updatedAt", "asc"]
            : sortMode === "name-desc"
              ? ["name", "desc"]
              : ["name", "asc"];

      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (filterMode !== "all") params.set("type", filterMode);
      params.set("scope", activeScope);
      if (currentFolder.id) params.set("parentId", currentFolder.id);

      const payload = await requestJson<{ items?: MediaItem[] }>(
        `/api/media/files?${params.toString()}`,
      );
      const normalized = payload.items ?? normalizeMediaPayload(payload);
      setItems(normalized);
      setKnownFolders((previous) => mergeFolders(previous, normalized));
      setSelectedIds(new Set());
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  }, [activeScope, currentFolder.id, filterMode, hasStorageReady, showToast, sortMode]);

  useEffect(() => {
    if (hasStorageReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadMedia();
    }
  }, [hasStorageReady, loadMedia]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length || activeScope !== "mine") return;

    setBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("name", file.name);
        formData.set("hosted", "false");
        if (currentFolder.id) formData.set("parentId", currentFolder.id);

        await requestJson<unknown>("/api/media/upload", {
          method: "POST",
          body: formData,
        });
      }

      showToast(`${fileList.length} file${fileList.length === 1 ? "" : "s"} uploaded.`, "success");
      await loadMedia();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createFolder() {
    const name = textValue.trim();
    if (!name || activeScope !== "mine") return;

    await runMutation(async () => {
      await requestJson<unknown>("/api/media/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolder.id }),
      });
      setDialog(null);
      showToast("Folder created.", "success");
      await loadMedia();
    });
  }

  async function renameItem(item: MediaItem) {
    const name = textValue.trim();
    if (!name || !item.canRename) return;

    await runMutation(async () => {
      await requestJson<unknown>(`/api/media/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setDialog(null);
      showToast("Renamed.", "success");
      await loadMedia();
    });
  }

  async function moveSelection(item?: MediaItem) {
    const targets = item ? [item] : selectedItems;
    if (!targets.length) return;
    if (targets.some((target) => !target.canMove)) {
      showToast("Only the owner can move files or folders.", "error");
      return;
    }

    await runMutation(async () => {
      if (targets.length === 1) {
        await requestJson<unknown>(`/api/media/${encodeURIComponent(targets[0].id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: destinationId || null }),
        });
      } else {
        await requestJson<unknown>("/api/media/bulk/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filesToBeUpdated: targets.map((target) => ({
              id: target.id,
              parentId: destinationId || null,
            })),
          }),
        });
      }

      setDialog(null);
      showToast("Moved.", "success");
      await loadMedia();
    });
  }

  function openDeleteDialog(item: MediaItem) {
    if (!item.canDelete) {
      showToast("Only the owner can delete this item.", "error");
      return;
    }

    setDialog({ kind: "delete", items: [item], status: "deleted" });
  }

  function openBulkDeleteDialog(status: "trashed" | "deleted") {
    if (!selectedItems.length) return;
    if (!canBulkManage) {
      showToast("Only the owner can trash or delete selected items.", "error");
      return;
    }

    setDialog({ kind: "delete", items: selectedItems, status });
  }

  async function confirmDelete(itemsToDelete: MediaItem[], status: "trashed" | "deleted") {
    if (!itemsToDelete.length) return;
    if (itemsToDelete.some((item) => !item.canDelete)) {
      showToast("Only the owner can trash or delete selected items.", "error");
      return;
    }

    await runMutation(async () => {
      await requestJson<unknown>("/api/media/bulk/delete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          filesToBeDeleted: itemsToDelete.map((item) => ({
            id: item.id,
          })),
        }),
      });
      setDialog(null);
      setSelectedIds(new Set());
      showToast(status === "trashed" ? "Moved to trash." : "Deleted.", "success");
      await loadMedia();
    });
  }

  async function runMutation(work: () => Promise<void>) {
    setBusy(true);
    setActiveMenuId(null);
    try {
      await work();
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  }

  async function shareItems(targets: MediaItem[]) {
    const email = textValue.trim();
    if (!email || !targets.length) return;
    if (targets.some((target) => !target.canShare)) {
      showToast("Only the owner can share selected files or folders.", "error");
      return;
    }

    await runMutation(async () => {
      await requestJson<unknown>("/api/media/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          mediaObjectIds: targets.map((target) => target.id),
        }),
      });
      setDialog(null);
      showToast(
        `Shared ${targets.length} item${targets.length === 1 ? "" : "s"} with ${email}.`,
        "success",
      );
    });
  }

  async function copyLink(item: MediaItem) {
    if (!item.url) {
      showToast("This item does not expose a public URL.", "error");
      return;
    }
    await navigator.clipboard.writeText(item.url);
    showToast("Link copied.", "success");
  }

  function openFolder(item: MediaItem) {
    if (item.type !== "folder") return;
    setCrumbs((previous) => [...previous, { id: item.id, name: item.name }]);
    setSelectedIds(new Set());
  }

  function goToCrumb(index: number) {
    setCrumbs((previous) => previous.slice(0, index + 1));
    setSelectedIds(new Set());
  }

  function toggleSelected(item: MediaItem) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function openFolderDialog() {
    setTextValue("");
    setDialog({ kind: "folder" });
  }

  function openRenameDialog(item: MediaItem) {
    if (!item.canRename) return;
    setTextValue(item.name);
    setDialog({ kind: "rename", item });
  }

  function openMoveDialog(item?: MediaItem) {
    if (item && !item.canMove) return;
    setDestinationId("");
    setDialog({ kind: "move", item });
  }

  function openShareDialog(item: MediaItem) {
    if (!item.canShare) return;
    setTextValue("");
    setDialog({ kind: "share", items: [item] });
  }

  function openBulkShareDialog() {
    if (!canBulkShare) {
      showToast("Only the owner can share selected files or folders.", "error");
      return;
    }
    setTextValue("");
    setDialog({ kind: "share", items: selectedItems });
  }

  function switchScope(scope: ActiveScope) {
    setActiveScope(scope);
    setItems([]);
    setSelectedIds(new Set());
    setActiveMenuId(null);
    setCrumbs([{ id: null, name: scope === "mine" ? "Files" : "Shared with me" }]);
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7f9] text-slate-950">
      <aside
        className={`sticky top-0 relative flex h-screen shrink-0 flex-col bg-[#263244] text-slate-200 transition-[width] duration-200 ${
          collapsed ? "w-[76px]" : "w-[248px]"
        }`}
      >
        <div className="flex h-20 items-center justify-center border-b border-white/10 px-4">
          {collapsed ? (
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-blue-700 text-sm font-semibold text-white">
              T
            </div>
          ) : (
            <Image
              src="/tda-main-logo-white-horizontal-400x140.png"
              alt="TDA logo"
              width={148}
              height={52}
              priority
              className="h-auto w-[148px]"
            />
          )}
        </div>

        <nav className="flex-1 px-2 py-5">
          <button
            type="button"
            onClick={() => switchScope("mine")}
            className={`group relative flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm font-medium transition ${
              activeScope === "mine"
                ? "bg-slate-950/35 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "sr-only" : ""}>Dashboard</span>
            {collapsed ? <Tooltip label="Dashboard" /> : null}
          </button>
          <button
            type="button"
            onClick={() => switchScope("shared")}
            className={`group relative mt-2 flex h-11 w-full items-center gap-3 rounded-[8px] px-3 text-left text-sm font-medium transition ${
              activeScope === "shared"
                ? "bg-slate-950/35 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <UsersRound className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "sr-only" : ""}>Shared with me</span>
            {collapsed ? <Tooltip label="Shared with me" /> : null}
          </button>
        </nav>

        <div className="space-y-2 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="group relative flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className={collapsed ? "sr-only" : ""}>Log out</span>
            {collapsed ? <Tooltip label="Log out" /> : null}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="group absolute -right-3 top-1/2 z-40 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow transition hover:bg-slate-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">" : "<"}
        </button>
      </aside>

      <main className="min-w-0 flex-1">
        <section className="px-6 py-5">
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex h-11 min-w-[280px] flex-[1_1_420px] items-center gap-3 rounded-[8px] border border-slate-300 bg-white px-3 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
              <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search media or folders"
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-11 shrink-0 rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="updated-desc">Modified: Newest first</option>
              <option value="updated-asc">Modified: Oldest first</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
            </select>
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
              className="h-11 shrink-0 rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All</option>
              <option value="folder">Folders</option>
              <option value="file">Files</option>
            </select>
            <SegmentedButton
              active={viewMode === "grid"}
              label="Grid view"
              onClick={() => setViewMode("grid")}
              icon={<Grid2X2 className="h-4 w-4" aria-hidden="true" />}
            />
            <SegmentedButton
              active={viewMode === "list"}
              label="List view"
              onClick={() => setViewMode("list")}
              icon={<List className="h-4 w-4" aria-hidden="true" />}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasStorageReady || activeScope !== "mine" || busy}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void uploadFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={openFolderDialog}
              disabled={!hasStorageReady || activeScope !== "mine" || busy}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              New folder
            </button>
            <button
              type="button"
              onClick={() => void loadMedia()}
              disabled={!hasStorageReady || loading}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {crumbs.length > 1 ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              {crumbs.map((crumb, index) => (
                <div key={`${crumb.id ?? "root"}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
                  <button
                    type="button"
                    onClick={() => goToCrumb(index)}
                    className="rounded-[6px] px-1 py-0.5 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

            {selectedItems.length ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[8px] border border-blue-200 bg-blue-50 px-2 py-2">
                <span className="px-2 text-sm font-medium text-blue-800">
                  {selectedItems.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => openMoveDialog()}
                  disabled={!canBulkManage}
                  className="inline-flex h-8 items-center gap-1 rounded-[6px] bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Move className="h-4 w-4" aria-hidden="true" />
                  Move
                </button>
                <button
                  type="button"
                  onClick={openBulkShareDialog}
                  disabled={!canBulkShare}
                  className="inline-flex h-8 items-center gap-1 rounded-[6px] bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => openBulkDeleteDialog("trashed")}
                  disabled={!canBulkManage}
                  className="inline-flex h-8 items-center gap-1 rounded-[6px] bg-white px-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Trash
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="grid h-8 w-8 place-items-center rounded-[6px] bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

          {!hasStorageReady ? (
            <SetupPanel
              title="Media storage is unavailable"
              description="The file storage backend has not been configured yet. Contact the administrator to finish setup."
            />
          ) : (
            <div className="min-h-[520px]">
              {loading ? (
                <div className="grid h-[420px] place-items-center rounded-[8px] border border-slate-200 bg-white">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
                    Loading media
                  </div>
                </div>
              ) : visibleItems.length ? (
                viewMode === "grid" ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
                    {visibleItems.map((item) => (
                      <MediaCard
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        activeMenu={activeMenuId === item.id}
                        onSelect={() => toggleSelected(item)}
                        onOpen={() => openFolder(item)}
                        onMenu={() =>
                          setActiveMenuId((current) => (current === item.id ? null : item.id))
                        }
                        onPreview={() => setDialog({ kind: "preview", item })}
                        onCopy={() => void copyLink(item)}
                        onRename={() => openRenameDialog(item)}
                        onMove={() => openMoveDialog(item)}
                        onShare={() => openShareDialog(item)}
                        onDelete={() => openDeleteDialog(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-visible rounded-[8px] border border-slate-200 bg-white">
                    {visibleItems.map((item) => (
                      <MediaRow
                        key={item.id}
                        item={item}
                        selected={selectedIds.has(item.id)}
                        activeMenu={activeMenuId === item.id}
                        onSelect={() => toggleSelected(item)}
                        onOpen={() => openFolder(item)}
                        onMenu={() =>
                          setActiveMenuId((current) => (current === item.id ? null : item.id))
                        }
                        onPreview={() => setDialog({ kind: "preview", item })}
                        onCopy={() => void copyLink(item)}
                        onRename={() => openRenameDialog(item)}
                        onMove={() => openMoveDialog(item)}
                        onShare={() => openShareDialog(item)}
                        onDelete={() => openDeleteDialog(item)}
                      />
                    ))}
                  </div>
                )
              ) : (
                <EmptyMedia
                  onUpload={() => fileInputRef.current?.click()}
                  onCreateFolder={openFolderDialog}
                  canCreate={activeScope === "mine"}
                />
              )}
            </div>
          )}
        </section>
      </main>

      {dialog ? (
        <Dialog onClose={() => setDialog(null)}>
          {dialog.kind === "preview" ? (
            <PreviewDialog item={dialog.item} onClose={() => setDialog(null)} onCopy={() => void copyLink(dialog.item)} />
          ) : dialog.kind === "move" ? (
            <FormDialog
              title={dialog.item ? `Move ${dialog.item.name}` : `Move ${selectedItems.length} items`}
              description="Choose a destination folder. Use root to move the item out of its current folder."
              primaryLabel="Move"
              onPrimary={() => void moveSelection(dialog.item)}
              onClose={() => setDialog(null)}
            >
              <label className="text-sm font-medium text-slate-700" htmlFor="destination">
                Destination
              </label>
              <select
                id="destination"
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
                className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Files</option>
                {knownFolders
                  .filter((folder) => folder.id !== dialog.item?.id)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </FormDialog>
          ) : dialog.kind === "rename" ? (
            <FormDialog
              title="Rename"
              description="Update the display name in media storage."
              primaryLabel="Rename"
              onPrimary={() => void renameItem(dialog.item)}
              onClose={() => setDialog(null)}
            >
              <NameField value={textValue} onChange={setTextValue} label="Name" />
            </FormDialog>
          ) : dialog.kind === "share" ? (
            <FormDialog
              title={
                dialog.items.length === 1
                  ? `Share ${dialog.items[0].name}`
                  : `Share ${dialog.items.length} items`
              }
              description="Enter the email address that should get access to the selected files or folders."
              primaryLabel="Share"
              onPrimary={() => void shareItems(dialog.items)}
              onClose={() => setDialog(null)}
            >
              <NameField value={textValue} onChange={setTextValue} label="Email address" />
            </FormDialog>
          ) : dialog.kind === "delete" ? (
            <ConfirmDeleteDialog
              items={dialog.items}
              status={dialog.status}
              onClose={() => setDialog(null)}
              onConfirm={() => void confirmDelete(dialog.items, dialog.status)}
            />
          ) : (
            <FormDialog
              title="Create folder"
              description="Create a folder in the current location."
              primaryLabel="Create"
              onPrimary={() => void createFolder()}
              onClose={() => setDialog(null)}
            >
              <NameField value={textValue} onChange={setTextValue} label="Folder name" />
            </FormDialog>
          )}
        </Dialog>
      ) : null}

      {toast ? <ToastView toast={toast} /> : null}
      {busy ? (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-[8px] bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Working
        </div>
      ) : null}
    </div>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-[6px] bg-slate-950 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
      {label}
    </span>
  );
}

function SegmentedButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`grid h-11 w-11 place-items-center rounded-[8px] border text-slate-600 transition ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-300 bg-white hover:bg-slate-50"
      }`}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function MediaCard(props: MediaEntryProps) {
  const { item, selected, onSelect, onOpen, activeMenu, onMenu } = props;
  const preview = item.thumbnailUrl || item.url;

  return (
    <article className="group relative overflow-visible rounded-[8px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={item.type === "folder" ? onOpen : props.onPreview}
        className="block aspect-[1.42] w-full bg-slate-100 text-left"
      >
        {item.type === "folder" ? (
          <div className="flex h-full items-center justify-center bg-slate-100">
            <Folder className="h-14 w-14 text-slate-400" aria-hidden="true" />
          </div>
        ) : preview && isImageItem(item) ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `linear-gradient(to bottom, transparent 45%, rgba(15, 23, 42, 0.7)), url("${preview}")` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-100">
            <FileText className="h-14 w-14 text-slate-400" aria-hidden="true" />
          </div>
        )}
      </button>

      <div className="absolute left-3 top-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${item.name}`}
          className="h-4 w-4 rounded border-slate-300"
        />
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        {item.url ? (
          <button
            type="button"
            onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
            className="grid h-8 w-8 place-items-center rounded-[6px] bg-white text-slate-700 shadow-sm"
            title="Download"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onMenu}
          className="grid h-8 w-8 place-items-center rounded-[6px] bg-white text-slate-700 shadow-sm"
          title="More actions"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 text-white">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="mt-1 text-xs text-white/75">
          {item.sharedWithMe
            ? `Owner: ${item.ownerName ?? "Unknown"}`
            : item.type === "folder"
              ? "Folder"
              : formatBytes(item.size)}
        </p>
      </div>

      {activeMenu ? <EntryMenu {...props} /> : null}
    </article>
  );
}

function MediaRow(props: MediaEntryProps) {
  const { item, selected, onSelect, onOpen, activeMenu, onMenu } = props;

  return (
    <div className="relative grid grid-cols-[44px_1fr_130px_180px_150px_48px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        aria-label={`Select ${item.name}`}
        className="h-4 w-4 rounded border-slate-300"
      />
      <button
        type="button"
        onClick={item.type === "folder" ? onOpen : props.onPreview}
        className="flex min-w-0 items-center gap-3 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-slate-100 text-slate-500">
          {item.type === "folder" ? (
            <Folder className="h-5 w-5" aria-hidden="true" />
          ) : isImageItem(item) ? (
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FileText className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{item.name}</span>
          <span className="block text-xs text-slate-500">{item.mimeType || item.type}</span>
        </span>
      </button>
      <span className="text-sm text-slate-500">{item.type === "folder" ? "Folder" : formatBytes(item.size)}</span>
      <span className="truncate text-sm text-slate-500">
        {item.sharedWithMe ? item.ownerName || "Unknown owner" : "Owner"}
      </span>
      <span className="text-sm text-slate-500">{formatDate(item.updatedAt || item.createdAt)}</span>
      <button
        type="button"
        onClick={onMenu}
        className="grid h-8 w-8 place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        title="More actions"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {activeMenu ? <EntryMenu {...props} /> : null}
    </div>
  );
}

type MediaEntryProps = {
  item: MediaItem;
  selected: boolean;
  activeMenu: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMenu: () => void;
  onPreview: () => void;
  onCopy: () => void;
  onRename: () => void;
  onMove: () => void;
  onShare: () => void;
  onDelete: () => void;
};

function EntryMenu({
  item,
  onPreview,
  onCopy,
  onRename,
  onMove,
  onShare,
  onDelete,
}: MediaEntryProps) {
  return (
    <div className="absolute right-3 top-12 z-[80] w-48 overflow-hidden rounded-[8px] border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl">
      {item.type === "file" ? (
        <MenuAction icon={<Eye className="h-4 w-4" />} label="Preview" onClick={onPreview} />
      ) : null}
      <MenuAction icon={<Link2 className="h-4 w-4" />} label="Get link" onClick={onCopy} />
      {item.canShare ? (
        <MenuAction icon={<Share2 className="h-4 w-4" />} label="Share" onClick={onShare} />
      ) : null}
      {item.canRename ? (
        <MenuAction icon={<Pencil className="h-4 w-4" />} label="Rename" onClick={onRename} />
      ) : null}
      {item.canMove ? (
        <MenuAction icon={<Move className="h-4 w-4" />} label="Move to folder" onClick={onMove} />
      ) : null}
      {item.canDelete ? (
        <>
          <div className="my-1 h-px bg-slate-100" />
          <MenuAction
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete"
            onClick={onDelete}
            danger
          />
        </>
      ) : null}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-3 px-3 text-left transition hover:bg-slate-50 ${
        danger ? "text-red-600" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SetupPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-[8px] border border-slate-200 bg-white px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-[8px] bg-blue-50 text-blue-700">
          <Folder className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-normal text-slate-950">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function EmptyMedia({
  onUpload,
  onCreateFolder,
  canCreate,
}: {
  onUpload: () => void;
  onCreateFolder: () => void;
  canCreate: boolean;
}) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-[8px] border border-dashed border-slate-300 bg-white px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-[8px] bg-slate-100 text-slate-500">
          <UploadCloud className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-slate-950">No media here</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {canCreate
            ? "Upload files or create a folder in this location."
            : "Files and folders shared with you will appear here."}
        </p>
        {canCreate ? (
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={onUpload}
              className="h-10 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={onCreateFolder}
              className="h-10 rounded-[8px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              New folder
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/40 px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[8px] bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function FormDialog({
  title,
  description,
  primaryLabel,
  onPrimary,
  onClose,
  children,
}: {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onPrimary();
      }}
    >
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="p-5">{children}</div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[8px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-10 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          {primaryLabel}
        </button>
      </div>
    </form>
  );
}

function ConfirmDeleteDialog({
  items,
  status,
  onClose,
  onConfirm,
}: {
  items: MediaItem[];
  status: "trashed" | "deleted";
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isDelete = status === "deleted";
  const count = items.length;
  const singleName = count === 1 ? items[0].name : null;
  const title = isDelete
    ? count === 1
      ? "Delete item"
      : `Delete ${count} items`
    : count === 1
      ? "Move item to trash"
      : `Move ${count} items to trash`;
  const description = isDelete
    ? singleName
      ? `Are you sure you want to delete "${singleName}"? This removes it from your dashboard and media storage.`
      : `Are you sure you want to delete ${count} selected items? This removes them from your dashboard and media storage.`
    : singleName
      ? `Are you sure you want to move "${singleName}" to trash? It will no longer appear in your dashboard.`
      : `Are you sure you want to move ${count} selected items to trash? They will no longer appear in your dashboard.`;

  return (
    <div>
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-[8px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="h-10 rounded-[8px] bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          {isDelete ? "Delete" : "Move to trash"}
        </button>
      </div>
    </div>
  );
}

function NameField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="text-sm font-medium text-slate-700" htmlFor="name-field">
        {label}
      </label>
      <input
        id="name-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </>
  );
}

function PreviewDialog({
  item,
  onClose,
  onCopy,
}: {
  item: MediaItem;
  onClose: () => void;
  onCopy: () => void;
}) {
  const preview = item.thumbnailUrl || item.url;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950">{item.name}</h2>
          <p className="text-sm text-slate-500">{item.mimeType || item.type}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-auto bg-slate-100 p-4 media-scrollbar">
        {preview && isImageItem(item) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={item.name}
            className="mx-auto max-h-[58vh] rounded-[8px] object-contain"
          />
        ) : (
          <div className="grid h-64 place-items-center rounded-[8px] bg-white">
            <FileText className="h-16 w-16 text-slate-300" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-white p-4">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy link
        </button>
        {item.url ? (
          <button
            type="button"
            onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Open
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  const icon =
    toast.type === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
    ) : toast.type === "error" ? (
      <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
    ) : (
      <AlertCircle className="h-4 w-4 text-blue-500" aria-hidden="true" />
    );

  return (
    <div className="fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-[8px] border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-xl">
      {icon}
      <span>{toast.message}</span>
    </div>
  );
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

function normalizeMediaPayload(payload: unknown): MediaItem[] {
  const record = asRecord(payload);
  const possibleArrays = [
    record?.files,
    record?.folders,
    record?.data,
    record?.items,
    record?.medias,
    payload,
  ];
  const array = possibleArrays.find(Array.isArray) as unknown[] | undefined;

  if (!array) return [];

  return array
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => Boolean(value))
    .map((value) => {
      const id = readString(value, ["_id", "id", "fileId", "folderId", "mediaId"]) || crypto.randomUUID();
      const name = readString(value, ["name", "fileName", "title", "originalname"]) || "Untitled";
      const url = readString(value, ["url", "fileUrl", "mediaUrl", "secureUrl", "publicUrl"]);
      const thumbnailUrl = readString(value, ["thumbnailUrl", "thumbnail", "previewUrl"]);
      const mimeType = readString(value, ["mimeType", "mimetype", "contentType", "type"]);
      const explicitType = readString(value, ["mediaType", "objectType", "resourceType", "entityType"]);
      const isFolder =
        explicitType?.toLowerCase().includes("folder") ||
        readString(value, ["type"])?.toLowerCase() === "folder" ||
        Boolean(value.folder);

      return {
        id,
        ghlId: readString(value, ["ghlId", "_id", "id", "fileId", "folderId", "mediaId"]),
        name,
        type: isFolder ? "folder" : "file",
        url,
        thumbnailUrl,
        mimeType,
        size: readNumber(value, ["size", "fileSize", "bytes"]),
        createdAt: readString(value, ["createdAt", "dateAdded"]),
        updatedAt: readString(value, ["updatedAt", "modifiedAt"]),
        parentId: readString(value, ["parentId", "folderId"]) ?? null,
        ownerName: readString(value, ["ownerName", "ownerEmail"]),
        ownerEmail: readString(value, ["ownerEmail"]),
        isOwner: value.isOwner !== false,
        sharedWithMe: value.sharedWithMe === true,
        canRename: value.canRename !== false,
        canMove: value.canMove !== false,
        canDelete: value.canDelete !== false,
        canShare: value.canShare !== false,
        raw: value,
      };
    });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const number = Number(value);
      if (!Number.isNaN(number)) return number;
    }
  }
  return undefined;
}

function mergeFolders(previous: MediaItem[], next: MediaItem[]) {
  const map = new Map(previous.map((folder) => [folder.id, folder]));
  next
    .filter((item) => item.type === "folder" && item.isOwner)
    .forEach((folder) => map.set(folder.id, folder));
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function isImageItem(item: MediaItem) {
  return (
    item.mimeType?.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(item.name) ||
    Boolean(item.thumbnailUrl)
  );
}

function formatBytes(size?: number) {
  if (!size) return "File";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}
