import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  EntryService,
} from "@bindings/nst-go/cmd/nst-desktop";
import { TranslationStatus, type TextEntry } from "@bindings/nst-go/pkg/model";
import type { FileSummary } from "@bindings/nst-go/pkg/storage";
import { TokenizedText } from "@/components/ui/tokenized-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import {
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Rocket,
} from "lucide-react";

interface EditorPageProps {
  onOpenTranslate: () => void;
  onOpenDeploy: () => void;
  selectedFile: string;
  onSelectFile: (file: string) => void;
  onStatsUpdated: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
  onOpenTranslate,
  onOpenDeploy,
  selectedFile,
  onSelectFile,
  onStatsUpdated,
}) => {
  // 1. Files state
  const [files, setFiles] = useState<FileSummary[]>([]);
  const [fileFilterSearch, setFileFilterSearch] = useState("");
  const [leftPanelWidth, setLeftPanelWidth] = useState(240);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  // 2. Query filter state
  const [statusFilter, setStatusFilter] = useState<"all" | "untranslated" | "translated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 3. Entries & Pagination state
  const [entries, setEntries] = useState<TextEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  // 4. Active selected entry & inline editing
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Keyboard shortcut: Ctrl+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load files list
  const loadFiles = useCallback(async () => {
    try {
      const fList = await EntryService.Files();
      setFiles(fList || []);
    } catch (err) {
      console.error("Failed to load files list:", err);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Load entries query
  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await EntryService.Query({
        file: selectedFile || "all",
        status: statusFilter,
        search: debouncedSearch,
        limit: pageSize,
        offset: page * pageSize,
      });

      setEntries(res.entries || []);
      setTotalCount(res.total || 0);

      // Default select first item if none selected or index out of range
      if (res.entries && res.entries.length > 0) {
        setSelectedIndex((prev) =>
          prev !== null && prev < res.entries.length ? prev : 0
        );
      } else {
        setSelectedIndex(null);
      }
    } catch (err: any) {
      toast.error(`Failed to load entries: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [selectedFile, statusFilter, debouncedSearch, page]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Active entry selected for bottom detail pane
  const activeEntry =
    selectedIndex !== null && selectedIndex < entries.length
      ? entries[selectedIndex]
      : null;

  // Virtualizer for the table list
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36, // fixed 36px row height
    overscan: 10,
  });

  // Handle saving an edit for a single entry
  const commitEdit = async (id: string, newTarget: string) => {
    if (newTarget === originalValue) {
      setEditingId(null);
      return;
    }

    try {
      await EntryService.Update(id, newTarget);

      // Local update without refetching entire list
      setEntries((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                target: newTarget,
                status:
                  newTarget.trim() !== ""
                    ? TranslationStatus.StatusTranslated
                    : TranslationStatus.StatusUntranslated,
              }
            : item
        )
      );

      toast.success("Saved");
      loadFiles();
      onStatsUpdated();
    } catch (err: any) {
      toast.error(`Failed to save: ${err?.message || err}`);
    } finally {
      setEditingId(null);
    }
  };

  // Start editing a row
  const startEditing = (entry: TextEntry) => {
    setEditingId(entry.id);
    setEditValue(entry.target || "");
    setOriginalValue(entry.target || "");
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue(originalValue);
  };

  // Left Panel resize dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLeft) return;
      const newWidth = Math.max(160, Math.min(420, e.clientX));
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
    };

    if (isResizingLeft) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingLeft]);

  // Filtered files list
  const filteredFiles = files.filter((f) =>
    f.path.toLowerCase().includes(fileFilterSearch.toLowerCase())
  );

  const totalAllFiles = files.reduce((acc, f) => acc + f.total, 0);
  const translatedAllFiles = files.reduce((acc, f) => acc + f.translated, 0);

  return (
    <div className="flex-1 flex flex-row overflow-hidden bg-[#1a1a1a]">
      {/* 1. Left Panel: File List */}
      <div
        style={{ width: `${leftPanelWidth}px` }}
        className="shrink-0 bg-[#202020] border-r border-[#303030] flex flex-col select-none relative"
      >
        {/* Panel Header */}
        <div className="p-2 border-b border-[#303030] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#3399ff]" />
              Files ({files.length})
            </span>
          </div>
          <Input
            value={fileFilterSearch}
            onChange={(e) => setFileFilterSearch(e.target.value)}
            placeholder="Filter files…"
            className="h-6 text-xs px-2 bg-[#1a1a1a]"
          />
        </div>

        {/* File items list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#282828] text-xs">
          {/* All Files item */}
          <div
            onClick={() => {
              onSelectFile("all");
              setPage(0);
            }}
            className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
              selectedFile === "all" || !selectedFile
                ? "bg-[#3399ff]/20 text-[#70baff] font-semibold"
                : "text-[#d0d0d0] hover:bg-[#282828]"
            }`}
          >
            <span className="truncate">All Files</span>
            <span className="font-mono text-[10px] text-[#888888]">
              {translatedAllFiles}/{totalAllFiles}
            </span>
          </div>

          {filteredFiles.map((f) => {
            const isSelected = selectedFile === f.path;
            const pct = f.total > 0 ? (f.translated / f.total) * 100 : 0;
            return (
              <div
                key={f.path}
                onClick={() => {
                  onSelectFile(f.path);
                  setPage(0);
                }}
                className={`px-3 py-2 cursor-pointer flex flex-col gap-1 transition-colors ${
                  isSelected
                    ? "bg-[#3399ff]/20 text-[#70baff] font-semibold"
                    : "text-[#d0d0d0] hover:bg-[#282828]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate" title={f.path}>
                    {f.path}
                  </span>
                  <span className="font-mono text-[10px] text-[#888888] shrink-0">
                    {f.translated}/{f.total}
                  </span>
                </div>
                <div className="w-full bg-[#181818] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3399ff] h-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Resizer Handle */}
        <div
          onMouseDown={() => setIsResizingLeft(true)}
          className="absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 cursor-col-resize hover:bg-[#3399ff] transition-all z-10"
        />
      </div>

      {/* 2. Main Grid & Detail Pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-10 bg-[#222222] border-b border-[#303030] px-3 flex items-center justify-between gap-2 text-xs shrink-0 select-none">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-md border border-[#333333]">
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(0);
              }}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === "all"
                  ? "bg-[#3399ff] text-white font-medium"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter("untranslated");
                setPage(0);
              }}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === "untranslated"
                  ? "bg-rose-600 text-white font-medium"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              Untranslated
            </button>
            <button
              onClick={() => {
                setStatusFilter("translated");
                setPage(0);
              }}
              className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                statusFilter === "translated"
                  ? "bg-emerald-600 text-white font-medium"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              Translated
            </button>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-sm relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#777777]" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search source or translation… (Ctrl+F)"
              className="h-7 pl-8 pr-7 text-xs bg-[#1a1a1a]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-xs text-[#777777] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenTranslate}
              className="h-7 text-xs gap-1"
            >
              <Sparkles className="w-3 h-3 text-[#3399ff]" />
              AI Translate…
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenDeploy}
              className="h-7 text-xs gap-1"
            >
              <Rocket className="w-3 h-3 text-amber-400" />
              Deploy…
            </Button>
          </div>
        </div>

        {/* Virtualized Table Grid */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto bg-[#181818] relative"
        >
          {/* Header Row */}
          <div className="sticky top-0 z-20 bg-[#222222] border-b border-[#333333] flex text-xs font-semibold text-[#888888] select-none h-7 items-center">
            <div className="w-9 px-2 text-center">#</div>
            <div className="w-48 px-2 truncate">File & Key</div>
            <div className="flex-1 px-3 truncate">Original Source</div>
            <div className="flex-1 px-3 truncate">Target Translation</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#777777]">
              Loading entries…
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#777777]">
              No entries match the current filter or search.
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const entry = entries[virtualRow.index];
                const isSelected = selectedIndex === virtualRow.index;
                const isEditing = editingId === entry.id;
                const isTranslated =
                  (entry.target ?? "").trim() !== "" &&
                  entry.status !== "untranslated";

                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedIndex(virtualRow.index)}
                    onDoubleClick={() => startEditing(entry)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`flex items-center text-xs border-b border-[#242424] cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#283747] text-white"
                        : virtualRow.index % 2 === 0
                        ? "bg-[#1c1c1c] text-[#d8d8d8] hover:bg-[#252525]"
                        : "bg-[#181818] text-[#d8d8d8] hover:bg-[#252525]"
                    }`}
                  >
                    {/* Status Dot */}
                    <div className="w-9 px-2 flex items-center justify-center">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isTranslated ? "bg-emerald-400" : "bg-rose-500"
                        }`}
                        title={isTranslated ? "Translated" : "Untranslated"}
                      />
                    </div>

                    {/* Key / File path */}
                    <div
                      className="w-48 px-2 font-mono text-[11px] text-[#808080] truncate"
                      title={`${entry.file_path} :: ${entry.key_path}`}
                    >
                      <span className="text-[#a0a0a0]">{entry.file_path}</span>
                      <span className="text-[#555555]"> : </span>
                      <span>{entry.key_path}</span>
                    </div>

                    {/* Source Text (Clipped with Tokenized formatting) */}
                    <div className="flex-1 px-3 truncate">
                      <TokenizedText
                        text={entry.source}
                        highlightSearch={debouncedSearch}
                      />
                    </div>

                    {/* Target Translation (Inline editable) */}
                    <div className="flex-1 px-3 truncate">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(entry.id, editValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              commitEdit(entry.id, editValue);
                            } else if (e.key === "Escape") {
                              cancelEdit();
                            }
                          }}
                          className="w-full bg-[#111111] text-white px-1.5 py-0.5 rounded border border-[#3399ff] focus:outline-none font-mono text-xs"
                        />
                      ) : (
                        <span
                          className={
                            (entry.target ?? "").trim()
                              ? "text-emerald-300 font-mono text-xs"
                              : "text-[#555555] italic text-xs"
                          }
                        >
                          {(entry.target ?? "").trim() ? (
                            <TokenizedText
                              text={entry.target || ""}
                              highlightSearch={debouncedSearch}
                            />
                          ) : (
                            "(untranslated)"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="h-7 bg-[#202020] border-t border-[#303030] px-3 flex items-center justify-between text-[11px] text-[#888888] select-none shrink-0">
          <span>
            Showing {Math.min(totalCount, page * pageSize + 1)}–
            {Math.min(totalCount, (page + 1) * pageSize)} of{" "}
            {totalCount.toLocaleString()} items
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-5 px-1.5 text-xs text-[#a0a0a0] disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
            <span className="font-mono text-white">
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(page + 1) * pageSize >= totalCount}
              onClick={() => setPage((p) => p + 1)}
              className="h-5 px-1.5 text-xs text-[#a0a0a0] disabled:opacity-30"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* 3. Bottom Detail Panel */}
        <div className="h-44 bg-[#202020] border-t border-[#303030] flex flex-col shrink-0 p-3 select-none">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#2c2c2c] text-xs">
            <span className="font-semibold text-white flex items-center gap-2">
              <span>Selected Entry Detail</span>
              {activeEntry && (
                <span className="font-mono text-[11px] text-[#888888] font-normal">
                  {activeEntry.file_path} :: {activeEntry.key_path}
                </span>
              )}
            </span>

            {activeEntry && (
              <span className="text-[11px] text-[#777777]">
                Press <kbd className="px-1 py-0.5 bg-[#2a2a2a] rounded text-white">Ctrl+Enter</kbd> to save & advance
              </span>
            )}
          </div>

          {activeEntry ? (
            <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden text-xs">
              {/* Source Box */}
              <div className="flex flex-col bg-[#181818] border border-[#303030] rounded p-2 overflow-y-auto">
                <span className="text-[10px] uppercase font-bold text-[#3399ff] mb-1">
                  Source (Original)
                </span>
                <div className="flex-1 select-text">
                  <TokenizedText
                    text={activeEntry.source}
                    highlightSearch={debouncedSearch}
                  />
                </div>
              </div>

              {/* Target Box (Interactive Textarea) */}
              <div className="flex flex-col bg-[#181818] border border-[#303030] rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    Target (Translation)
                  </span>
                  <span className="text-[10px] text-[#666666]">
                    Status: {activeEntry.status}
                  </span>
                </div>

                <textarea
                  value={editingId === activeEntry.id ? editValue : (activeEntry.target || "")}
                  onChange={(e) => {
                    if (editingId !== activeEntry.id) {
                      setEditingId(activeEntry.id);
                      setOriginalValue(activeEntry.target || "");
                    }
                    setEditValue(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitEdit(activeEntry.id, editValue);
                      // Advance to next row
                      if (selectedIndex !== null && selectedIndex + 1 < entries.length) {
                        setSelectedIndex(selectedIndex + 1);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (editingId === activeEntry.id) {
                      commitEdit(activeEntry.id, editValue);
                    }
                  }}
                  placeholder="Type translated text here…"
                  className="flex-1 bg-transparent text-white font-mono text-xs resize-none focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#666666] italic">
              Select a row in the grid above to view and edit its translation
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
