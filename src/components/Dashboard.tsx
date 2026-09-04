import React, { useState, useEffect, useCallback } from "react";
import { User } from "firebase/auth";
import { JournalEntry, InteractionMessage, ReflectionMode } from "../types";
import {
  saveJournalEntry,
  deleteJournalEntry,
  subscribeToUserEntries,
  logOut,
} from "../lib/firebase";
import { EntryHistorySidebar } from "./EntryHistorySidebar";
import { JournalEditor } from "./JournalEditor";
import { ReflectionThread } from "./ReflectionThread";
import { ThreatModelModal } from "./ThreatModelModal";
import {
  LogOut,
  Shield,
  Menu,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  MessageSquare,
} from "lucide-react";

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
  const [mobileTab, setMobileTab] = useState<"editor" | "reflection">("editor");

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
        // If no active entry selected, select the first or create a blank one
        if (fetched.length > 0) {
          if (!activeEntryId || !fetched.some((e) => e.id === activeEntryId)) {
            setActiveEntryId(fetched[0].id);
            setActiveEntry(fetched[0]);
          } else {
            const current = fetched.find((e) => e.id === activeEntryId);
            if (current) {
              setActiveEntry(current);
            }
          }
        } else {
          // No entries yet
          if (!activeEntry) {
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
  }, [user.uid, activeEntryId, createNewBlankEntry]);

  // Handle creating a new entry
  const handleNewEntry = () => {
    const newEntry = createNewBlankEntry();
    setActiveEntry(newEntry);
    setActiveEntryId(newEntry.id);
    setMobileTab("editor");
  };

  // Handle selecting an entry from sidebar
  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntryId(entry.id);
    setActiveEntry(entry);
    setSaveError(null);
    setAiError(null);
  };

  // Handle deleting an entry
  const handleDeleteEntry = async (entryId: string) => {
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

  // Handle updating active entry content
  const handleUpdateEntry = async (updated: Partial<JournalEntry>) => {
    if (!activeEntry) return;
    const merged: JournalEntry = {
      ...activeEntry,
      ...updated,
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
      setSaveError("Failed to persist entry to Firestore. Click retry to save.");
    } finally {
      setIsSaving(false);
    }
  };

  // Retry save
  const handleRetrySave = () => {
    if (activeEntry) {
      handleUpdateEntry(activeEntry);
    }
  };

  // Trigger Gemini reflection or AI action
  const handleTriggerReflection = async (mode: ReflectionMode, customPrompt?: string) => {
    if (!activeEntry || isGenerating) return;

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

    const currentMessages = activeEntry.messages || [];
    const updatedMessagesWithUser = [...currentMessages, userMessage];

    // Optimistically update active entry with the user turn
    const optimisticEntry: JournalEntry = {
      ...activeEntry,
      messages: updatedMessagesWithUser,
      updatedAt: Date.now(),
    };
    setActiveEntry(optimisticEntry);
    setMobileTab("reflection"); // On mobile, automatically show the reflection thread

    setIsGenerating(true);
    setAiError(null);

    try {
      // Call backend Gemini proxy with fallback ladder
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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      const modelText = data.text;
      const modelUsed = data.modelUsed;

      const aiMessage: InteractionMessage = {
        id: `msg_model_${Date.now()}`,
        role: "model",
        text: modelText,
        timestamp: Date.now(),
        mode,
        modelUsed,
      };

      const finalMessages = [...updatedMessagesWithUser, aiMessage];
      const finalEntry: JournalEntry = {
        ...optimisticEntry,
        messages: finalMessages,
        summary: mode === "summary" ? modelText.slice(0, 300) : optimisticEntry.summary,
        updatedAt: Date.now(),
      };

      setActiveEntry(finalEntry);

      // Guaranteed transaction verification: Save immediately to Firestore
      await saveJournalEntry(user.uid, finalEntry);
    } catch (err: any) {
      console.error("Gemini reflection failed:", err);
      setAiError(err?.message || "Failed to generate reflection from Gemini. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-stone-100/70 overflow-hidden font-sans text-stone-900">
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
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-stone-200 bg-white/90 px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarMobileOpen(true)}
              className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 md:hidden cursor-pointer"
              title="Open History Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-50 flex items-center justify-center font-serif font-bold text-sm shadow-2xs">
                D
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
                  DearVault Studio
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Gemini 3.6 Flash
                  </span>
                </div>
                <div className="text-[10px] text-stone-500">
                  Private Cloud Firestore Storage
                </div>
              </div>
            </div>
          </div>

          {/* Right User & Security Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Threat Model Modal Trigger */}
            <button
              id="open-threat-model-btn"
              onClick={() => setIsThreatModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors cursor-pointer"
              title="View Agentic Threat Model & Security Controls"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Security & Threat Model</span>
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-stone-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-medium">
                  {user.email ? user.email[0].toUpperCase() : "U"}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <div className="text-xs font-medium text-stone-900 truncate max-w-[130px]">
                  {user.displayName || user.email?.split("@")[0] || "User"}
                </div>
                <div className="text-[10px] text-stone-600 truncate max-w-[130px]">
                  {user.email}
                </div>
              </div>

              {/* Sign Out Button */}
              <button
                id="signout-btn"
                onClick={logOut}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile View Toggle Switch */}
        <div className="flex sm:hidden p-2 bg-stone-200/60 border-b border-stone-200 text-xs">
          <button
            onClick={() => setMobileTab("editor")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
              mobileTab === "editor"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Journal Editor</span>
          </button>
          <button
            onClick={() => setMobileTab("reflection")}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
              mobileTab === "reflection"
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Reflections ({activeEntry?.messages?.length || 0})
            </span>
          </button>
        </div>

        {/* Dual-Pane Workspace */}
        <main className="flex-1 p-3 sm:p-5 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Pane: Journal Editor */}
          <div className={`h-full ${mobileTab === "editor" ? "block" : "hidden sm:block"}`}>
            {activeEntry ? (
              <JournalEditor
                entry={activeEntry}
                onUpdateEntry={handleUpdateEntry}
                onTriggerReflection={handleTriggerReflection}
                isSaving={isSaving}
                saveError={saveError}
                onRetrySave={handleRetrySave}
                isGenerating={isGenerating}
              />
            ) : (
              <div className="h-full bg-white rounded-2xl border border-stone-200 flex items-center justify-center text-stone-400">
                Select or create an entry to begin writing.
              </div>
            )}
          </div>

          {/* Right Pane: Multi-turn Reflection Thread */}
          <div className={`h-full ${mobileTab === "reflection" ? "block" : "hidden sm:block"}`}>
            {activeEntry ? (
              <ReflectionThread
                messages={activeEntry.messages || []}
                onSendMessage={(text) => handleTriggerReflection("chat", text)}
                isGenerating={isGenerating}
                error={aiError}
                onRetryLastMessage={() => {
                  const msgs = activeEntry.messages || [];
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

      {/* Security Threat Model Modal */}
      <ThreatModelModal
        isOpen={isThreatModalOpen}
        onClose={() => setIsThreatModalOpen(false)}
      />
    </div>
  );
};
