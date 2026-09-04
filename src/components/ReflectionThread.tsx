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
} from "lucide-react";

interface ReflectionThreadProps {
  messages: InteractionMessage[];
  onSendMessage: (text: string, mode?: ReflectionMode) => void;
  isGenerating: boolean;
  error: string | null;
  onRetryLastMessage?: () => void;
  entryTitle: string;
}

export const ReflectionThread: React.FC<ReflectionThreadProps> = ({
  messages,
  onSendMessage,
  isGenerating,
  error,
  onRetryLastMessage,
  entryTitle,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, error]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    onSendMessage(inputText.trim(), "chat");
    setInputText("");
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModeIcon = (mode?: ReflectionMode) => {
    switch (mode) {
      case "reflect":
        return <HeartHandshake className="w-3 h-3 text-amber-600" />;
      case "summary":
        return <FileText className="w-3 h-3 text-purple-600" />;
      case "brainstorm":
        return <Lightbulb className="w-3 h-3 text-blue-600" />;
      default:
        return <MessageSquare className="w-3 h-3 text-stone-600" />;
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
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:px-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-stone-900 text-amber-50 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-stone-900">
              Gemini Dialogue & Reflection
            </h3>
            <p className="text-[11px] text-stone-500 truncate max-w-[200px] sm:max-w-xs">
              Context: {entryTitle || "Current Entry"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
          <Cpu className="w-3 h-3 text-stone-600" />
          <span>Gemini 3.6 Flash</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-stone-700">
              No conversational turns yet for this entry.
            </p>
            <p className="text-[11px] text-stone-500 mt-1 max-w-xs leading-relaxed">
              Click one of the AI buttons on the left (e.g. <em>Empathetic Reflection</em> or <em>Synthesize</em>) or type a question below to start exploring your thoughts.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isModel = msg.role === "model";
            return (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex gap-3 text-left ${isModel ? "items-start" : "items-start flex-row-reverse"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-medium ${
                    isModel
                      ? "bg-amber-100/80 text-amber-900 border border-amber-200"
                      : "bg-stone-800 text-stone-100"
                  }`}
                >
                  {isModel ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isModel
                      ? "bg-stone-50 border border-stone-200/80 text-stone-800"
                      : "bg-stone-900 text-stone-50 shadow-xs"
                  }`}
                >
                  {/* Meta Bar */}
                  <div
                    className={`flex items-center gap-2 mb-2 pb-1.5 border-b text-[10px] ${
                      isModel
                        ? "border-stone-200/60 text-stone-500"
                        : "border-stone-800 text-stone-400"
                    }`}
                  >
                    <span className="font-semibold flex items-center gap-1">
                      {isModel ? (
                        <>
                          {getModeIcon(msg.mode)}
                          <span>{getModeLabel(msg.mode)}</span>
                        </>
                      ) : (
                        "You"
                      )}
                    </span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {msg.modelUsed && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[9px] text-amber-700 bg-amber-100/50 px-1 rounded">
                          {msg.modelUsed}
                        </span>
                      </>
                    )}
                    {isModel && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        title="Copy text"
                        className="ml-auto hover:text-stone-700 p-0.5 rounded cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Message Content */}
                  {isModel ? (
                    <div className="markdown-body prose prose-stone prose-xs max-w-none space-y-2 text-stone-800">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Generating Indicator */}
        {isGenerating && (
          <div className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 shrink-0 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs text-stone-600 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span>Gemini is reflecting and synthesizing insights...</span>
            </div>
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

        <div ref={scrollEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 sm:px-4 bg-stone-50/90 border-t border-stone-200 flex items-center gap-2"
      >
        <input
          id="chat-turn-input"
          type="text"
          placeholder="Ask a question or continue reflecting with Gemini..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isGenerating}
          className="flex-1 px-3.5 py-2 text-xs bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 text-stone-900 placeholder:text-stone-400 disabled:opacity-50"
        />
        <button
          id="send-chat-turn-btn"
          type="submit"
          disabled={isGenerating || !inputText.trim()}
          className="p-2 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
