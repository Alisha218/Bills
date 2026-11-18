import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FieldExtractionStatus } from "../types/bill";
import { PROVIDERS } from "../data/demoData";
import { BillReviewFormState, UploadedBillFile } from "../utils/fileUpload";

interface BillReviewPanelProps {
  uploadedFile: UploadedBillFile | null;
  form: BillReviewFormState;
  statusMap: Record<keyof BillReviewFormState, FieldExtractionStatus>;
  isExtractionMode: boolean;
  extractionNotes: string | null;
  rawOcrText?: string | null;
  ocrConfidence?: number | null;
  extractionMethod?: "pdf-text" | "pdf-ocr" | "image-ocr" | null;
  validationWarnings?: string[];
  validationError: string | null;
  confirmButtonLabel?: string;
  showSaveToTracker?: boolean;
  saveToTracker?: boolean;
  onToggleSaveToTracker?: (checked: boolean) => void;
  onChangeField: (
    field: keyof BillReviewFormState,
    value: string
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function StatusTag({ status }: { status?: FieldExtractionStatus }) {
  if (!status) return null;
  if (status === "extracted") {
    return (
      <span className="text-[11px] font-medium text-lime-300">Detected</span>
    );
  }
  if (status === "uncertain") {
    return (
      <span className="text-[11px] font-medium text-amber-300">
        Verify
      </span>
    );
  }
  if (status === "edited") {
    return (
      <span className="text-[11px] font-medium text-cyan-300">Edited</span>
    );
  }
  return <span className="text-[11px] text-slate-400">Not detected</span>;
}

export const BillReviewPanel: React.FC<BillReviewPanelProps> = ({
  uploadedFile,
  form,
  statusMap,
  isExtractionMode,
  extractionNotes,
  rawOcrText = null,
  ocrConfidence = null,
  extractionMethod = null,
  validationWarnings = [],
  validationError,
  confirmButtonLabel = "Confirm Details",
  showSaveToTracker = false,
  saveToTracker = true,
  onToggleSaveToTracker,
  onChangeField,
  onSubmit,
}) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [showRawOcr, setShowRawOcr] = useState(false);

  useEffect(() => {
    if (!uploadedFile || !uploadedFile.isPdf) {
      setPdfBlobUrl(null);
      return;
    }
    try {
      const byteString = atob(uploadedFile.base64);
      const bytes = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch {
      setPdfBlobUrl(null);
    }
  }, [uploadedFile]);

  const formKeys = Object.keys(statusMap) as Array<keyof BillReviewFormState>;
  const detectedCount = formKeys.filter(
    (k) => statusMap[k] === "extracted" || statusMap[k] === "edited"
  ).length;
  const uncertainCount = formKeys.filter(
    (k) => statusMap[k] === "uncertain"
  ).length;
  const missingCount = formKeys.filter((k) => statusMap[k] === "missing").length;

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-6"
    >
      {/* Review Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            {isExtractionMode
              ? "Review & Edit Extracted Bill Details"
              : "Enter Electricity Bill Details"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isExtractionMode
              ? "Check the values read from your bill. Any field labeled Not detected can be entered manually before confirming."
              : "Enter the printed values from your electricity bill."}
          </p>
        </div>

        {isExtractionMode && (
          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-lime-400 shrink-0" />
            <span className="text-lime-300 font-medium">
              {detectedCount} detected
            </span>
            {uncertainCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">
                  {uncertainCount} verify
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{missingCount} not detected</span>
          </div>
        )}
      </div>

      {extractionNotes && (
        <div className="flex items-start gap-2.5 rounded-lg bg-[#0B111C] border border-slate-800 px-4 py-3 text-xs text-slate-300">
          <AlertCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1 min-w-0">
            <span>{extractionNotes}</span>
            {ocrConfidence !== null && extractionMethod && (
              <div className="text-[11px] text-slate-400 font-mono">
                Method:{" "}
                {extractionMethod === "pdf-text"
                  ? "PDF selectable text"
                  : extractionMethod === "pdf-ocr"
                  ? "PDF page render + Tesseract OCR"
                  : "Tesseract image OCR"}{" "}
                · Confidence: {Math.round(ocrConfidence)}%
              </div>
            )}
          </div>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Please verify these flagged numbers</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-amber-100/90">
            {validationWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {validationError && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-xs text-rose-200">
          {validationError}
        </div>
      )}

      {/* Side-by-Side Preview + 12 Focused Bill Fields */}
      <div
        className={`grid grid-cols-1 ${
          uploadedFile ? "xl:grid-cols-12" : ""
        } gap-6 items-start`}
      >
        {uploadedFile && (
          <div className="xl:col-span-5 rounded-lg bg-[#090E17] border border-slate-800 p-4 space-y-3 xl:sticky xl:top-20">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-white truncate">
                {uploadedFile.name}
              </span>
              <span className="text-slate-400 font-mono shrink-0">
                {(uploadedFile.sizeBytes / 1024).toFixed(0)} KB
              </span>
            </div>

            {uploadedFile.isPdf ? (
              <div className="space-y-3">
                {pdfBlobUrl ? (
                  <object
                    data={pdfBlobUrl}
                    type="application/pdf"
                    aria-label={`PDF preview of ${uploadedFile.name}`}
                    className="w-full h-[420px] rounded border border-slate-800 bg-slate-950"
                  >
                    <div className="p-6 text-center text-xs text-slate-400">
                      Inline PDF preview is unavailable in this browser frame. Your PDF ({uploadedFile.name}) is attached and extracted.
                    </div>
                  </object>
                ) : (
                  <div className="p-6 rounded border border-slate-800 bg-slate-950 text-center text-xs text-slate-400">
                    PDF attached: {uploadedFile.name}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span>
                    Compare extracted fields on the right against your PDF bill.
                  </span>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded border border-slate-800 bg-slate-950">
                <img
                  src={uploadedFile.dataUrl}
                  alt={`Uploaded electricity bill preview: ${uploadedFile.name}`}
                  className="w-full max-h-[520px] object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>
        )}

        <div className={uploadedFile ? "xl:col-span-7 space-y-6" : "space-y-6"}>
          {/* Group 1: Provider, Month, Units & Meter Details */}
          <div>
            <h3 className="text-xs font-semibold text-cyan-300 mb-3">
              Provider, Units &amp; Meter Readings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-provider"
                    className="text-xs font-medium text-slate-300"
                  >
                    Electricity Provider *
                  </label>
                  {isExtractionMode && <StatusTag status={statusMap.provider} />}
                </div>
                <select
                  id="rev-provider"
                  value={form.provider}
                  onChange={(e) => onChangeField("provider", e.target.value)}
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">Not detected — select provider</option>
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-month"
                    className="text-xs font-medium text-slate-300"
                  >
                    Billing Month *
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.billingMonth} />
                  )}
                </div>
                <input
                  id="rev-month"
                  type="text"
                  placeholder="Not detected — e.g. October 2026"
                  value={form.billingMonth}
                  onChange={(e) => onChangeField("billingMonth", e.target.value)}
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-units"
                    className="text-xs font-medium text-slate-300"
                  >
                    Units Consumed (kWh) *
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.unitsConsumed} />
                  )}
                </div>
                <input
                  id="rev-units"
                  type="number"
                  min="0"
                  placeholder="Not detected — e.g. 418"
                  value={form.unitsConsumed}
                  onChange={(e) =>
                    onChangeField("unitsConsumed", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-rate"
                    className="text-xs font-medium text-slate-300"
                  >
                    Per-Unit Rate (PKR/kWh)
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.perUnitRate} />
                  )}
                </div>
                <input
                  id="rev-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Not detected (if printed)"
                  value={form.perUnitRate}
                  onChange={(e) => onChangeField("perUnitRate", e.target.value)}
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-prev-meter"
                    className="text-xs font-medium text-slate-300"
                  >
                    Previous Meter Reading
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.previousMeterReading} />
                  )}
                </div>
                <input
                  id="rev-prev-meter"
                  type="number"
                  min="0"
                  placeholder="Not detected"
                  value={form.previousMeterReading}
                  onChange={(e) =>
                    onChangeField("previousMeterReading", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-curr-meter"
                    className="text-xs font-medium text-slate-300"
                  >
                    Current Meter Reading
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.currentMeterReading} />
                  )}
                </div>
                <input
                  id="rev-curr-meter"
                  type="number"
                  min="0"
                  placeholder="Not detected"
                  value={form.currentMeterReading}
                  onChange={(e) =>
                    onChangeField("currentMeterReading", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-load"
                    className="text-xs font-medium text-slate-300"
                  >
                    Connected / Sanctioned Load (kW / Watts)
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.connectedLoad} />
                  )}
                </div>
                <input
                  id="rev-load"
                  type="text"
                  placeholder="Not detected (e.g. 2 kW or 1500 W if printed)"
                  value={form.connectedLoad}
                  onChange={(e) =>
                    onChangeField("connectedLoad", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Group 2: Charges, Totals & Due Date */}
          <div className="pt-4 border-t border-slate-800/70">
            <h3 className="text-xs font-semibold text-cyan-300 mb-3">
              Charges, Totals &amp; Due Date
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-elec"
                    className="text-xs font-medium text-slate-300"
                  >
                    Electricity Charges (PKR)
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.electricityCharges} />
                  )}
                </div>
                <input
                  id="rev-elec"
                  type="number"
                  min="0"
                  placeholder="Not detected"
                  value={form.electricityCharges}
                  onChange={(e) =>
                    onChangeField("electricityCharges", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-taxes"
                    className="text-xs font-medium text-slate-300"
                  >
                    Taxes &amp; Additional Charges (PKR)
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.taxesAndAdditionalCharges} />
                  )}
                </div>
                <input
                  id="rev-taxes"
                  type="number"
                  placeholder="Not detected"
                  value={form.taxesAndAdditionalCharges}
                  onChange={(e) =>
                    onChangeField("taxesAndAdditionalCharges", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-total"
                    className="text-xs font-medium text-slate-300"
                  >
                    Total Bill Amount (Within Due Date, PKR) *
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.totalBillAmount} />
                  )}
                </div>
                <input
                  id="rev-total"
                  type="number"
                  min="1"
                  placeholder="Not detected — e.g. 23840"
                  value={form.totalBillAmount}
                  onChange={(e) =>
                    onChangeField("totalBillAmount", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-after-due"
                    className="text-xs font-medium text-slate-300"
                  >
                    Amount Payable After Due Date (PKR)
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.amountAfterDueDate} />
                  )}
                </div>
                <input
                  id="rev-after-due"
                  type="number"
                  min="0"
                  placeholder="Not detected"
                  value={form.amountAfterDueDate}
                  onChange={(e) =>
                    onChangeField("amountAfterDueDate", e.target.value)
                  }
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="rev-due"
                    className="text-xs font-medium text-slate-300"
                  >
                    Due Date
                  </label>
                  {isExtractionMode && (
                    <StatusTag status={statusMap.dueDate} />
                  )}
                </div>
                <input
                  id="rev-due"
                  type="text"
                  placeholder="Not detected — e.g. 18 Nov 2026"
                  value={form.dueDate}
                  onChange={(e) => onChangeField("dueDate", e.target.value)}
                  className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Raw OCR Text Inspector for Verification */}
      {isExtractionMode && rawOcrText && (
        <div className="rounded-lg bg-[#090E17] border border-slate-800/90 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRawOcr((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-900/60 transition-colors"
          >
            <span>Extracted OCR Text (for verification)</span>
            {showRawOcr ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>
          {showRawOcr && (
            <div className="border-t border-slate-800/80 p-4">
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-300">
                {rawOcrText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Footer Submit Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
        {showSaveToTracker ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveToTracker}
              onChange={(e) => onToggleSaveToTracker?.(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-[#090E17] text-cyan-400"
            />
            Also save this month to Compare &amp; Track history
          </label>
        ) : (
          <span className="text-xs text-slate-400">
            Undetected fields remain marked Not detected unless you enter them.
          </span>
        )}

        <button
          type="submit"
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
        >
          {confirmButtonLabel}
        </button>
      </div>
    </form>
  );
};
