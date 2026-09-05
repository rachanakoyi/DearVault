import React, { useState } from "react";
import { StoredMemory, MemoryPolicy } from "../types";
import { saveUserMemory, deleteUserMemory } from "../lib/firebase";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Trash2,
  X,
  AlertTriangle,
  Plus,
  Calendar,
  Check,
  Info,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  BookOpen,
} from "lucide-react";

interface MemoryFirewallModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  memories: StoredMemory[];
  onRefresh?: () => void;
}

const DURATION_PRESETS = [
  { label: "24 Hours (1 Day)", ms: 24 * 60 * 60 * 1000 },
  { label: "3 Days", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 Days (1 Week)", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30 Days (1 Month)", ms: 30 * 24 * 60 * 60 * 1000 },
];

export const MemoryFirewallModal: React.FC<MemoryFirewallModalProps> = ({
  isOpen,
  onClose,
  userId,
  memories,
}) => {
  const [filterPolicy, setFilterPolicy] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);

  // State for editing temporary expiration modal/popover
  const [editingTempMemoryId, setEditingTempMemoryId] = useState<string | null>(null);
  const [selectedDurationMs, setSelectedDurationMs] = useState<number>(24 * 60 * 60 * 1000);
  const [customExpiresDate, setCustomExpiresDate] = useState<string>("");

  // State for manual memory addition
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSummary, setNewSummary] = useState("");
  const [newCategory, setNewCategory] = useState("Preferences");
  const [newPolicy, setNewPolicy] = useState<MemoryPolicy>("ALLOWED");
  const [newDurationMs, setNewDurationMs] = useState<number>(24 * 60 * 60 * 1000);

  if (!isOpen) return null;

  const now = Date.now();

  // Helper to format remaining time
  const formatExpiration = (expiresAt?: number | null) => {
    if (!expiresAt) return "No expiration set";
    const diff = expiresAt - now;
    if (diff <= 0) {
      return `Expired on ${new Date(expiresAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    }
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) {
      return `Active for ${days}d ${hours}h (until ${new Date(expiresAt).toLocaleDateString([], { month: "short", day: "numeric" })})`;
    }
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `Active for ${hours}h ${minutes}m (until ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
  };

  // Change policy handler
  const handleUpdatePolicy = async (
    memory: StoredMemory,
    targetPolicy: MemoryPolicy,
    customExpiresAt?: number | null
  ) => {
    if (!userId) return;

    // Safety guard: Never silently restore REVOKED back to ALLOWED
    if (memory.policy === "REVOKED" && targetPolicy === "ALLOWED") {
      const confirmed = window.confirm(
        "This memory was previously REVOKED. Revocation is permanent by design. Are you sure you want to explicitly permit this personal insight again?"
      );
      if (!confirmed) return;
    }

    setIsProcessingId(memory.id);
    setActionError(null);

    try {
      let expiresAt = memory.expiresAt;
      if (targetPolicy === "TEMPORARY") {
        expiresAt = customExpiresAt || Date.now() + 24 * 60 * 60 * 1000;
      } else if (targetPolicy === "ALLOWED" || targetPolicy === "BLOCKED" || targetPolicy === "REVOKED") {
        expiresAt = null;
      }

      await saveUserMemory(userId, {
        id: memory.id,
        policy: targetPolicy,
        expiresAt,
        updatedAt: Date.now(),
      });
      setEditingTempMemoryId(null);
    } catch (err: any) {
      console.error("Failed to update memory policy:", err);
      setActionError(`Failed to update memory policy: ${err?.message || "Firestore error"}`);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Delete memory handler
  const handleDelete = async (memoryId: string) => {
    if (!userId) return;
    const confirmed = window.confirm("Are you sure you want to delete this memory record from your vault?");
    if (!confirmed) return;

    setIsProcessingId(memoryId);
    setActionError(null);

    try {
      await deleteUserMemory(userId, memoryId);
    } catch (err: any) {
      console.error("Failed to delete memory:", err);
      setActionError(`Failed to delete memory: ${err?.message || "Firestore error"}`);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Handle manual memory creation
  const handleCreateManualMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newSummary.trim()) return;

    setActionError(null);
    setIsProcessingId("new_memory");

    try {
      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let expiresAt: number | null = null;

      if (newPolicy === "TEMPORARY") {
        expiresAt = Date.now() + newDurationMs;
      }

      await saveUserMemory(userId, {
        id: memoryId,
        userId,
        summary: newSummary.trim(),
        category: newCategory.trim() || "General",
        policy: newPolicy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt,
      });

      setNewSummary("");
      setShowAddForm(false);
    } catch (err: any) {
      console.error("Failed to save new memory:", err);
      setActionError(`Failed to save memory: ${err?.message || "Firestore error"}`);
    } finally {
      setIsProcessingId(null);
    }
  };

  // Filter memories
  const filteredMemories = memories.filter((m) => {
    if (filterPolicy !== "ALL" && m.policy !== filterPolicy) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.summary.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate policy statistics
  const allowedCount = memories.filter((m) => m.policy === "ALLOWED").length;
  const tempCount = memories.filter((m) => m.policy === "TEMPORARY" && (m.expiresAt ? m.expiresAt > now : false)).length;
  const expiredCount = memories.filter((m) => m.policy === "TEMPORARY" && (m.expiresAt ? m.expiresAt <= now : true)).length;
  const blockedCount = memories.filter((m) => m.policy === "BLOCKED").length;
  const revokedCount = memories.filter((m) => m.policy === "REVOKED").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-stone-200/80 bg-[#fcfcfb] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-stone-900">
                  Gemini Memory Firewall
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-medium">
                  Pre-LLM Active
                </span>
              </div>
              <p className="text-xs text-stone-500">
                User-governed authorization layer between personal memories and Gemini context.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            title="Close Firewall Manager"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Metrics Banner */}
        <div className="p-3 sm:px-6 bg-stone-50 border-b border-stone-200/70 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="text-base font-bold text-emerald-700">{allowedCount}</div>
            <div className="text-[11px] font-medium text-stone-600">Allowed</div>
            <div className="text-[9px] text-stone-400">Prompt Injected</div>
          </div>
          <div className="p-2 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="text-base font-bold text-amber-600">{tempCount}</div>
            <div className="text-[11px] font-medium text-stone-600">Temporary Active</div>
            <div className="text-[9px] text-stone-400">Until Expiry</div>
          </div>
          <div className="p-2 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="text-base font-bold text-red-600">{expiredCount}</div>
            <div className="text-[11px] font-medium text-stone-600">Expired Temp</div>
            <div className="text-[9px] text-stone-400">Treated as Blocked</div>
          </div>
          <div className="p-2 rounded-xl bg-white border border-stone-200 shadow-2xs">
            <div className="text-base font-bold text-red-700">{blockedCount}</div>
            <div className="text-[11px] font-medium text-stone-600">Blocked</div>
            <div className="text-[9px] text-stone-400">Physically Pruned</div>
          </div>
          <div className="p-2 rounded-xl bg-white border border-stone-200 shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-base font-bold text-stone-700">{revokedCount}</div>
            <div className="text-[11px] font-medium text-stone-600">Revoked</div>
            <div className="text-[9px] text-stone-400">Permanently Excluded</div>
          </div>
        </div>

        {/* Global Action Error Banner */}
        {actionError && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-700 font-semibold hover:underline text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search, Filter & Add Actions */}
        <div className="p-3 sm:px-6 border-b border-stone-200/70 bg-white flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex flex-1 items-center gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search memories by keyword or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:outline-none focus:border-stone-400 focus:bg-white text-stone-800 placeholder:text-stone-400"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs shrink-0 no-scrollbar">
              {["ALL", "ALLOWED", "TEMPORARY", "BLOCKED", "REVOKED"].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPolicy(p)}
                  className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                    filterPolicy === p
                      ? "bg-stone-900 text-stone-50"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {p === "ALL" ? "All" : p.charAt(0) + p.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-semibold cursor-pointer transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Memory</span>
          </button>
        </div>

        {/* Manual Add Memory Form (Expandable) */}
        {showAddForm && (
          <form
            onSubmit={handleCreateManualMemory}
            className="p-4 sm:px-6 bg-stone-50/70 border-b border-stone-200 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                Define Personal Memory Policy
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Memory Insight / Fact Summary
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Values early morning focus blocks for creative writing"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 text-stone-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 text-stone-800"
                >
                  <option value="Preferences">Preferences</option>
                  <option value="Goals">Goals</option>
                  <option value="Growth">Growth</option>
                  <option value="Relationships">Relationships</option>
                  <option value="Values">Values</option>
                  <option value="Health">Health</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-stone-200/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-700">Initial Policy:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewPolicy("ALLOWED")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      newPolicy === "ALLOWED"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    Allowed
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPolicy("TEMPORARY")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      newPolicy === "TEMPORARY"
                        ? "bg-amber-500 text-white"
                        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    Temporary
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPolicy("BLOCKED")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      newPolicy === "BLOCKED"
                        ? "bg-red-600 text-white"
                        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    Blocked
                  </button>
                </div>
              </div>

              {newPolicy === "TEMPORARY" && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium text-stone-700">Expires in:</span>
                  <select
                    value={newDurationMs}
                    onChange={(e) => setNewDurationMs(Number(e.target.value))}
                    className="px-2 py-1 text-xs bg-white rounded-md border border-stone-200 text-stone-800"
                  >
                    {DURATION_PRESETS.map((d) => (
                      <option key={d.ms} value={d.ms}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessingId === "new_memory" || !newSummary.trim()}
                className="ml-auto px-4 py-1.5 bg-stone-900 text-amber-400 text-xs font-semibold rounded-lg hover:bg-stone-800 disabled:opacity-50 cursor-pointer shadow-xs transition-colors"
              >
                {isProcessingId === "new_memory" ? "Saving..." : "Save Memory"}
              </button>
            </div>
          </form>
        )}

        {/* Memories List */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-2.5">
          {filteredMemories.length === 0 ? (
            <div className="py-12 text-center text-stone-400 flex flex-col items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-stone-200 mb-3 stroke-1" />
              <p className="text-sm font-medium text-stone-600">
                {memories.length === 0
                  ? "No personal memories recorded yet."
                  : "No memories match the active filter criteria."}
              </p>
              <p className="text-xs text-stone-400 mt-1 max-w-sm">
                Use "Scan for Potential Memories" while journaling to discover enduring insights, or click "Add Memory" above to explicitly authorize one.
              </p>
            </div>
          ) : (
            filteredMemories.map((mem) => {
              const isTemp = mem.policy === "TEMPORARY";
              const isExpired = isTemp && mem.expiresAt ? mem.expiresAt <= now : false;
              const isProcessing = isProcessingId === mem.id;

              return (
                <div
                  key={mem.id}
                  id={`memory-card-${mem.id}`}
                  className="p-3.5 rounded-xl border border-stone-200/80 bg-white hover:border-stone-300 transition-colors shadow-2xs flex flex-col sm:flex-row items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {/* Policy Badges */}
                      {mem.policy === "ALLOWED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          ALLOWED
                        </span>
                      )}

                      {mem.policy === "TEMPORARY" && !isExpired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          TEMPORARY (ACTIVE)
                        </span>
                      )}

                      {mem.policy === "TEMPORARY" && isExpired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
                          <ShieldAlert className="w-3 h-3 text-red-600" />
                          TEMPORARY (EXPIRED • BLOCKED)
                        </span>
                      )}

                      {mem.policy === "BLOCKED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-800 border border-red-200">
                          <ShieldAlert className="w-3 h-3 text-red-600" />
                          BLOCKED
                        </span>
                      )}

                      {mem.policy === "REVOKED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-100 text-stone-600 border border-stone-300">
                          <ShieldX className="w-3 h-3 text-stone-500" />
                          REVOKED
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                        {mem.category}
                      </span>

                      <span className="text-[10px] text-stone-400">
                        Updated {new Date(mem.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-normal text-stone-900 leading-relaxed">
                      {mem.summary}
                    </p>

                    {/* Expiration Details for TEMPORARY */}
                    {isTemp && (
                      <div className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${isExpired ? "text-red-600 font-medium" : "text-amber-700"}`}>
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>{formatExpiration(mem.expiresAt)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap sm:flex-col items-end gap-1.5 shrink-0">
                    {/* If ALLOWED, offer Block or Revoke */}
                    {mem.policy === "ALLOWED" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "BLOCKED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Block this memory from ever entering Gemini context"
                        >
                          Block
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "REVOKED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Permanently revoke this memory"
                        >
                          Revoke
                        </button>
                      </div>
                    )}

                    {/* If TEMPORARY, offer Block, Revoke, or Extend */}
                    {mem.policy === "TEMPORARY" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={isProcessing}
                          onClick={() => setEditingTempMemoryId(editingTempMemoryId === mem.id ? null : mem.id)}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Adjust expiration duration"
                        >
                          Extend
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "BLOCKED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Block
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "REVOKED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    )}

                    {/* If BLOCKED, offer Allow (explicit) or Revoke */}
                    {mem.policy === "BLOCKED" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "ALLOWED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Unblock and authorize for Gemini reflection"
                        >
                          Allow
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleUpdatePolicy(mem, "REVOKED")}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    )}

                    {/* If REVOKED: immutable notice & delete option */}
                    {mem.policy === "REVOKED" && (
                      <div className="flex items-center gap-1.5 text-xs text-stone-500">
                        <span className="italic text-[11px]">Excluded</span>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleDelete(mem.id)}
                          className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Purge record permanently from Firestore"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Quick delete for any policy if user wishes */}
                    {mem.policy !== "REVOKED" && (
                      <button
                        disabled={isProcessing}
                        onClick={() => handleDelete(mem.id)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded transition-colors cursor-pointer ml-auto"
                        title="Delete from Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline Duration Editor for TEMPORARY */}
                  {editingTempMemoryId === mem.id && (
                    <div className="w-full mt-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span className="font-medium text-stone-800">Set New Expiration:</span>
                        <select
                          value={selectedDurationMs}
                          onChange={(e) => setSelectedDurationMs(Number(e.target.value))}
                          className="px-2 py-1 text-xs bg-white rounded border border-stone-200"
                        >
                          {DURATION_PRESETS.map((d) => (
                            <option key={d.ms} value={d.ms}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdatePolicy(mem, "TEMPORARY", Date.now() + selectedDurationMs)}
                          className="px-2.5 py-1 bg-amber-600 text-white font-medium rounded hover:bg-amber-700 cursor-pointer"
                        >
                          Apply Expiration
                        </button>
                        <button
                          onClick={() => setEditingTempMemoryId(null)}
                          className="px-2 py-1 text-stone-600 hover:text-stone-900 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Policy Reference */}
        <div className="p-3 sm:px-6 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Pre-LLM Physical Pruning active. BLOCKED and REVOKED memories are never sent to Gemini.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-100 font-medium rounded-lg cursor-pointer transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

