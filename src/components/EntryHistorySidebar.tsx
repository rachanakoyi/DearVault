import React, { useState, useMemo } from "react";
import { JournalEntry } from "../types";
import {
  Plus,
  Search,
  BookOpen,
  Trash2,
  Calendar,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Filter,
} from "lucide-react";

interface EntryHistorySidebarProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (entryId: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const EntryHistorySidebar: React.FC<EntryHistorySidebarProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const availableMoods = useMemo(() => {
    const moods = new Set<string>();
    entries.forEach((e) => {
      if (e.mood) moods.add(e.mood);
    });
    return Array.from(moods);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMood = selectedMood === "all" || entry.mood === selectedMood;
      return matchesSearch && matchesMood;
    });
  }, [entries, searchQuery, selectedMood]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-stone-900/40 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-80 bg-stone-100/90 border-r border-stone-200/90 flex flex-col h-full transform transition-transform duration-200 ease-in-out ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Top Action Bar */}
        <div className="p-4 border-b border-stone-200 bg-white/60">
          <button
            id="new-entry-btn"
            onClick={() => {
              onNewEntry();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-[0.98] font-medium text-sm transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Entry</span>
          </button>

          {/* Search Input */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-500" />
            <input
              id="search-entries-input"
              type="text"
              placeholder="Search reflections & entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900 placeholder:text-stone-500"
            />
          </div>

          {/* Mood filter if multiple exist */}
          {availableMoods.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <Filter className="w-3 h-3 text-stone-500 shrink-0" />
              <button
                onClick={() => setSelectedMood("all")}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  selectedMood === "all"
                    ? "bg-stone-800 text-stone-50 font-medium"
                    : "bg-stone-200/70 text-stone-600 hover:bg-stone-200"
                }`}
              >
                All
              </button>
              {availableMoods.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMood(m)}
                  className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                    selectedMood === m
                      ? "bg-stone-800 text-stone-50 font-medium"
                      : "bg-stone-200/70 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Entries Count Header */}
        <div className="px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-stone-500 flex items-center justify-between">
          <span>Journal History</span>
          <span className="bg-stone-200/70 px-1.5 py-0.5 rounded text-stone-600">
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Entries List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1.5">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-stone-600 text-xs">
              <BookOpen className="w-8 h-8 mx-auto text-stone-400 mb-2 stroke-1" />
              <p className="font-medium text-stone-600">No journal entries found.</p>
              <p className="text-stone-500 mt-1">
                {searchQuery
                  ? "Try adjusting your search terms."
                  : "Click 'New Journal Entry' to write your first reflection."}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              const interactionCount = entry.messages?.length || 0;

              return (
                <div
                  key={entry.id}
                  id={`entry-item-${entry.id}`}
                  onClick={() => {
                    onSelectEntry(entry);
                    onCloseMobile();
                  }}
                  className={`group relative p-3 rounded-xl cursor-pointer transition-all border text-left ${
                    isActive
                      ? "bg-white border-stone-300 shadow-xs ring-1 ring-stone-400/20"
                      : "bg-white/50 hover:bg-white border-transparent hover:border-stone-200 text-stone-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <h4
                      className={`text-xs font-semibold truncate flex-1 ${
                        isActive ? "text-stone-900" : "text-stone-800"
                      }`}
                    >
                      {entry.title || "Untitled Reflection"}
                    </h4>
                    <span className="text-[10px] text-stone-600 shrink-0 flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(entry.updatedAt || entry.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-600 line-clamp-2 mt-1 leading-snug">
                    {entry.content || "(No written text yet...)"}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-stone-600">
                    <div className="flex items-center gap-1.5">
                      {entry.mood && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100/70 text-amber-800 font-medium">
                          {entry.mood}
                        </span>
                      )}
                      {interactionCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-stone-600">
                          <MessageSquare className="w-2.5 h-2.5 text-stone-600" />
                          {interactionCount}
                        </span>
                      )}
                      {entry.summary && (
                        <span className="inline-flex items-center gap-0.5 text-purple-700">
                          <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                          Synthesized
                        </span>
                      )}
                    </div>

                    {/* Delete entry button */}
                    <button
                      title="Delete Entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEntryToDelete(entry.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {entryToDelete && (
          <div className="fixed inset-0 bg-stone-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900">Delete Journal Entry?</h3>
              <p className="text-xs text-stone-600 mt-2">
                This entry and all associated Gemini reflection history will be permanently removed from your isolated Firestore storage. This action cannot be undone.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEntryToDelete(null)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  id="confirm-delete-entry-btn"
                  onClick={() => {
                    onDeleteEntry(entryToDelete);
                    setEntryToDelete(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-xs"
                >
                  Delete Entry
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
