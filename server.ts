import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Standard payload parsing mounted FIRST before all routes
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));

// Model Fallback Ladder according to Production Directives
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",       // Primary
  "gemini-3.1-flash-lite",  // High-Availability Fallback
  "gemini-flash-latest",    // Dynamic Alias
  "gemini-3.7-flash",       // Deep Reasoning Fallback
] as const;

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. Requests will fail if key is required.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiClient;
}

// Resilient Model Fallback Helper
interface GenerateFallbackOptions {
  systemInstruction?: string;
  contents: any;
  temperature?: number;
}

async function generateContentWithFallback(options: GenerateFallbackOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini API] Attempting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      const responseText = response.text || "";
      if (responseText.trim().length > 0) {
        return { text: responseText, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || err?.code;
      const errorMessage = err?.message || String(err);
      console.warn(`[Gemini API] Model ${model} failed with error (${status}): ${errorMessage}`);

      // Recoverable error conditions: 503, 429, 404, 500, or model-not-found/quota
      const isRecoverable =
        status === 503 ||
        status === 429 ||
        status === 404 ||
        status === 500 ||
        /unavailable|quota|rate limit|resource exhausted|not found|overloaded/i.test(errorMessage);

      if (!isRecoverable && MODEL_FALLBACK_LADDER.indexOf(model) === MODEL_FALLBACK_LADDER.length - 1) {
        break;
      }
      // Continue to next model in ladder
    }
  }

  throw lastError || new Error("Failed to generate reflection across all Gemini models in the fallback chain.");
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Gemini Multi-turn Reflection & Journaling Endpoint
app.post("/api/gemini/reflect", async (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const {
      prompt,
      history = [],
      mode = "reflect",
      entryTitle = "Untitled Entry",
      entryContent = "",
    } = body;

    if (!prompt && (!history || history.length === 0) && !entryContent) {
      res.status(400).json({ error: "No reflection content or prompt provided." });
      return;
    }

    let systemInstruction = `You are a thoughtful, empathetic, and insightful AI journaling companion and reflection guide named "DearVault".
Your goal is to help the user unpack their thoughts, gain clarity, process feelings, brainstorm constructive next steps, and discover hidden patterns in their reflections.
Always maintain a warm, non-judgmental, grounded, and supportive tone.
Format your responses using clean Markdown with readable paragraphs, subtle bullet points when listing ideas, and occasional bold emphasis for key insights.`;

    if (mode === "summary") {
      systemInstruction += `\nMode Focus: Provide a structured summary of the user's reflection including:
1. **Core Theme & Emotional Tone**
2. **Key Events & Takeaways**
3. **Actionable Lessons or Potential Next Steps**`;
    } else if (mode === "brainstorm") {
      systemInstruction += `\nMode Focus: Brainstorm creative possibilities, fresh perspectives, practical solutions, and lateral angles to address what the user shared. Offer 3-5 distinct directions they could explore.`;
    } else if (mode === "reflect") {
      systemInstruction += `\nMode Focus: Deep psychological and mindful reflection. Acknowledge their experience empathetically, highlight implicit strengths or cognitive blind spots gently, and pose 1-2 open-ended reflection questions for deeper inquiry.`;
    }

    // Build conversation contents
    const contents: any[] = [];

    // Provide context about the current journal entry if supplied
    if (entryTitle || entryContent) {
      contents.push({
        role: "user",
        parts: [
          {
            text: `[CURRENT JOURNAL ENTRY]\nTitle: ${entryTitle || "Untitled"}\nContent:\n${entryContent || "(No written text provided)"}\n\n[USER INSTRUCTION]\nPlease read this entry and prepare to reflect on it with me.`,
          },
        ],
      });
      contents.push({
        role: "model",
        parts: [
          {
            text: `I have thoughtfully read your journal entry "${entryTitle || "Untitled"}". I'm here with you to reflect, synthesize, or brainstorm whenever you are ready.`,
          },
        ],
      });
    }

    // Append prior conversational turns if any
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || !turn.text) continue;
        const role = turn.role === "model" || turn.role === "assistant" ? "model" : "user";
        contents.push({
          role,
          parts: [{ text: String(turn.text) }],
        });
      }
    }

    // Append the active user prompt if it wasn't already in history
    if (prompt) {
      contents.push({
        role: "user",
        parts: [{ text: String(prompt) }],
      });
    }

    const result = await generateContentWithFallback({
      systemInstruction,
      contents,
      temperature: mode === "brainstorm" ? 0.85 : 0.65,
    });

    res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error("Gemini reflection error:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate reflection from Gemini.",
      code: error?.status || 500,
    });
  }
});

// Start server with Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
