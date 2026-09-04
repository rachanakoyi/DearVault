import React from "react";
import { Shield, X, Lock, CheckCircle2, Server, Key, Database, AlertCircle } from "lucide-react";

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-900">
                Agentic Threat Model & Security Controls
              </h2>
              <p className="text-xs text-stone-500">
                5 Threat Zones & OWASP Top 10 Mitigation Matrix
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 text-stone-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-stone-700">
          {/* Summary Table */}
          <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-100/75 border-b border-stone-200 text-[11px] font-semibold text-stone-700">
                  <th className="p-3">Threat Zone</th>
                  <th className="p-3">Specific Risk Vectors</th>
                  <th className="p-3">Enforced Countermeasures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-[11px]">
                <tr>
                  <td className="p-3 font-semibold text-stone-900 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    1. Input Surfaces
                  </td>
                  <td className="p-3 text-stone-600">
                    Prompt injection, oversized payloads, malformed JSON objects
                  </td>
                  <td className="p-3 text-stone-800">
                    Strict body-parser limits (4MB), typed schemas, defensive null-safe destructuring, client & server sanitization.
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-stone-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    2. Planning & Reasoning
                  </td>
                  <td className="p-3 text-stone-600">
                    System instruction bypass, behavioral drift, hallucinated reflection
                  </td>
                  <td className="p-3 text-stone-800">
                    Immutable system persona instructions, contextual role separation, temperature bounding (0.65 - 0.85).
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-stone-900 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    3. Tool Execution
                  </td>
                  <td className="p-3 text-stone-600">
                    API credential exfiltration, SSRF, client-side key exposure
                  </td>
                  <td className="p-3 text-stone-800">
                    Zero client-side API keys. Express backend proxy keeps GEMINI_API_KEY server-side. Resilient 4-tier model fallback ladder.
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-stone-900 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    4. Memory & State
                  </td>
                  <td className="p-3 text-stone-600">
                    Cross-user data leakage, unauthenticated reads, undefined-crash injections
                  </td>
                  <td className="p-3 text-stone-800">
                    Owner-bound Firestore Security Rules (<code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">request.auth.uid == userId</code>), zero insecure defaults, strict undefined-stripping prior to SDK writes.
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-stone-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    5. Inter-System Comm
                  </td>
                  <td className="p-3 text-stone-600">
                    Token hijacking, insecure credential transit, OAuth spoofing
                  </td>
                  <td className="p-3 text-stone-800">
                    Firebase Google OAuth 2.0 federated authentication, zero stored passwords, HTTPS transport, and isolated session listeners.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Active Security Architecture */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="font-semibold text-stone-900 flex items-center gap-1.5 mb-1 text-[11px]">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Firestore User Isolation Rule
              </div>
              <pre className="text-[10px] bg-stone-900 text-stone-200 p-2.5 rounded-lg overflow-x-auto font-mono">
{`match /users/{userId} {
  allow read, write: if request.auth != null 
    && request.auth.uid == userId;
}`}
              </pre>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
              <div className="font-semibold text-stone-900 flex items-center gap-1.5 mb-1 text-[11px]">
                <Server className="w-3.5 h-3.5 text-blue-600" />
                Gemini Resilient Fallback Ladder
              </div>
              <pre className="text-[10px] bg-stone-900 text-stone-200 p-2.5 rounded-lg overflow-x-auto font-mono">
{`1. gemini-3.6-flash (Primary)
2. gemini-3.1-flash-lite (HA Fallback)
3. gemini-flash-latest (Dynamic Alias)
4. gemini-3.7-flash (Deep Reasoning)`}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition-colors"
          >
            Close Threat Model
          </button>
        </div>
      </div>
    </div>
  );
};
