import React, { useState, useRef, useEffect } from "react";
import { MemorySuggestion, MemoryPolicy } from "../types";
import { saveUserMemory } from "../lib/firebase";
import {
  Sparkles,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";

interface MemoryScannerCardProps {
  userId: string;
  entryTitle: string;
  entryContent: string;
  sourceEntryId?: string;
  onMemorySaved?: () => void;
}

const DURATION_PRESETS = [
  { label: "24 Hours (1 Day)", ms: 24 * 60 * 60 * 1000 },
  { label: "3 Days", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 Days (1 Week)", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 Days (1 Month)", ms: 30 * 24 * 60 * 60 * 1000 },
];

export const MemoryScannerCard: React.FC<MemoryScannerCardProps> = ({
  userId,
  entryTitle,
  entryContent,
  sourceEntryId,
  onMemorySaved,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  // Per-suggestion processing state
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Temporary duration selection per suggestion
  const [activeTempIndex, setActiveTempIndex] = useState<number | null>(null);
  const [selectedDurationMs, setSelectedDurationMs] = useState<number>(24 * 60 * 60 * 1000);

  // Abort controller for in-flight memory detection requests
  const scanAbortControllerRef = useRef<AbortController | null>(null);
  const sourceEntryIdRef = useRef(sourceEntryId);
  sourceEntryIdRef.current = sourceEntryId;

  // Abort and reset state when source entry changes or unmounts
  useEffect(() => {
    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
      scanAbortControllerRef.current = null;
    }
    setSuggestions([]);
    setHasScanned(false);
    setIsScanning(false);
    setScanError(null);
    setActionError(null);

    return () => {
      if (scanAbortControllerRef.current) {
        scanAbortControllerRef.current.abort();
        scanAbortControllerRef.current = null;
      }
    };
  }, [sourceEntryId]);

  // Trigger scanning via backend API
  const handleScan = async () => {
    if (isScanning) return;
    if (!entryContent || entryContent.trim().length < 15) {
      setScanError("Please write at least a few sentences before scanning for potential memories.");
      return;
    }

    if (scanAbortControllerRef.current) {
      scanAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    scanAbortControllerRef.current = controller;
    const originatingEntryId = sourceEntryId;

    setIsScanning(true);
    setScanError(null);
    setActionError(null);

    try {
      const response = await fetch("/api/memories/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryTitle: entryTitle || "Untitled Reflection",
          entryContent: entryContent.trim(),
        }),
        signal: controller.signal,
      });

      if (controller.signal.aborted || sourceEntryIdRef.current !== originatingEntryId) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Scan request failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (controller.signal.aborted || sourceEntryIdRef.current !== originatingEntryId) {
        return;
      }

      const detected = Array.isArray(data.suggestions) ? data.suggestions : [];
      setSuggestions(detected);
      setHasScanned(true);
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return;
      }
      console.error("Memory scan failed:", err);
      setScanError(err?.message || "Failed to scan journal entry for memories. Please retry.");
    } finally {
      if (!controller.signal.aborted && sourceEntryIdRef.current === originatingEntryId) {
        setIsScanning(false);
      }
    }
  };

  // Explicit approval / assignment of policy
  const handleAssignPolicy = async (
    suggestion: MemorySuggestion,
    index: number,
    policy: MemoryPolicy,
    customDurationMs?: number
  ) => {
    if (!userId) return;

    setSavingIndex(index);
    setActionError(null);

    try {
      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let expiresAt: number | null = null;

      if (policy === "TEMPORARY") {
        expiresAt = Date.now() + (customDurationMs || selectedDurationMs);
      }

      await saveUserMemory(userId, {
        id: memoryId,
        userId,
        summary: suggestion.summary,
        category: suggestion.category || "General",
        policy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt,
        sourceEntryId,
      });

      // Remove this suggestion from the local list upon successful persistence
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
      setActiveTempIndex(null);
      if (onMemorySaved) onMemorySaved();
    } catch (err: any) {
      console.error("Failed to save approved memory:", err);
      setActionError(`Could not save memory to Firestore: ${err?.message || "Permission or network error"}`);
    } finally {
      setSavingIndex(null);
    }
  };

  // Dismiss suggestion without saving
  const handleDismiss = (index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
    if (activeTempIndex === index) {
      setActiveTempIndex(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/50 via-white to-stone-50/50 p-3.5 sm:p-4 shadow-2xs">
      {/* Header with trigger button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
              Gemini Memory Firewall Scanner
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300/70">
                Zero Auto-Save
              </span>
            </div>
            <div className="text-[11px] text-stone-500">
              Detect candidate insights from your writing. Every memory requires explicit user policy approval.
            </div>
          </div>
        </div>

        <button
          type="button"
          id="scan-memories-btn"
          disabled={isScanning || !entryContent.trim()}
          onClick={handleScan}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Analyzing Entry...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Scan for Potential Memories</span>
            </>
          )}
        </button>
      </div>

      {/* Scanning Error State */}
      {scanError && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{scanError}</span>
          </div>
          <button
            type="button"
            onClick={handleScan}
            className="text-[11px] font-medium text-red-900 underline hover:opacity-80 cursor-pointer"
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Action Error State */}
      {actionError && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-[11px] font-medium text-red-900 underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Suggestions List */}
      {hasScanned && suggestions.length === 0 && !isScanning && !scanError && (
        <div className="mt-3 p-3 bg-white/80 rounded-xl border border-stone-200 text-center text-xs text-stone-500">
          No distinct personal memory patterns detected in this text. You can also add memories manually in the Memory Firewall panel.
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] text-stone-600 font-medium px-1">
            <span>Potential Memory Suggestions ({suggestions.length})</span>
            <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              Not saved yet • Assign a policy to persist
            </span>
          </div>

          {suggestions.map((suggestion, idx) => {
            const isSaving = savingIndex === idx;
            const isTempActive = activeTempIndex === idx;

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col gap-2.5 transition-all hover:border-amber-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200 mb-1">
                      {suggestion.category}
                    </span>
                    <p className="text-xs text-stone-800 font-medium leading-relaxed">
                      {suggestion.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDismiss(idx)}
                    className="text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
                    title="Dismiss without saving"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Explicit Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Allow Button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAssignPolicy(suggestion, idx, "ALLOWED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors disabled:opacity-50 cursor-pointer text-[11px]"
                      title="Authorize memory for future Gemini context"
                    >
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Allow</span>
                    </button>

                    {/* Temporary Button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setActiveTempIndex(isTempActive ? null : idx)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium border transition-colors disabled:opacity-50 cursor-pointer text-[11px] ${
                        isTempActive
                          ? "bg-amber-200 text-amber-950 border-amber-400"
                          : "bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300"
                      }`}
                      title="Authorize temporarily with an expiration timer"
                    >
                      <Clock className="w-3 h-3 text-amber-700" />
                      <span>Temporary</span>
                    </button>

                    {/* Block Button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAssignPolicy(suggestion, idx, "BLOCKED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer text-[11px]"
                      title="Explicitly block this memory from ever entering Gemini context"
                    >
                      <ShieldAlert className="w-3 h-3 text-red-700" />
                      <span>Block</span>
                    </button>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleDismiss(idx)}
                      className="px-2 py-1 text-[11px] text-stone-500 hover:text-stone-800 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  {isSaving && (
                    <span className="text-[11px] text-amber-700 animate-pulse">
                      Saving to Firestore...
                    </span>
                  )}
                </div>

                {/* Inline Temporary Expiration Selector */}
                {isTempActive && (
                  <div className="mt-1 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="text-[11px] font-medium text-amber-900">Duration:</span>
                      <select
                        value={selectedDurationMs}
                        onChange={(e) => setSelectedDurationMs(Number(e.target.value))}
                        className="px-2 py-1 text-xs bg-white rounded-md border border-amber-200 text-stone-800"
                      >
                        {DURATION_PRESETS.map((d) => (
                          <option key={d.ms} value={d.ms}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleAssignPolicy(suggestion, idx, "TEMPORARY", selectedDurationMs)}
                      className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-medium text-[11px] rounded-lg cursor-pointer transition-colors"
                    >
                      Confirm Temporary
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
