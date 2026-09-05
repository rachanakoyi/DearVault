import React, { useState } from "react";
import { signInWithGoogle } from "../lib/firebase";
import { BookOpen, Sparkles, Shield, Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

interface LandingPageProps {
  onAuthSuccess?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      let msg = "Sign in failed. Please try again.";
      if (err?.code === "auth/popup-blocked") {
        msg = "Popup was blocked by your browser. Please allow popups for this site and retry.";
      } else if (err?.code === "auth/popup-closed-by-user") {
        msg = "Sign-in popup was closed before completing. Please try again.";
      } else if (err?.code === "auth/unauthorized-domain") {
        msg = "This domain is not yet authorized in Firebase Console. Please add this domain to Authorized Domains in Firebase Auth.";
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="w-full border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-amber-50 flex items-center justify-center font-serif text-lg shadow-sm">
              D
            </div>
            <span className="font-serif font-semibold text-lg tracking-tight text-stone-900">
              DearVault
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
              Journal & Reflection Studio
            </span>
          </div>
          <button
            id="nav-signin-btn"
            onClick={handleSignIn}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-stone-900 text-stone-50 hover:bg-stone-800 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Connecting..." : "Sign in with Google"}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          Powered by Gemini 3.6 Flash & Isolated Cloud Firestore
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif tracking-tight text-stone-900 max-w-3xl leading-[1.15]">
          A private sanctuary for your thoughts and deep reflections.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-stone-600 max-w-2xl font-normal leading-relaxed">
          Write freely. Converse multi-turn with Gemini to unpack cognitive patterns, synthesize complex feelings, and turn daily journaling into enduring clarity.
        </p>

        {error && (
          <div className="mt-6 max-w-md w-full p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5 text-left">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Authentication Notice</div>
              <div className="text-xs text-red-700 mt-0.5">{error}</div>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="hero-signin-btn"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl bg-stone-900 text-stone-50 hover:bg-stone-800 text-base font-medium shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
              />
            </svg>
            <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
            <ArrowRight className="w-4 h-4 text-stone-400" />
          </button>
        </div>

        {/* Value Pillars */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">Gemini Memory Firewall</h3>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Strict pre-LLM authorization. Gemini detects potential memories, but zero memories enter context without your explicit ALLOW, TEMPORARY, or BLOCK approval.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 border border-blue-200/60 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">Gemini 3.6 Flash Reflexes</h3>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Multi-turn conversational reflections with automated fallback resilience. Brainstorm actions, synthesize core takeaways, or explore deep emotional inquiry.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/60 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-stone-900 text-base">Owner-Bound Firestore Isolation</h3>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">
              Enforced by verified owner-bound Firestore security rules. Your reflections are cryptographically mapped to your authenticated UID and never leaked.
            </p>
          </div>
        </div>

        {/* Security Trust Badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-600">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            OAuth 2.0 Federated Identity
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Pre-LLM Physical Pruning
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Server-Side Gemini API Proxy
          </span>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-stone-200 py-6 text-center text-xs text-stone-600 bg-white">
        <p>DearVault — Built with Google AI Studio, Gemini 3.6 Flash & Firebase Firestore</p>
      </footer>
    </div>
  );
};
