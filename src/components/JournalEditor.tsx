import React, { useEffect, useState, useRef } from "react";
import { JournalEntry, ReflectionMode } from "../types";
import {
  Sparkles,
  Save,
  Check,
  AlertCircle,
  Clock,
  Lightbulb,
  FileText,
  HeartHandshake,
  Tag,
} from "lucide-react";
import { MemoryScannerCard } from "./MemoryScannerCard";

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (entryId: string, updated: Partial<JournalEntry>) => void;
  onTriggerReflection: (mode: ReflectionMode, customPrompt?: string) => void;
  isSaving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
  isGenerating: boolean;
  userId: string;
  onMemorySaved?: () => void;
}

const MOOD_OPTIONS = [
  { label: "Reflective", emoji: "🧘" },
  { label: "Grateful", emoji: "☀️" },
  { label: "Inspired", emoji: "💡" },
  { label: "Overwhelmed", emoji: "🌊" },
  { label: "Focused", emoji: "🎯" },
  { label: "Seeking Clarity", emoji: "🌿" },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdateEntry,
  onTriggerReflection,
  isSaving,
  saveError,
  onRetrySave,
  isGenerating,
  userId,
  onMemorySaved,
}) => {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [mood, setMood] = useState(entry.mood || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(entry.tags || []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Debounced auto-save notification to parent
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSynchronizedEntryIdRef = useRef(entry.id);

  // Sync state strictly when the active entry ID changes
  useEffect(() => {
    if (lastSynchronizedEntryIdRef.current !== entry.id) {
      lastSynchronizedEntryIdRef.current = entry.id;
      setTitle(entry.title);
      setContent(entry.content);
      setMood(entry.mood || "");
      setTags(entry.tags || []);
      setHasUnsavedChanges(false);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [entry.id, entry.title, entry.content, entry.mood, entry.tags]);

  // Clean up pending auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(true);
    triggerAutoSave({ title: newTitle, content, mood, tags });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(true);
    triggerAutoSave({ title, content: newContent, mood, tags });
  };

  const handleMoodSelect = (selectedMood: string) => {
    const updated = mood === selectedMood ? "" : selectedMood;
    setMood(updated);
    setHasUnsavedChanges(true);
    triggerAutoSave({ title, content, mood: updated, tags });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/^#/, "");
      if (!tags.includes(cleanTag)) {
        const newTags = [...tags, cleanTag];
        setTags(newTags);
        setHasUnsavedChanges(true);
        triggerAutoSave({ title, content, mood, tags: newTags });
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    setHasUnsavedChanges(true);
    triggerAutoSave({ title, content, mood, tags: newTags });
  };

  const triggerAutoSave = (data: Partial<JournalEntry>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const targetEntryId = entry.id;
    timeoutRef.current = setTimeout(() => {
      onUpdateEntry(targetEntryId, data);
      setHasUnsavedChanges(false);
      timeoutRef.current = null;
    }, 800);
  };

  const handleExplicitSave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onUpdateEntry(entry.id, { title, content, mood, tags });
    setHasUnsavedChanges(false);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
      {/* Top Sub-Header & Status */}
      <div className="p-3.5 sm:px-6 border-b border-stone-200/60 flex flex-wrap items-center justify-between gap-3 bg-[#fcfcfb]">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>
            {new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span>•</span>
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} chars</span>
        </div>

        {/* Save Status & Action */}
        <div className="flex items-center gap-2">
          {saveError ? (
            <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 px-2.5 py-1 rounded-md border border-red-200">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Save failed</span>
              <button
                onClick={onRetrySave}
                className="underline font-semibold hover:text-red-900 ml-1 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : isSaving ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Saving to Firestore...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
              <Check className="w-3 h-3 text-emerald-600" />
              Saved to Firestore
            </span>
          )}

          <button
            id="explicit-save-btn"
            onClick={handleExplicitSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            title="Save entry immediately"
          >
            <Save className="w-3.5 h-3.5 text-stone-600" />
            <span>Save Now</span>
          </button>
        </div>
      </div>

      {/* Writing Canvas */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Title Input */}
        <input
          id="journal-title-input"
          type="text"
          placeholder="Title of this reflection..."
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-2xl sm:text-3xl font-serif font-medium text-stone-900 placeholder:text-stone-300 focus:outline-none border-b border-transparent focus:border-stone-200 pb-1 tracking-tight"
        />

        {/* Mood Selector */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-xs text-stone-400 mr-1 font-medium">Mood:</span>
          {MOOD_OPTIONS.map((m) => {
            const isSelected = mood === m.label;
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => handleMoodSelect(m.label)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-100/90 text-amber-950 border border-amber-300/80 font-semibold shadow-2xs"
                    : "bg-stone-50 text-stone-600 border border-stone-200/80 hover:bg-stone-100"
                }`}
              >
                <span>{m.emoji}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Textarea */}
        <textarea
          id="journal-content-textarea"
          rows={10}
          placeholder="Write your thoughts, observations, experiences, dilemmas, or celebrations here... Gemini will read this entry to reflect and brainstorm with you."
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="w-full flex-1 min-h-[220px] resize-y p-4 rounded-xl border border-stone-200/90 focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none text-stone-800 text-sm leading-relaxed placeholder:text-stone-400 font-sans transition-colors"
        />

        {/* Tags input & chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200/80 text-[11px]"
            >
              #{t}
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:text-red-600 font-bold ml-0.5 cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder="Add tag (Press Enter)..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="px-2 py-0.5 text-xs bg-transparent border-b border-stone-200 focus:outline-none focus:border-stone-500 text-stone-700 w-36 placeholder:text-stone-400"
          />
        </div>

        {/* Memory Scanner Card */}
        <div className="pt-2">
          <MemoryScannerCard
            key={entry.id}
            userId={userId}
            entryTitle={title}
            entryContent={content}
            sourceEntryId={entry.id}
            onMemorySaved={onMemorySaved}
          />
        </div>
      </div>

      {/* AI Reflex Launchpad */}
      <div className="p-4 sm:px-6 bg-[#fafaf9] border-t border-stone-200/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Consult Gemini 3.6 Flash</span>
          </div>
          <span className="text-[11px] text-stone-400">
            Select a reflection angle to analyze this entry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <button
            id="trigger-reflection-btn"
            disabled={isGenerating || !content.trim()}
            onClick={() => onTriggerReflection("reflect")}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-stone-900 group-hover:text-amber-900">
                Empathetic Reflection
              </div>
              <div className="text-[10px] text-stone-500 truncate">
                Deeper emotional inquiry & insights
              </div>
            </div>
          </button>

          <button
            id="trigger-summary-btn"
            disabled={isGenerating || !content.trim()}
            onClick={() => onTriggerReflection("summary")}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-purple-300 hover:bg-purple-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-800 border border-purple-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-stone-900 group-hover:text-purple-900">
                Synthesize & Summarize
              </div>
              <div className="text-[10px] text-stone-500 truncate">
                Core themes, takeaways & lessons
              </div>
            </div>
          </button>

          <button
            id="trigger-brainstorm-btn"
            disabled={isGenerating || !content.trim()}
            onClick={() => onTriggerReflection("brainstorm")}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/70 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-stone-900 group-hover:text-blue-900">
                Brainstorm Ideas
              </div>
              <div className="text-[10px] text-stone-500 truncate">
                Actionable experiments & creative paths
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
