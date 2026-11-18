import { createWorker, OEM, PSM, type Page } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { ExtractedBillPayload } from "../types/bill";
import { UploadedBillFile } from "./fileUpload";
import {
  OcrLineInfo,
  parsePakistaniElectricityBill,
} from "./pakistaniBillParser";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface OcrProgressUpdate {
  stage: string;
  progress: number; // 0 to 100
}

export interface LocalTextExtractionResult {
  text: string;
  confidence: number | null;
  method: "pdf-text" | "pdf-ocr" | "image-ocr";
  pageCount: number;
  lines: OcrLineInfo[];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Could not decode the uploaded image for OCR."));
    img.src = dataUrl;
  });
}

function preprocessImageToCanvas(
  img: HTMLImageElement,
  mode: "soft" | "binarized"
): HTMLCanvasElement {
  const maxDim = 2500;
  const targetMinLongSide = 1750;
  const srcLong = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  let scale = 1;
  if (srcLong > 0 && srcLong < targetMinLongSide) {
    scale = Math.min(2.4, targetMinLongSide / srcLong);
  } else if (srcLong > maxDim) {
    scale = maxDim / srcLong;
  }

  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  // Fill white first so transparent PNGs don't turn black
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelCount = width * height;
  const lum = new Uint8Array(pixelCount);

  let minLum = 255;
  let maxLum = 0;
  // Sample histogram to find 2nd and 98th percentile for robust contrast stretching
  const hist = new Uint32Array(256);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    );
    lum[p] = gray;
    hist[gray]++;
    if (gray < minLum) minLum = gray;
    if (gray > maxLum) maxLum = gray;
  }

  const lowTarget = Math.floor(pixelCount * 0.02);
  const highTarget = Math.floor(pixelCount * 0.98);
  let cumulative = 0;
  let pLow = minLum;
  let pHigh = maxLum;

  for (let v = 0; v < 256; v++) {
    cumulative += hist[v];
    if (cumulative >= lowTarget) {
      pLow = v;
      break;
    }
  }
  cumulative = 0;
  for (let v = 0; v < 256; v++) {
    cumulative += hist[v];
    if (cumulative >= highTarget) {
      pHigh = v;
      break;
    }
  }

  const span = Math.max(16, pHigh - pLow);

  if (mode === "soft") {
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const normalized = Math.min(
        255,
        Math.max(0, Math.round(((lum[p] - pLow) * 255) / span))
      );
      data[i] = normalized;
      data[i + 1] = normalized;
      data[i + 2] = normalized;
    }
  } else {
    // High-contrast threshold pass for dim/blurry scans
    const threshold = Math.round(pLow + span * 0.58);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const val = lum[p] < threshold ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function extractLinesFromPageData(page: Page): OcrLineInfo[] {
  const lines: OcrLineInfo[] = [];
  if (page.blocks && page.blocks.length > 0) {
    for (const block of page.blocks) {
      for (const para of block.paragraphs ?? []) {
        for (const line of para.lines ?? []) {
          const text = line.text.replace(/\s+/g, " ").trim();
          if (text) {
            lines.push({
              text,
              confidence: Number.isFinite(line.confidence)
                ? line.confidence
                : page.confidence,
            });
          }
        }
      }
    }
  }
  if (lines.length === 0 && page.text) {
    for (const raw of page.text.split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, " ").trim();
      if (text) {
        lines.push({
          text,
          confidence: Number.isFinite(page.confidence) ? page.confidence : 70,
        });
      }
    }
  }
  return lines;
}

async function createConfiguredWorker(
  onStatusProgress: (status: string, progress01: number) => void
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: `${origin}/tesseract/worker.min.js`,
    corePath: `${origin}/tesseract/core`,
    langPath: `${origin}/tesseract/tessdata`,
    workerBlobURL: false,
    gzip: true,
    logger: (m) => {
      if (typeof m?.progress === "number") {
        onStatusProgress(m.status || "Running OCR", m.progress);
      }
    },
  });

  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: PSM.AUTO,
  });

  return worker;
}

function countMeaningfulChars(text: string): number {
  return text.replace(/[^a-zA-Z0-9]/g, "").length;
}

/**
 * Extracts text from a raster image (JPEG, PNG, WEBP) using local Tesseract.js.
 */
export async function extractTextFromImage(
  file: UploadedBillFile,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<LocalTextExtractionResult> {
  onProgress?.({ stage: "Preparing bill image for local OCR...", progress: 8 });
  const img = await loadImageElement(file.dataUrl);
  const softCanvas = preprocessImageToCanvas(img, "soft");

  onProgress?.({ stage: "Loading local OCR engine...", progress: 18 });
  const worker = await createConfiguredWorker((status, pct) => {
    if (status === "recognizing text") {
      onProgress?.({
        stage: `Reading bill text locally (${Math.round(pct * 100)}%)...`,
        progress: Math.round(25 + pct * 55),
      });
    } else if (status.includes("loading")) {
      onProgress?.({
        stage: "Initializing offline OCR language data...",
        progress: Math.round(15 + pct * 10),
      });
    }
  });

  try {
    const firstResult = await worker.recognize(
      softCanvas,
      {},
      { text: true, blocks: true }
    );
    let bestPage = firstResult.data;
    let bestLines = extractLinesFromPageData(bestPage);
    let bestMeaningful = countMeaningfulChars(bestPage.text);

    // Fallback binarized pass if first pass got sparse or very low-confidence text
    if (bestMeaningful < 45 || bestPage.confidence < 48) {
      onProgress?.({
        stage: "Enhancing contrast for blurry/low-light scan...",
        progress: 82,
      });
      const binCanvas = preprocessImageToCanvas(img, "binarized");
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      const secondResult = await worker.recognize(
        binCanvas,
        {},
        { text: true, blocks: true }
      );
      const secondMeaningful = countMeaningfulChars(secondResult.data.text);
      if (
        secondMeaningful > bestMeaningful * 1.2 ||
        (secondMeaningful >= 25 &&
          secondResult.data.confidence > bestPage.confidence + 8)
      ) {
        bestPage = secondResult.data;
        bestLines = extractLinesFromPageData(bestPage);
      }
    }

    onProgress?.({ stage: "Parsing Pakistani bill fields...", progress: 95 });

    return {
      text: bestPage.text,
      confidence: Number.isFinite(bestPage.confidence)
        ? Math.round(bestPage.confidence)
        : null,
      method: "image-ocr",
      pageCount: 1,
      lines: bestLines,
    };
  } finally {
    await worker.terminate();
  }
}

function reconstructLinesFromPdfTextItems(items: Array<TextItem | { type: string }>): OcrLineInfo[] {
  const positioned = items
    .filter((it): it is TextItem => "str" in it && typeof it.str === "string")
    .map((it) => ({
      str: it.str,
      x: it.transform?.[4] ?? 0,
      y: it.transform?.[5] ?? 0,
      width: it.width ?? 0,
    }))
    .filter((it) => it.str.trim().length > 0);

  if (positioned.length === 0) return [];

  // Sort top-to-bottom (higher PDF Y first), then left-to-right
  positioned.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.5) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const rows: Array<typeof positioned> = [];
  for (const item of positioned) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow || Math.abs(lastRow[0].y - item.y) > 3.5) {
      rows.push([item]);
    } else {
      lastRow.push(item);
    }
  }

  return rows
    .map((row) => {
      row.sort((a, b) => a.x - b.x);
      let lineText = "";
      let prevEnd = -Infinity;
      for (const token of row) {
        const gap = token.x - prevEnd;
        if (lineText && gap > 2) {
          lineText += " ";
        }
        lineText += token.str;
        prevEnd = token.x + token.width;
      }
      return {
        text: lineText.replace(/\s+/g, " ").trim(),
        confidence: 98,
      };
    })
    .filter((l) => l.text.length > 0);
}

/**
 * Extracts text from a PDF bill locally using pdfjs-dist.
 * Uses selectable PDF text first; if scanned or empty, renders pages to canvas and runs Tesseract OCR.
 */
export async function extractTextFromPdf(
  file: UploadedBillFile,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<LocalTextExtractionResult> {
  onProgress?.({ stage: "Inspecting PDF document...", progress: 10 });
  const bytes = base64ToUint8Array(file.base64);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({
      data: bytes,
      standardFontDataUrl: origin ? `${origin}/pdfjs/standard_fonts/` : undefined,
    }).promise;
  } catch {
    throw new Error(
      "Could not open this PDF locally. It may be password-protected or corrupted."
    );
  }

  const maxPagesText = Math.min(pdf.numPages, 5);
  const allTextLines: OcrLineInfo[] = [];

  for (let p = 1; p <= maxPagesText; p++) {
    onProgress?.({
      stage: `Checking selectable text on PDF page ${p} of ${maxPagesText}...`,
      progress: Math.round(12 + (p / maxPagesText) * 18),
    });
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageLines = reconstructLinesFromPdfTextItems(
      content.items as Array<TextItem | { type: string }>
    );
    allTextLines.push(...pageLines);
  }

  const directText = allTextLines.map((l) => l.text).join("\n");
  if (countMeaningfulChars(directText) >= 60) {
    onProgress?.({ stage: "Parsing selectable PDF bill text...", progress: 92 });
    return {
      text: directText,
      confidence: 98,
      method: "pdf-text",
      pageCount: pdf.numPages,
      lines: allTextLines,
    };
  }

  // Scanned PDF fallback: render pages to canvas and run Tesseract OCR
  const maxPagesOcr = Math.min(pdf.numPages, 4);
  onProgress?.({
    stage: "Scanned PDF detected — rendering pages for local OCR...",
    progress: 32,
  });

  const worker = await createConfiguredWorker((status, pct) => {
    if (status === "recognizing text") {
      onProgress?.({
        stage: `Running OCR on scanned PDF (${Math.round(pct * 100)}%)...`,
        progress: Math.round(40 + pct * 50),
      });
    }
  });

  const combinedLines: OcrLineInfo[] = [];
  const pageTexts: string[] = [];
  const pageConfidences: number[] = [];

  try {
    for (let p = 1; p <= maxPagesOcr; p++) {
      onProgress?.({
        stage: `Rendering scanned PDF page ${p} of ${maxPagesOcr}...`,
        progress: Math.round(32 + ((p - 1) / maxPagesOcr) * 55),
      });
      const page = await pdf.getPage(p);
      const baseViewport = page.getViewport({ scale: 1 });
      const maxSide = Math.max(baseViewport.width, baseViewport.height);
      const renderScale = maxSide > 0 ? Math.min(2.3, 2200 / maxSide) : 2.0;
      const viewport = page.getViewport({ scale: Math.max(1.5, renderScale) });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({ canvas, viewport }).promise;

      const ocrRes = await worker.recognize(
        canvas,
        {},
        { text: true, blocks: true }
      );
      pageTexts.push(ocrRes.data.text);
      if (Number.isFinite(ocrRes.data.confidence)) {
        pageConfidences.push(ocrRes.data.confidence);
      }
      combinedLines.push(...extractLinesFromPageData(ocrRes.data));
    }

    onProgress?.({ stage: "Parsing extracted PDF bill fields...", progress: 95 });
    const avgConfidence =
      pageConfidences.length > 0
        ? Math.round(
            pageConfidences.reduce((a, b) => a + b, 0) / pageConfidences.length
          )
        : null;

    return {
      text: pageTexts.join("\n"),
      confidence: avgConfidence,
      method: "pdf-ocr",
      pageCount: pdf.numPages,
      lines: combinedLines,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Full local bill extraction pipeline (100% browser-side, zero paid APIs or network OCR).
 */
export async function extractBillLocally(
  file: UploadedBillFile,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<ExtractedBillPayload> {
  const extraction = file.isPdf
    ? await extractTextFromPdf(file, onProgress)
    : await extractTextFromImage(file, onProgress);

  if (countMeaningfulChars(extraction.text) < 12) {
    throw new Error(
      file.isPdf
        ? "No readable text was found in this PDF even after local OCR. Please check that the PDF contains a clear electricity bill page, or fill in the visible details manually."
        : "Tesseract OCR could not detect readable text on this image. Please try a sharper, well-lit photo of your bill or fill in the visible details manually."
    );
  }

  onProgress?.({ stage: "Validating extracted bill numbers...", progress: 98 });

  const parsed = parsePakistaniElectricityBill({
    rawText: extraction.text,
    ocrConfidence: extraction.confidence,
    extractionMethod: extraction.method,
    lines: extraction.lines,
  });

  onProgress?.({ stage: "Ready for review", progress: 100 });
  return parsed;
}
