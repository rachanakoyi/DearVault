import React, { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";
import { InteractionMessage, ReflectionMode } from "../types";
import {
  Send,
  Sparkles,
  User,
  Bot,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  AlertTriangle,
  Lightbulb,
  FileText,
  HeartHandshake,
  MessageSquare,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface ReflectionThreadProps {
  messages: InteractionMessage[];
  onSendMessage: (text: string, mode?: ReflectionMode) => void;
  onTriggerLens?: (mode: ReflectionMode) => void;
  isGenerating: boolean;
  error: string | null;
  onRetryLastMessage?: () => void;
  entryTitle: string;
}

export const ReflectionThread: React.FC<ReflectionThreadProps> = ({
  messages,
  onSendMessage,
  onTriggerLens,
  isGenerating,
  error,
  onRetryLastMessage,
  entryTitle,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevIsGeneratingRef = useRef(isGenerating);

  // Scroll ONLY the internal reflection messages container when genuinely new messages appear
  useEffect(() => {
    const hasNewMessage = messages.length > prevMessagesLengthRef.current;
    const startedGenerating = isGenerating && !prevIsGeneratingRef.current;

    if (hasNewMessage || startedGenerating) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }

    prevMessagesLengthRef.current = messages.length;
    prevIsGeneratingRef.current = isGenerating;
  }, [messages.length, isGenerating]);

  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim(), "chat");
    setInputText("");
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedId(null);
      copyTimeoutRef.current = null;
    }, 2000);
  };

  const getModeIcon = (mode?: ReflectionMode) => {
    switch (mode) {
      case "reflect":
        return <HeartHandshake className="w-3 h-3 text-[#137333]" />;
      case "summary":
        return <FileText className="w-3 h-3 text-[#1a73e8]" />;
      case "brainstorm":
        return <Lightbulb className="w-3 h-3 text-[#b06000]" />;
      default:
        return <MessageSquare className="w-3 h-3 text-[#747775]" />;
    }
  };

  const getModeLabel = (mode?: ReflectionMode) => {
    switch (mode) {
      case "reflect":
        return "Empathetic Reflection";
      case "summary":
        return "Synthesized Summary";
      case "brainstorm":
        return "Brainstorm Angle";
      default:
        return "Reflection Turn";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 sm:px-6 border-b border-stone-200/60 flex items-center justify-between bg-[#fcfcfb] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
              Gemini Reflection Companion
            </h3>
            <p className="text-[11px] text-stone-500 truncate max-w-[180px] sm:max-w-xs">
              Conversing on: <span className="font-medium text-stone-700">{entryTitle || "Current Entry"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium text-amber-900 bg-amber-100/70 border border-amber-200/60 shrink-0">
          <Cpu className="w-3 h-3 text-amber-700" />
          <span>Gemini 3.6 Flash</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={messagesContainerRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-medium text-stone-700">
              No reflections generated yet for this entry.
            </p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs">
              Use one of the reflection launchers in the editor, or write a custom reflection prompt below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isModel = msg.role === "model";
            return (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex flex-col text-left ${isModel ? "items-start" : "items-end"}`}
              >
                {/* User message card */}
                {!isModel && (
                  <div className="max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm bg-stone-900 text-stone-50 shadow-xs leading-relaxed">
                    <div className="text-[10px] text-stone-400 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>You</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                )}

                {/* Gemini Model message card */}
                {isModel && (
                  <div className="w-full rounded-2xl p-4 sm:p-5 border border-stone-200/90 bg-[#fafaf9] shadow-2xs text-xs sm:text-sm">
                    {/* Header meta */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 mb-3 border-b border-stone-200/70">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-stone-900 text-amber-400 flex items-center justify-center shrink-0">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                          Gemini 3.6 Flash
                        </span>
                        {msg.mode && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                            {getModeIcon(msg.mode)}
                            <span>{getModeLabel(msg.mode)}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-stone-400">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy text"
                          className="hover:text-stone-700 p-1 rounded hover:bg-stone-200/60 cursor-pointer transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Markdown Content */}
                    <div className="markdown-body prose prose-stone prose-xs sm:prose-sm max-w-none space-y-2.5 text-stone-800 leading-relaxed">
                      <Markdown>{msg.text}</Markdown>
                    </div>

                    {/* Transparency Attribution & Memory Influence */}
                    <div className="mt-4 pt-3 border-t border-stone-200/80 text-[11px]">
                      {msg.influencedBy && msg.influencedBy.length > 0 ? (
                        <div className="space-y-1.5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-emerald-900 bg-emerald-50 border border-emerald-200/80">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>
                              Response influenced by {msg.influencedBy.length} authorized {msg.influencedBy.length === 1 ? "memory" : "memories"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pl-1 pt-1">
                            {msg.influencedBy.map((item, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-stone-800 border border-emerald-200 text-[10px]"
                                title={item.summary}
                              >
                                <span className="font-semibold text-emerald-800">[{item.category}]</span>
                                <span className="truncate max-w-[220px] sm:max-w-xs">{item.summary}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-stone-400">
                          <Shield className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>No stored memories influenced this response</span>
                        </div>
                      )}

                      {/* Redaction Applied Alert (Output Guard Defense-in-Depth) */}
                      {msg.redactionApplied && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-medium">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Output Guard: Redacted matching blocked or revoked content.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Generating Indicator */}
        {isGenerating && (
          <div className="flex gap-3 items-center p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/50 text-xs text-amber-900">
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <span>Gemini is reflecting and synthesizing insights...</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            {onRetryLastMessage && (
              <button
                onClick={onRetryLastMessage}
                className="px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-900 font-medium text-[11px] shrink-0 cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:p-4 bg-[#fcfcfb] border-t border-stone-200/60 flex items-center gap-2 shrink-0"
      >
        <input
          id="chat-turn-input"
          type="text"
          placeholder="Ask a question or continue reflecting with Gemini..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isGenerating}
          className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-white rounded-xl border border-stone-200/90 focus:outline-none focus:border-stone-400 text-stone-800 placeholder:text-stone-400 disabled:opacity-50 transition-colors"
        />
        <button
          id="send-chat-turn-btn"
          type="submit"
          disabled={isGenerating || !inputText.trim()}
          className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-400 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs shrink-0"
          title="Send Reflection Prompt"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
