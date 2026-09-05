import React, { useState, useEffect, useCallback, useRef } from "react";
import { User } from "firebase/auth";
import { JournalEntry, InteractionMessage, ReflectionMode, StoredMemory } from "../types";
import {
  saveJournalEntry,
  deleteJournalEntry,
  subscribeToUserEntries,
  subscribeToUserMemories,
  logOut,
} from "../lib/firebase";
import { EntryHistorySidebar } from "./EntryHistorySidebar";
import { JournalEditor } from "./JournalEditor";
import { ReflectionThread } from "./ReflectionThread";
import { ThreatModelModal } from "./ThreatModelModal";
import { MemoryFirewallModal } from "./MemoryFirewallModal";
import {
  LogOut,
  Shield,
  ShieldCheck,
  Menu,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  MessageSquare,
} from "lucide-react";

// Stable fallback for empty messages to prevent spurious re-renders
const EMPTY_MESSAGES: InteractionMessage[] = [];

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [isThreatModalOpen, setIsThreatModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"editor" | "reflection">("editor");

  // Keep a synchronized ref to avoid listener churn while reading the current active ID
  const activeEntryIdRef = useRef<string | null>(activeEntryId);
  activeEntryIdRef.current = activeEntryId;

  // Abort controller for in-flight Gemini reflection requests
  const reflectionAbortControllerRef = useRef<AbortController | null>(null);

  // Clean up in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (reflectionAbortControllerRef.current) {
        reflectionAbortControllerRef.current.abort();
        reflectionAbortControllerRef.current = null;
      }
    };
  }, []);

  // Create a blank new entry
  const createNewBlankEntry = useCallback((): JournalEntry => {
    const timestamp = Date.now();
    return {
      id: `entry_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.uid,
      title: "",
      content: "",
      mood: "Reflective",
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
    };
  }, [user.uid]);

  // Subscribe to real-time entries
  useEffect(() => {
    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (fetched) => {
        setEntries(fetched);
        const currentActiveId = activeEntryIdRef.current;
        if (fetched.length > 0) {
          if (currentActiveId) {
            const matching = fetched.find((e) => e.id === currentActiveId);
            if (matching) {
              setActiveEntry(matching);
            }
            // If currentActiveId is not yet in fetched (e.g. newly created blank entry being saved),
            // do NOT overwrite activeEntryId or activeEntry with fetched[0].
          } else {
            // No active entry was selected yet, default to the first entry
            setActiveEntryId(fetched[0].id);
            setActiveEntry(fetched[0]);
          }
        } else {
          // No entries in Firestore at all
          if (!currentActiveId) {
            const fresh = createNewBlankEntry();
            setActiveEntry(fresh);
            setActiveEntryId(fresh.id);
          }
        }
      },
      (err) => {
        console.error("Firestore subscription error:", err);
      }
    );

    return () => unsubscribe();
  }, [user.uid, createNewBlankEntry]);

  // Subscribe to real-time user memories for Memory Firewall
  useEffect(() => {
    const unsubscribeMemories = subscribeToUserMemories(
      user.uid,
      (fetched) => {
        setMemories(fetched);
        setMemoriesError(null);
      },
      (err) => {
        console.error("Firestore memories subscription error:", err);
        setMemoriesError("Failed to synchronize Memory Firewall state.");
      }
    );

    return () => unsubscribeMemories();
  }, [user.uid]);

  // Handle creating a new entry
  const handleNewEntry = async () => {
    // Abort any in-flight reflection from the previous entry
    if (reflectionAbortControllerRef.current) {
      reflectionAbortControllerRef.current.abort();
      reflectionAbortControllerRef.current = null;
    }
    const newEntry = createNewBlankEntry();
    activeEntryIdRef.current = newEntry.id;
    setIsGenerating(false);

    setActiveEntry(newEntry);
    setActiveEntryId(newEntry.id);
    setMobileTab("editor");
    setSaveError(null);
    setAiError(null);

    setIsSaving(true);
    try {
      await saveJournalEntry(user.uid, newEntry);
    } catch (err: any) {
      console.error("Failed to persist new entry to Firestore:", err);
      setSaveError(err?.message || "Failed to initialize and save new journal entry in Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle selecting an entry from sidebar
  const handleSelectEntry = (entry: JournalEntry) => {
    // Abort any in-flight reflection from the previous entry
    if (reflectionAbortControllerRef.current) {
      reflectionAbortControllerRef.current.abort();
      reflectionAbortControllerRef.current = null;
    }
    activeEntryIdRef.current = entry.id;
    setIsGenerating(false);
    setActiveEntryId(entry.id);
    setActiveEntry(entry);
    setSaveError(null);
    setAiError(null);
  };

  // Handle deleting an entry
  const handleDeleteEntry = async (entryId: string) => {
    if (activeEntryIdRef.current === entryId && reflectionAbortControllerRef.current) {
      reflectionAbortControllerRef.current.abort();
      reflectionAbortControllerRef.current = null;
    }
    setIsGenerating(false);

    try {
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntryId === entryId) {
        const remaining = entries.filter((e) => e.id !== entryId);
        if (remaining.length > 0) {
          setActiveEntryId(remaining[0].id);
          setActiveEntry(remaining[0]);
        } else {
          const fresh = createNewBlankEntry();
          setActiveEntry(fresh);
          setActiveEntryId(fresh.id);
        }
      }
    } catch (err: any) {
      console.error("Delete entry failed:", err);
      setSaveError("Failed to delete entry from Firestore.");
    }
  };

  // Handle updating active entry content with strict entry ID validation
  const handleUpdateEntry = async (entryId: string, updated: Partial<JournalEntry>) => {
    // Discard stale updates that belong to an entry that is no longer active
    if (!entryId || entryId !== activeEntryIdRef.current || !activeEntry || activeEntry.id !== entryId) {
      console.warn(`[Entry Isolation] Discarded stale update intended for entry "${entryId}" while active entry is "${activeEntryIdRef.current}"`);
      return;
    }

    const merged: JournalEntry = {
      ...activeEntry,
      ...updated,
      id: entryId,
      updatedAt: Date.now(),
    };
    setActiveEntry(merged);

    // Save to Firestore
    try {
      setIsSaving(true);
      setSaveError(null);
      await saveJournalEntry(user.uid, merged);
    } catch (err: any) {
      console.error("Save to Firestore failed:", err);
      if (entryId === activeEntryIdRef.current) {
        setSaveError("Failed to persist entry to Firestore. Click retry to save.");
      }
    } finally {
      if (entryId === activeEntryIdRef.current) {
        setIsSaving(false);
      }
    }
  };

  // Retry save
  const handleRetrySave = () => {
    if (activeEntry) {
      handleUpdateEntry(activeEntry.id, activeEntry);
    }
  };

  // Trigger Gemini reflection or AI action with originating entry isolation
  const handleTriggerReflection = async (mode: ReflectionMode, customPrompt?: string) => {
    if (!activeEntry || isGenerating) return;

    // Capture originating entry ID at the start of the asynchronous operation
    const originatingEntryId = activeEntry.id;

    // Abort any prior in-flight reflection request
    if (reflectionAbortControllerRef.current) {
      reflectionAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    reflectionAbortControllerRef.current = controller;

    let userPromptText = customPrompt;
    if (!userPromptText) {
      if (mode === "reflect") {
        userPromptText = "Please provide an empathetic reflection on this journal entry, highlighting any underlying themes and 1-2 guiding questions.";
      } else if (mode === "summary") {
        userPromptText = "Please synthesize and summarize the core themes, takeaways, and potential next steps from this entry.";
      } else if (mode === "brainstorm") {
        userPromptText = "Please brainstorm 3-5 creative angles, potential experiments, or constructive actions based on my thoughts here.";
      } else {
        userPromptText = "Let's reflect on this entry.";
      }
    }

    const userMessage: InteractionMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      text: userPromptText,
      timestamp: Date.now(),
      mode,
    };

    const currentMessages = activeEntry.messages || EMPTY_MESSAGES;
    const updatedMessagesWithUser = [...currentMessages, userMessage];

    // Optimistically update active entry with the user turn
    const optimisticEntry: JournalEntry = {
      ...activeEntry,
      id: originatingEntryId,
      messages: updatedMessagesWithUser,
      updatedAt: Date.now(),
    };

    if (activeEntryIdRef.current === originatingEntryId) {
      setActiveEntry(optimisticEntry);
      setMobileTab("reflection"); // On mobile, automatically show the reflection thread
      setIsGenerating(true);
      setAiError(null);
    }

    try {
      // Call backend Gemini proxy with fallback ladder and Pre-LLM Memory Firewall
      const response = await fetch("/api/gemini/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: userPromptText,
          history: currentMessages.map((m) => ({ role: m.role, text: m.text })),
          mode,
          entryTitle: activeEntry.title || "Untitled Entry",
          entryContent: activeEntry.content || "",
          userId: user.uid,
          memories: memories,
        }),
        signal: controller.signal,
      });

      if (controller.signal.aborted || originatingEntryId !== activeEntryIdRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (controller.signal.aborted || originatingEntryId !== activeEntryIdRef.current) {
        return;
      }

      const modelText = data.text;
      const modelUsed = data.modelUsed;

      const aiMessage: InteractionMessage = {
        id: `msg_model_${Date.now()}`,
        role: "model",
        text: modelText,
        timestamp: Date.now(),
        mode,
        modelUsed,
        influencedBy: Array.isArray(data.influencedBy) ? data.influencedBy : [],
        redactionApplied: Boolean(data.redactionApplied),
      };

      const finalMessages = [...updatedMessagesWithUser, aiMessage];
      const finalEntry: JournalEntry = {
        ...optimisticEntry,
        id: originatingEntryId,
        messages: finalMessages,
        summary: mode === "summary" ? modelText.slice(0, 300) : optimisticEntry.summary,
        updatedAt: Date.now(),
      };

      // Guaranteed transaction verification: update activeEntry only if still matching
      if (originatingEntryId === activeEntryIdRef.current) {
        setActiveEntry(finalEntry);
        // Save strictly to the originating entry in Firestore
        await saveJournalEntry(user.uid, finalEntry);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      console.error("Gemini reflection failed:", err);
      if (originatingEntryId === activeEntryIdRef.current) {
        setAiError(err?.message || "Failed to generate reflection from Gemini. Please try again.");
      }
    } finally {
      if (originatingEntryId === activeEntryIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-stone-100/70 font-sans text-stone-900">
      {/* Sidebar with History */}
      <EntryHistorySidebar
        entries={entries}
        activeEntryId={activeEntryId}
        onSelectEntry={handleSelectEntry}
        onNewEntry={handleNewEntry}
        onDeleteEntry={handleDeleteEntry}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#fcfbf9]">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-stone-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarMobileOpen(true)}
              className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 md:hidden cursor-pointer"
              title="Open History Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-serif font-bold text-sm shadow-xs">
                D
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-stone-900 tracking-tight">DearVault</span>
                  <span className="hidden sm:inline-flex items-center text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-medium">
                    Memory Firewall
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right User & Security Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Memory Firewall Panel Trigger */}
            <button
              id="open-memory-firewall-btn"
              onClick={() => setIsMemoryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100/80 hover:bg-amber-100/70 hover:text-amber-900 border border-stone-200/70 hover:border-amber-300 transition-all cursor-pointer shadow-2xs group"
              title="View and configure Gemini Memory Firewall policies"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <Shield className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Memory Firewall</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-200/80 text-amber-950">
                {memories.filter((m) => m.policy === "ALLOWED" || (m.policy === "TEMPORARY" && (!m.expiresAt || m.expiresAt > Date.now()))).length}/{memories.length} Active
              </span>
            </button>

            {/* Threat Model Modal Trigger */}
            <button
              id="open-threat-model-btn"
              onClick={() => setIsThreatModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200/80 transition-all cursor-pointer"
              title="View Agentic Threat Model & Security Controls"
            >
              <Shield className="w-3.5 h-3.5 text-stone-500" />
              <span className="hidden md:inline">Threat Model</span>
            </button>

            {/* User Profile & Sign-out */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-stone-200 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center text-xs font-bold">
                  {user.email ? user.email[0].toUpperCase() : "U"}
                </div>
              )}
              <div className="hidden xl:block text-left">
                <div className="text-xs font-medium text-stone-800 truncate max-w-[120px]">
                  {user.displayName || user.email?.split("@")[0] || "User"}
                </div>
                <div className="text-[10px] text-stone-400 truncate max-w-[120px]">
                  {user.email}
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                id="signout-btn"
                onClick={logOut}
                className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-1"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile View Toggle Switch */}
        <div className="sticky top-16 z-20 flex sm:hidden p-2 bg-stone-100/90 border-b border-stone-200 text-xs backdrop-blur-md">
          <button
            onClick={() => setMobileTab("editor")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
              mobileTab === "editor"
                ? "bg-white text-stone-900 shadow-xs font-semibold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Journal Editor</span>
          </button>
          <button
            onClick={() => setMobileTab("reflection")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
              mobileTab === "reflection"
                ? "bg-white text-stone-900 shadow-xs font-semibold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Reflections ({activeEntry?.messages?.length || 0})
            </span>
          </button>
        </div>

        {/* Memory Error Notification Banner */}
        {memoriesError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{memoriesError}</span>
            </div>
            <button
              onClick={() => setMemoriesError(null)}
              className="text-amber-950 font-semibold underline text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dual-Pane Workspace */}
        <main className="flex-1 p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Pane: Journal Editor */}
          <div className={`min-h-[580px] lg:min-h-[calc(100vh-7.5rem)] flex flex-col ${mobileTab === "editor" ? "block" : "hidden sm:block"}`}>
            {activeEntry ? (
              <JournalEditor
                key={activeEntry.id}
                entry={activeEntry}
                onUpdateEntry={handleUpdateEntry}
                onTriggerReflection={handleTriggerReflection}
                isSaving={isSaving}
                saveError={saveError}
                onRetrySave={handleRetrySave}
                isGenerating={isGenerating}
                userId={user.uid}
              />
            ) : (
              <div className="h-full bg-white rounded-2xl border border-stone-200 flex items-center justify-center text-stone-400">
                Select or create an entry to begin writing.
              </div>
            )}
          </div>

          {/* Right Pane: Multi-turn Reflection Thread */}
          <div className={`min-h-[580px] lg:min-h-[calc(100vh-7.5rem)] flex flex-col ${mobileTab === "reflection" ? "block" : "hidden sm:block"}`}>
            {activeEntry ? (
              <ReflectionThread
                key={activeEntry.id}
                messages={activeEntry.messages || EMPTY_MESSAGES}
                onSendMessage={(text) => handleTriggerReflection("chat", text)}
                isGenerating={isGenerating}
                error={aiError}
                onRetryLastMessage={() => {
                  const msgs = activeEntry.messages || EMPTY_MESSAGES;
                  const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user");
                  if (lastUserMsg) {
                    handleTriggerReflection(lastUserMsg.mode || "chat", lastUserMsg.text);
                  }
                }}
                entryTitle={activeEntry.title || "Untitled Entry"}
              />
            ) : (
              <div className="h-full bg-white rounded-2xl border border-stone-200 flex items-center justify-center text-stone-400">
                Select an entry to view conversational reflections.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Gemini Memory Firewall Management Modal */}
      <MemoryFirewallModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        userId={user.uid}
        memories={memories}
      />

      {/* Security Threat Model Modal */}
      <ThreatModelModal
        isOpen={isThreatModalOpen}
        onClose={() => setIsThreatModalOpen(false)}
      />
    </div>
  );
};
