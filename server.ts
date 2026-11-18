import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseJsonSafely<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFences) as T;
  } catch {
    return null;
  }
}

function toCleanNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toCleanString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

function normalizeExtractedPayload(raw: Record<string, unknown>) {
  const uncertainFields = Array.isArray(raw.uncertainFields)
    ? raw.uncertainFields.map((v) => String(v))
    : [];

  return {
    provider: toCleanString(raw.provider),
    consumerNumber: toCleanString(raw.consumerNumber),
    billingMonth: toCleanString(raw.billingMonth),
    issueDate: toCleanString(raw.issueDate),
    dueDate: toCleanString(raw.dueDate),
    unitsConsumed: toCleanNumber(raw.unitsConsumed),
    previousMeterReading: toCleanNumber(raw.previousMeterReading),
    currentMeterReading: toCleanNumber(raw.currentMeterReading),
    totalBillAmount: toCleanNumber(raw.totalBillAmount),
    amountAfterDueDate: toCleanNumber(raw.amountAfterDueDate),
    previousBillAmount: toCleanNumber(raw.previousBillAmount),
    previousUnitsConsumed: toCleanNumber(raw.previousUnitsConsumed),
    meterPhase: toCleanString(raw.meterPhase),
    electricityCharges: toCleanNumber(raw.electricityCharges),
    fuelPriceAdjustment: toCleanNumber(raw.fuelPriceAdjustment),
    taxes: toCleanNumber(raw.taxes),
    duties: toCleanNumber(raw.duties),
    fixedCharges: toCleanNumber(raw.fixedCharges),
    otherAdjustments: toCleanNumber(raw.otherAdjustments),
    uncertainFields,
    extractionNotes: toCleanString(raw.extractionNotes),
  };
}

function formatGeminiError(err: unknown): {
  status: number;
  code: string;
  message: string;
  upstreamStatus: number;
  upstreamDetail: string;
} {
  const anyErr = err as { status?: number; message?: string } | undefined;
  const upstreamStatus = typeof anyErr?.status === "number" ? anyErr.status : 500;
  const rawMsg = typeof anyErr?.message === "string" ? anyErr.message : String(err ?? "");

  if (
    rawMsg.includes("free tier is not available") ||
    rawMsg.includes("billing")
  ) {
    return {
      status: 403,
      code: "AI_BILLING_REQUIRED",
      message:
        "Gemini API free tier is not available for this project. Enable billing or select a billing-enabled API key in Settings > Secrets to run automatic bill extraction. Your uploaded bill remains attached so you can enter values manually in the meantime.",
      upstreamStatus,
      upstreamDetail: rawMsg.slice(0, 400),
    };
  }

  if (
    upstreamStatus === 403 ||
    rawMsg.includes("PERMISSION_DENIED") ||
    rawMsg.includes("API_KEY_INVALID") ||
    (upstreamStatus === 400 && rawMsg.includes("API key"))
  ) {
    return {
      status: 503,
      code: "AI_KEY_INVALID_OR_SCOPE",
      message:
        "Gemini API credentials are invalid or lack permission in this environment. Check Settings > Secrets or enter bill details manually.",
      upstreamStatus,
      upstreamDetail: rawMsg.slice(0, 400),
    };
  }

  if (upstreamStatus === 429 || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      code: "AI_QUOTA_EXCEEDED",
      message:
        "AI extraction quota was temporarily reached. Wait a moment and retry, or fill in the bill details manually.",
      upstreamStatus,
      upstreamDetail: rawMsg.slice(0, 400),
    };
  }

  return {
    status: 502,
    code: "EXTRACTION_FAILED",
    message:
      "We couldn't read clear fields from this document. Try a sharper photo or PDF, retry extraction, or fill in the missing details manually.",
    upstreamStatus,
    upstreamDetail: rawMsg.slice(0, 400),
  };
}

const BILL_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    provider: { type: Type.STRING, nullable: true },
    consumerNumber: { type: Type.STRING, nullable: true },
    billingMonth: { type: Type.STRING, nullable: true },
    issueDate: { type: Type.STRING, nullable: true },
    dueDate: { type: Type.STRING, nullable: true },
    unitsConsumed: { type: Type.NUMBER, nullable: true },
    previousMeterReading: { type: Type.NUMBER, nullable: true },
    currentMeterReading: { type: Type.NUMBER, nullable: true },
    totalBillAmount: { type: Type.NUMBER, nullable: true },
    amountAfterDueDate: { type: Type.NUMBER, nullable: true },
    previousBillAmount: { type: Type.NUMBER, nullable: true },
    previousUnitsConsumed: { type: Type.NUMBER, nullable: true },
    meterPhase: { type: Type.STRING, nullable: true },
    electricityCharges: { type: Type.NUMBER, nullable: true },
    fuelPriceAdjustment: { type: Type.NUMBER, nullable: true },
    taxes: { type: Type.NUMBER, nullable: true },
    duties: { type: Type.NUMBER, nullable: true },
    fixedCharges: { type: Type.NUMBER, nullable: true },
    otherAdjustments: { type: Type.NUMBER, nullable: true },
    uncertainFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    extractionNotes: { type: Type.STRING, nullable: true },
  },
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    const rawKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    const ai = getGeminiClient();
    res.json({
      ok: true,
      aiAvailable: Boolean(ai),
      keyConfigured: rawKey.length > 0 && rawKey !== "MY_GEMINI_API_KEY",
      keyLength: rawKey.length,
    });
  });

  app.post("/api/analyze-bill", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "AI bill reading is unavailable because no Gemini API key is configured in Settings > Secrets. Your uploaded file is kept visible so you can fill details manually or retry once configured.",
        code: "AI_UNAVAILABLE",
      });
      return;
    }

    const { base64Data, mimeType } = req.body ?? {};
    if (
      !base64Data ||
      typeof base64Data !== "string" ||
      !mimeType ||
      typeof mimeType !== "string"
    ) {
      res.status(400).json({
        error:
          "Invalid upload payload. Please select a PNG, JPEG, WEBP image or a PDF bill.",
        code: "INVALID_INPUT",
      });
      return;
    }

    const normalizedMime = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedMimeTypes.includes(normalizedMime)) {
      res.status(400).json({
        error:
          "Unsupported file format. Please upload a PNG, JPEG, WEBP image or a PDF utility bill.",
        code: "UNSUPPORTED_TYPE",
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: base64Data,
              },
            },
            {
              text: [
                "You are extracting structured billing data from a Pakistani electricity utility bill (such as K-Electric, LESCO, IESCO, FESCO, MEPCO, HESCO, GEPCO, QESCO, PESCO, SEPCO, TESCO).",
                "Extract ONLY values that are clearly printed on the document. NEVER guess, calculate, or invent missing fields.",
                "If a field is not present or completely illegible, return null for that field.",
                "If a printed value is blurry, partially cut off, or ambiguous, still return your best reading AND include that exact field name in `uncertainFields`.",
                "Field rules:",
                "- provider: normalize to K-Electric, LESCO, IESCO, FESCO, MEPCO, HESCO, GEPCO, QESCO, or Other.",
                "- consumerNumber: Consumer ID / Account Number / Reference Number printed on the bill.",
                "- billingMonth: e.g. 'October 2026'.",
                "- issueDate & dueDate: printed dates as strings (e.g. '04 Nov 2026').",
                "- unitsConsumed: total kWh units billed in this cycle.",
                "- previousMeterReading & currentMeterReading: meter readings printed on the bill.",
                "- totalBillAmount: Payable Within Due Date (numeric PKR, no commas).",
                "- amountAfterDueDate: Payable After Due Date (numeric PKR).",
                "- electricityCharges: Cost of Electricity / Variable Charges.",
                "- fuelPriceAdjustment: FPA / Fuel Charges Adjustment.",
                "- taxes: combined GST, Income Tax, Further Tax, Extra Tax, PTV Fee, NJ/FC Surcharge if shown (or null if absent).",
                "- duties: Electricity Duty.",
                "- fixedCharges: Fixed / Meter Rent / Service Charges.",
                "- otherAdjustments: QTA, Arrears, or other printed adjustments.",
                "- uncertainFields: array of exact property names above whose printed values were blurry or ambiguous.",
              ].join("\n"),
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: BILL_EXTRACTION_SCHEMA,
        },
      });

      const parsed = parseJsonSafely<Record<string, unknown>>(response.text);
      if (!parsed) {
        res.status(502).json({
          error:
            "The AI returned an unreadable extraction response. You can retry extraction or enter the visible values manually.",
          code: "PARSE_FAILED",
        });
        return;
      }

      const normalized = normalizeExtractedPayload(parsed);
      res.json({ extracted: normalized });
    } catch (err) {
      console.error("Bill extraction error:", err);
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({
        error: mapped.message,
        code: mapped.code,
        upstreamStatus: mapped.upstreamStatus,
        upstreamDetail: mapped.upstreamDetail,
      });
    }
  });

  app.post("/api/explain-bill", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: "AI explanation unavailable",
        code: "AI_UNAVAILABLE",
      });
      return;
    }

    const { bill } = req.body ?? {};
    if (!bill || typeof bill !== "object") {
      res.status(400).json({ error: "Missing bill payload" });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          "You are an energy analyst creating a neutral, evidence-based bill investigation for a Pakistani electricity consumer.",
          "Base your response STRICTLY on the bill numbers provided below. Do NOT invent missing charges, slabs, or tariffs.",
          "Never claim a bill is fraudulent or wrong simply because it is high. Distinguish consumption changes from higher average billing cost per unit only when prior data supports it.",
          `Confirmed Bill JSON: ${JSON.stringify(bill)}`,
        ].join("\n\n"),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verdictHeadline: { type: Type.STRING },
              summary: { type: Type.STRING },
              driverAnalysis: { type: Type.STRING },
              termExplanations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    amountNote: { type: Type.STRING, nullable: true },
                    explanation: { type: Type.STRING },
                  },
                },
              },
              itemsToVerify: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              practicalNextSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = parseJsonSafely<Record<string, unknown>>(response.text);
      if (!parsed) {
        res.status(502).json({ error: "Empty or malformed AI explanation" });
        return;
      }

      res.json({ explanation: parsed });
    } catch (err) {
      console.error("Bill explanation error:", err);
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post("/api/compare-bills", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: "AI comparison unavailable", code: "AI_UNAVAILABLE" });
      return;
    }

    const { previousBill, currentBill, deterministicDiff } = req.body ?? {};
    if (!previousBill || !currentBill || !deterministicDiff) {
      res.status(400).json({ error: "Missing comparison bill payloads" });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          "Write a concise, strictly evidence-based explanation starting naturally with why the electricity bill changed between the previous month and current month.",
          "Do NOT invent numbers or claim causes not supported by the provided comparison JSON. If itemized charges are missing, explicitly note that.",
          `Previous Bill: ${JSON.stringify(previousBill)}`,
          `Current Bill: ${JSON.stringify(currentBill)}`,
          `Deterministic Comparison: ${JSON.stringify(deterministicDiff)}`,
        ].join("\n\n"),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              becauseSummary: { type: Type.STRING },
              verificationFlags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = parseJsonSafely<Record<string, unknown>>(response.text);
      if (!parsed) {
        res.status(502).json({ error: "Invalid AI comparison response" });
        return;
      }

      res.json({ comparison: parsed });
    } catch (err) {
      console.error("Bill comparison error:", err);
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  app.post("/api/explain-simulator", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ error: "AI explanation unavailable", code: "AI_UNAVAILABLE" });
      return;
    }

    const { totalKwh, estimatedBillPkr, ratePkr, topAppliances, actualBilledUnits } =
      req.body ?? {};
    if (typeof totalKwh !== "number" || !Array.isArray(topAppliances)) {
      res.status(400).json({ error: "Invalid simulator payload" });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          "Give a concise, practical energy briefing for a Pakistani household based strictly on these appliance simulation figures.",
          "Do not promise guaranteed savings or invent official DISCO tariff slabs.",
          `Total simulated kWh: ${totalKwh}, Actual billed units reference: ${actualBilledUnits ?? "none"}, Rate basis: PKR ${ratePkr}/kWh, Estimated energy cost: PKR ${estimatedBillPkr}, Top appliances: ${JSON.stringify(topAppliances)}`,
        ].join("\n"),
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              insights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = parseJsonSafely<Record<string, unknown>>(response.text);
      if (!parsed) {
        res.status(502).json({ error: "Empty response from AI" });
        return;
      }

      res.json({ advice: parsed });
    } catch (err) {
      console.error("Simulator explanation error:", err);
      const mapped = formatGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexHtml = path.join(distDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bill Check server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
