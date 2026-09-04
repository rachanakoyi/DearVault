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

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: Partial<JournalEntry>) => void;
  onTriggerReflection: (mode: ReflectionMode, customPrompt?: string) => void;
  isSaving: boolean;
  saveError: string | null;
  onRetrySave: () => void;
  isGenerating: boolean;
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
}) => {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [mood, setMood] = useState(entry.mood || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(entry.tags || []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync state when active entry changes
  useEffect(() => {
    setTitle(entry.title);
    setContent(entry.content);
    setMood(entry.mood || "");
    setTags(entry.tags || []);
    setHasUnsavedChanges(false);
  }, [entry.id]);

  // Debounced auto-save notification to parent
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onUpdateEntry(data);
      setHasUnsavedChanges(false);
    }, 800);
  };

  const handleExplicitSave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onUpdateEntry({ title, content, mood, tags });
    setHasUnsavedChanges(false);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
      {/* Top Header & Status */}
      <div className="p-4 sm:px-6 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>
            Created {new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="text-stone-300">•</span>
          <span>{wordCount} words</span>
          <span className="text-stone-300">•</span>
          <span>{charCount} characters</span>
        </div>

        {/* Save Status & Button */}
        <div className="flex items-center gap-2">
          {saveError ? (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Save failed</span>
              <button
                onClick={onRetrySave}
                className="underline font-semibold hover:text-red-800 ml-1 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : isSaving ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Saving to Firestore...
            </span>
          ) : hasUnsavedChanges ? (
            <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              Unsaved edits
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
              <Check className="w-3 h-3 text-emerald-600" />
              Saved to Firestore
            </span>
          )}

          <button
            id="explicit-save-btn"
            onClick={handleExplicitSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-stone-600" />
            <span>Save Now</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col space-y-4 overflow-y-auto">
        {/* Title Input */}
        <input
          id="journal-title-input"
          type="text"
          placeholder="Title of this reflection..."
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-xl sm:text-2xl font-serif font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none border-b border-transparent focus:border-stone-200 pb-1"
        />

        {/* Mood Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs text-stone-600 mr-1 font-medium">Mood:</span>
          {MOOD_OPTIONS.map((m) => {
            const isSelected = mood === m.label;
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => handleMoodSelect(m.label)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-100 text-amber-900 border border-amber-300 font-medium shadow-2xs"
                    : "bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100"
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
          className="w-full flex-1 min-h-[220px] resize-y p-3.5 rounded-xl border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-400 focus:outline-none text-stone-800 text-sm leading-relaxed placeholder:text-stone-400 font-sans"
        />

        {/* Tags input & chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200"
            >
              #{t}
              <button
                type="button"
                onClick={() => handleRemoveTag(t)}
                className="hover:text-red-500 font-bold ml-0.5"
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
      </div>

      {/* AI Reflex Launchpad */}
      <div className="p-4 sm:px-6 bg-stone-50/80 border-t border-stone-200">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-700">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Consult Gemini 3.6 Flash</span>
          </div>
          <span className="text-[11px] text-stone-500">
            Select a reflection angle to analyze this entry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            id="trigger-reflection-btn"
            disabled={isGenerating || !content.trim()}
            onClick={() => onTriggerReflection("reflect")}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200 hover:border-amber-300 hover:bg-amber-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-stone-900 group-hover:text-amber-950">
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
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200 hover:border-purple-300 hover:bg-purple-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-stone-900 group-hover:text-purple-950">
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
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-stone-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all text-left group disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-stone-900 group-hover:text-blue-950">
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
