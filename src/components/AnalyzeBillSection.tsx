import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Edit3,
  RotateCcw,
  GitCompare,
  CheckSquare,
  HelpCircle,
} from "lucide-react";
import {
  BillBreakdown,
  BillInvestigationReport,
  BillRecord,
  FieldExtractionStatus,
  ProviderName,
} from "../types/bill";
import {
  calculateAverageCostPerUnit,
  calculatePercentageChange,
  formatNumber,
  formatPkr,
  generateLocalBillInvestigation,
} from "../utils/calculations";
import {
  BillReviewFormState,
  EMPTY_BILL_FORM,
  UploadedBillFile,
  mapExtractedToFormAndStatus,
  readBillFile,
} from "../utils/fileUpload";
import {
  OcrProgressUpdate,
  extractBillLocally,
} from "../utils/localOcrExtractor";
import { BillReviewPanel } from "./BillReviewPanel";

interface AnalyzeBillSectionProps {
  activeBill: BillRecord | null;
  previousBillForContext?: BillRecord | null;
  isDemoMode: boolean;
  onApplyAnalyzedBill: (bill: BillRecord, addToHistory: boolean) => void;
  onNavigateBreakdown: () => void;
  onNavigateDifference: () => void;
}

const DEFAULT_STATUS_MAP: Record<
  keyof BillReviewFormState,
  FieldExtractionStatus
> = Object.keys(EMPTY_BILL_FORM).reduce((acc, k) => {
  acc[k as keyof BillReviewFormState] = "missing";
  return acc;
}, {} as Record<keyof BillReviewFormState, FieldExtractionStatus>);

function toNullableNumber(val: string, allowNegative = false): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  if (!allowNegative && num < 0) return null;
  return num;
}

function getCombinedTaxesAndAdditionalCharges(breakdown: BillBreakdown): number | null {
  const parts = [
    breakdown.taxes,
    breakdown.duties,
    breakdown.fuelPriceAdjustment,
    breakdown.fixedCharges,
    breakdown.otherAdjustments,
  ].filter((v): v is number => v !== null && v !== undefined);
  if (parts.length === 0) return null;
  return parts.reduce((sum, v) => sum + v, 0);
}

export const AnalyzeBillSection: React.FC<AnalyzeBillSectionProps> = ({
  activeBill,
  previousBillForContext = null,
  isDemoMode,
  onApplyAnalyzedBill,
  onNavigateBreakdown,
  onNavigateDifference,
}) => {
  const [entryMode, setEntryMode] = useState<"upload" | "manual">("upload");
  const [workflowStage, setWorkflowStage] = useState<
    "idle" | "review" | "analyzed"
  >(activeBill ? "analyzed" : "idle");

  const [uploadedFile, setUploadedFile] = useState<UploadedBillFile | null>(
    null
  );
  const [form, setForm] = useState<BillReviewFormState>(EMPTY_BILL_FORM);
  const [statusMap, setStatusMap] =
    useState<Record<keyof BillReviewFormState, FieldExtractionStatus>>(
      DEFAULT_STATUS_MAP
    );
  const [sourceKind, setSourceKind] = useState<"manual" | "extracted">(
    "manual"
  );
  const [extractionNotes, setExtractionNotes] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [extractionMethod, setExtractionMethod] = useState<
    "pdf-text" | "pdf-ocr" | "image-ocr" | null
  >(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [saveToTracker, setSaveToTracker] = useState(true);

  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgressUpdate | null>(
    null
  );
  const [extractError, setExtractError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [report, setReport] = useState<BillInvestigationReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync deterministic investigation report locally (zero paid/external API calls)
  useEffect(() => {
    if (!activeBill) {
      setReport(null);
      return;
    }

    const localReport = generateLocalBillInvestigation(
      activeBill,
      previousBillForContext
    );
    setReport(localReport);
  }, [activeBill, previousBillForContext]);

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setExtractError(null);
    setValidationError(null);
    setOcrProgress(null);

    try {
      const parsedFile = await readBillFile(file);
      setUploadedFile(parsedFile);
      setWorkflowStage("idle");
    } catch (err) {
      setExtractError(
        err instanceof Error ? err.message : "Could not load the selected file."
      );
    }
  };

  const handleExtractBillInformation = async () => {
    if (!uploadedFile) return;
    setExtracting(true);
    setOcrProgress({ stage: "Starting local extraction...", progress: 4 });
    setExtractError(null);
    setValidationError(null);

    try {
      const extracted = await extractBillLocally(uploadedFile, (update) => {
        setOcrProgress(update);
      });
      const mapped = mapExtractedToFormAndStatus(extracted);

      setForm(mapped.form);
      setStatusMap(mapped.statusMap);
      setSourceKind("extracted");
      setRawOcrText(extracted.rawOcrText ?? null);
      setOcrConfidence(extracted.ocrConfidence ?? null);
      setExtractionMethod(extracted.extractionMethod ?? null);
      setValidationWarnings(extracted.validationWarnings ?? []);
      setExtractionNotes(
        extracted.extractionNotes ??
          `Detected ${mapped.extractedCount} of ${mapped.totalTrackedFields} fields locally. Review and enter any missing details before confirming.`
      );
      setEntryMode("upload");
      setWorkflowStage("review");
    } catch (err) {
      setExtractError(
        err instanceof Error
          ? err.message
          : "Local OCR extraction failed. Your uploaded bill is still attached below so you can retry or enter details manually."
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleFieldChange = (
    field: keyof BillReviewFormState,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatusMap((prev) => ({
      ...prev,
      [field]: value.trim() === "" ? "missing" : "edited",
    }));
  };

  const handleConfirmAndAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const provider = form.provider;
    const billingMonth = form.billingMonth.trim();
    const units = Number(form.unitsConsumed);
    const total = Number(form.totalBillAmount);

    if (!provider) {
      setValidationError("Please select the electricity provider (e.g. LESCO, K-Electric, IESCO).");
      return;
    }
    if (!billingMonth) {
      setValidationError("Please enter the billing month (e.g. October 2026).");
      return;
    }
    if (!Number.isFinite(units) || units < 0) {
      setValidationError("Units consumed must be a valid non-negative number.");
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setValidationError("Total bill amount must be greater than 0 PKR.");
      return;
    }

    const breakdown: BillBreakdown = {
      electricityCharges: toNullableNumber(form.electricityCharges),
      fuelPriceAdjustment: null,
      taxes: toNullableNumber(form.taxesAndAdditionalCharges, true),
      duties: null,
      fixedCharges: null,
      otherAdjustments: null,
    };

    const parsedRate = toNullableNumber(form.perUnitRate);

    const newBill: BillRecord = {
      id: `bill-${Date.now()}`,
      provider: provider as ProviderName,
      consumerNumber: null,
      meterNumber: null,
      billingMonth,
      issueDate: null,
      dueDate: form.dueDate.trim() || null,
      unitsConsumed: Math.round(units),
      totalBillAmount: Math.round(total),
      amountAfterDueDate: toNullableNumber(form.amountAfterDueDate),
      perUnitRate: parsedRate !== null ? Math.round(parsedRate * 100) / 100 : null,
      connectedLoad: form.connectedLoad.trim() || null,
      previousBillAmount: null,
      previousUnitsConsumed: null,
      previousMeterReading: toNullableNumber(form.previousMeterReading),
      currentMeterReading: toNullableNumber(form.currentMeterReading),
      meterPhase: null,
      source: sourceKind,
      breakdown,
      createdAt: new Date().toISOString(),
      extractionNotes,
      fieldStatus: statusMap,
    };

    onApplyAnalyzedBill(newBill, saveToTracker);
    setWorkflowStage("analyzed");
  };

  const openBillInEditor = (bill: BillRecord) => {
    const combinedTaxes = getCombinedTaxesAndAdditionalCharges(bill.breakdown);
    setForm({
      provider: bill.provider,
      billingMonth: bill.billingMonth,
      dueDate: bill.dueDate ?? "",
      unitsConsumed: String(bill.unitsConsumed),
      previousMeterReading:
        bill.previousMeterReading !== null
          ? String(bill.previousMeterReading)
          : "",
      currentMeterReading:
        bill.currentMeterReading !== null
          ? String(bill.currentMeterReading)
          : "",
      perUnitRate: bill.perUnitRate !== null ? String(bill.perUnitRate) : "",
      connectedLoad: bill.connectedLoad ?? "",
      electricityCharges:
        bill.breakdown.electricityCharges !== null
          ? String(bill.breakdown.electricityCharges)
          : "",
      taxesAndAdditionalCharges:
        combinedTaxes !== null ? String(combinedTaxes) : "",
      totalBillAmount: String(bill.totalBillAmount),
      amountAfterDueDate:
        bill.amountAfterDueDate !== null ? String(bill.amountAfterDueDate) : "",
    });
    setStatusMap({
      provider: "extracted",
      billingMonth: bill.billingMonth ? "extracted" : "missing",
      dueDate: bill.dueDate ? "extracted" : "missing",
      unitsConsumed: "extracted",
      previousMeterReading:
        bill.previousMeterReading !== null ? "extracted" : "missing",
      currentMeterReading:
        bill.currentMeterReading !== null ? "extracted" : "missing",
      perUnitRate: bill.perUnitRate !== null ? "extracted" : "missing",
      connectedLoad: bill.connectedLoad ? "extracted" : "missing",
      electricityCharges:
        bill.breakdown.electricityCharges !== null ? "extracted" : "missing",
      taxesAndAdditionalCharges:
        combinedTaxes !== null ? "extracted" : "missing",
      totalBillAmount: "extracted",
      amountAfterDueDate:
        bill.amountAfterDueDate !== null ? "extracted" : "missing",
    });
    setSourceKind(bill.source === "extracted" ? "extracted" : "manual");
    setWorkflowStage("review");
  };

  // Investigation computed deltas
  const prevAmount =
    previousBillForContext?.totalBillAmount ??
    activeBill?.previousBillAmount ??
    null;
  const prevUnits =
    previousBillForContext?.unitsConsumed ??
    activeBill?.previousUnitsConsumed ??
    null;

  const avgCostCurr = activeBill
    ? calculateAverageCostPerUnit(
        activeBill.totalBillAmount,
        activeBill.unitsConsumed
      )
    : null;
  const avgCostPrev =
    prevAmount !== null && prevUnits !== null && prevUnits > 0
      ? prevAmount / prevUnits
      : null;

  const billDelta =
    activeBill && prevAmount !== null
      ? activeBill.totalBillAmount - prevAmount
      : null;
  const billDeltaPct = activeBill
    ? calculatePercentageChange(activeBill.totalBillAmount, prevAmount)
    : null;

  const unitsDelta =
    activeBill && prevUnits !== null
      ? activeBill.unitsConsumed - prevUnits
      : null;
  const unitsDeltaPct = activeBill
    ? calculatePercentageChange(activeBill.unitsConsumed, prevUnits)
    : null;

  const taxesAndOtherTotal = activeBill
    ? getCombinedTaxesAndAdditionalCharges(activeBill.breakdown)
    : null;

  return (
    <div className="space-y-8">
      {/* Page Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Analyze My Bill
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload your electricity bill image or PDF, verify the extracted values, and confirm to view your bill summary.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0F1623] border border-slate-800 shrink-0 self-start">
          <button
            type="button"
            onClick={() => {
              setEntryMode("upload");
              setExtractError(null);
            }}
            className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              entryMode === "upload"
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Upload Bill (Image / PDF)
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode("manual");
              setSourceKind("manual");
              setForm({ ...EMPTY_BILL_FORM });
              setStatusMap({ ...DEFAULT_STATUS_MAP });
              setExtractionNotes(null);
              setRawOcrText(null);
              setValidationWarnings([]);
              setWorkflowStage("review");
              setExtractError(null);
            }}
            className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              entryMode === "manual"
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Manual Entry
          </button>
        </div>
      </div>

      {/* Step Progress Indicator */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pb-2 border-b border-slate-800/70">
        <span
          className={
            workflowStage === "idle"
              ? "text-cyan-300 font-semibold"
              : "text-slate-300"
          }
        >
          1. Select Bill
        </span>
        <span aria-hidden="true">→</span>
        <span
          className={
            workflowStage === "review"
              ? "text-cyan-300 font-semibold"
              : "text-slate-300"
          }
        >
          2. Review &amp; Confirm Details
        </span>
        <span aria-hidden="true">→</span>
        <span
          className={
            workflowStage === "analyzed"
              ? "text-lime-300 font-semibold"
              : "text-slate-300"
          }
        >
          3. Bill Summary &amp; Investigation
        </span>
      </div>

      {/* Upload Area */}
      {entryMode === "upload" && (
        <section className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files?.[0]);
            }}
            className="rounded-lg border border-dashed border-slate-700 hover:border-cyan-400/60 bg-[#0B111C] p-6 sm:p-8 text-center transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                handleFileSelect(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
              <Upload className="h-5 w-5" />
            </div>
            <h2 className="mt-3 font-display text-base font-semibold text-white">
              {uploadedFile
                ? "Replace uploaded electricity bill"
                : "Upload your electricity bill image or PDF"}
            </h2>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              Supports K-Electric, LESCO, IESCO, FESCO, MEPCO, HESCO, GEPCO, QESCO and other DISCO bills (PNG, JPG, WEBP, PDF up to 12 MB).
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                {uploadedFile ? "Choose Another File" : "Choose Bill File"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode("manual");
                  setSourceKind("manual");
                  setForm({ ...EMPTY_BILL_FORM });
                  setStatusMap({ ...DEFAULT_STATUS_MAP });
                  setWorkflowStage("review");
                }}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                Enter Manually Instead
              </button>
            </div>
          </div>

          {/* Visible Uploaded File Preview & Extract Action */}
          {uploadedFile && (
            <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {uploadedFile.isPdf ? (
                    <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-800 text-cyan-300 shrink-0">
                      <FileText className="h-6 w-6" />
                    </div>
                  ) : (
                    <img
                      src={uploadedFile.dataUrl}
                      alt={`Preview of ${uploadedFile.name}`}
                      className="h-14 w-14 rounded-md object-cover border border-slate-700 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {uploadedFile.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {uploadedFile.mimeType} ·{" "}
                      {(uploadedFile.sizeBytes / 1024).toFixed(0)} KB · Attached
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExtractBillInformation}
                    disabled={extracting}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-lime-400 hover:bg-lime-300 disabled:opacity-70 transition-colors whitespace-nowrap shrink-0"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reading your electricity bill...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Extract Bill Information
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Local OCR Progress Bar */}
              {extracting && ocrProgress && (
                <div className="rounded-lg bg-[#090E17] border border-cyan-500/30 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyan-200 font-medium">
                      {ocrProgress.stage}
                    </span>
                    <span className="font-mono text-cyan-300 tabular-nums">
                      {ocrProgress.progress}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-lime-400 transition-all duration-200"
                      style={{ width: `${Math.max(4, ocrProgress.progress)}%` }}
                    />
                  </div>
                </div>
              )}

              {workflowStage !== "review" && !uploadedFile.isPdf && (
                <div className="overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950 p-2">
                  <img
                    src={uploadedFile.dataUrl}
                    alt={`Uploaded bill preview: ${uploadedFile.name}`}
                    className="max-h-64 mx-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>
          )}

          {extractError && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 space-y-3 text-xs text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-200">
                    Automatic extraction failed
                  </p>
                  <p className="mt-1 text-amber-100/85 leading-relaxed">
                    {extractError}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-7">
                {uploadedFile && (
                  <button
                    type="button"
                    onClick={handleExtractBillInformation}
                    disabled={extracting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-slate-950 bg-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry Extraction
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSourceKind("manual");
                    setForm({ ...EMPTY_BILL_FORM });
                    setStatusMap({ ...DEFAULT_STATUS_MAP });
                    setWorkflowStage("review");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  Fill Details Manually
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Structured Side-by-Side Extraction Review / Manual Entry Panel */}
      {workflowStage === "review" && (
        <BillReviewPanel
          uploadedFile={entryMode === "upload" ? uploadedFile : null}
          form={form}
          statusMap={statusMap}
          isExtractionMode={sourceKind === "extracted"}
          extractionNotes={extractionNotes}
          rawOcrText={rawOcrText}
          ocrConfidence={ocrConfidence}
          extractionMethod={extractionMethod}
          validationWarnings={validationWarnings}
          validationError={validationError}
          confirmButtonLabel="Confirm Details"
          showSaveToTracker={true}
          saveToTracker={saveToTracker}
          onToggleSaveToTracker={setSaveToTracker}
          onChangeField={handleFieldChange}
          onSubmit={handleConfirmAndAnalyze}
        />
      )}

      {/* Confirmed Results: Clean BILL SUMMARY + Investigation */}
      {workflowStage !== "review" && activeBill && report ? (
        <section className="space-y-8">
          {/* BILL SUMMARY Header & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-medium text-cyan-300">
                  {activeBill.provider} · {activeBill.billingMonth}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {isDemoMode
                    ? "DEMO DATA — NOT AN ACTUAL BILL"
                    : activeBill.source === "extracted"
                    ? "Confirmed from uploaded bill"
                    : "Confirmed manual entry"}
                </span>
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
                BILL SUMMARY
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => openBillInEditor(activeBill)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Confirmed Details
              </button>
              <button
                type="button"
                onClick={onNavigateDifference}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-colors whitespace-nowrap shrink-0"
              >
                <GitCompare className="h-3.5 w-3.5" />
                Compare 2 Bills
              </button>
              <button
                type="button"
                onClick={onNavigateBreakdown}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                Visual Breakdown →
              </button>
            </div>
          </div>

          {/* Primary Prominent Summary Grid */}
          <div className="rounded-xl bg-gradient-to-br from-[#101929] to-[#0B121E] border border-slate-800/90 p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Units Consumed
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-cyan-300 tabular-nums">
                  {formatNumber(activeBill.unitsConsumed)} kWh
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Total Bill
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-white tabular-nums">
                  {formatPkr(activeBill.totalBillAmount)}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Due Date
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-white">
                  {activeBill.dueDate ?? (
                    <span className="text-base font-sans text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Amount After Due Date
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-amber-300 tabular-nums">
                  {activeBill.amountAfterDueDate !== null ? (
                    formatPkr(activeBill.amountAfterDueDate)
                  ) : (
                    <span className="text-base font-sans text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Per Unit Rate (Printed)
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-lime-300 tabular-nums">
                  {activeBill.perUnitRate !== null ? (
                    `PKR ${activeBill.perUnitRate.toFixed(2)}`
                  ) : (
                    <span className="text-base font-sans text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17] border border-slate-800 p-5">
                <div className="text-xs font-medium text-slate-400">
                  Load / Watts (Printed)
                </div>
                <div className="mt-2 font-mono text-2xl font-semibold text-white">
                  {activeBill.connectedLoad ?? (
                    <span className="text-base font-sans text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Secondary Confirmed Details Below */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">
                  Previous Meter Reading
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  {activeBill.previousMeterReading !== null ? (
                    formatNumber(activeBill.previousMeterReading)
                  ) : (
                    <span className="text-sm font-sans font-normal text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">
                  Current Meter Reading
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  {activeBill.currentMeterReading !== null ? (
                    formatNumber(activeBill.currentMeterReading)
                  ) : (
                    <span className="text-sm font-sans font-normal text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">
                  Electricity Charges
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  {activeBill.breakdown.electricityCharges !== null ? (
                    formatPkr(activeBill.breakdown.electricityCharges)
                  ) : (
                    <span className="text-sm font-sans font-normal text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">
                  Taxes and Other Charges
                </div>
                <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  {taxesAndOtherTotal !== null ? (
                    formatPkr(taxesAndOtherTotal)
                  ) : (
                    <span className="text-sm font-sans font-normal text-slate-400">
                      Not detected
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">Billing Month</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {activeBill.billingMonth}
                </div>
              </div>

              <div className="rounded-lg bg-[#090E17]/70 border border-slate-800/80 px-4 py-3.5">
                <div className="text-xs text-slate-400">
                  Electricity Provider
                </div>
                <div className="mt-1 text-lg font-semibold text-cyan-300">
                  {activeBill.provider}
                </div>
              </div>
            </div>
          </div>

          {/* Section A: The Verdict */}
          <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-cyan-300">
                  Bill Investigation
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold text-white">
                  {report.verdictHeadline}
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Local deterministic analysis
              </span>
            </div>

            <p className="text-sm leading-relaxed text-slate-200">
              {report.summary}
            </p>

            {(unitsDelta !== null || billDelta !== null) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-lg bg-[#090E17] border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">
                    Change in Consumption
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-xl font-semibold tabular-nums">
                    {unitsDelta !== null ? (
                      <>
                        {unitsDelta <= 0 ? (
                          <ArrowDownRight className="h-4 w-4 text-lime-400" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-rose-400" />
                        )}
                        <span
                          className={
                            unitsDelta <= 0 ? "text-lime-300" : "text-rose-300"
                          }
                        >
                          {unitsDelta > 0 ? "+" : ""}
                          {unitsDelta} kWh
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">
                        No prior units
                      </span>
                    )}
                  </div>
                  {unitsDeltaPct !== null && (
                    <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                      {unitsDeltaPct > 0 ? "+" : ""}
                      {unitsDeltaPct.toFixed(1)}% vs prior month
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-[#090E17] border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">
                    Change in Payable Amount
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-xl font-semibold tabular-nums">
                    {billDelta !== null ? (
                      <>
                        {billDelta <= 0 ? (
                          <ArrowDownRight className="h-4 w-4 text-lime-400" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-rose-400" />
                        )}
                        <span
                          className={
                            billDelta <= 0 ? "text-lime-300" : "text-rose-300"
                          }
                        >
                          {billDelta > 0 ? "+" : "-"}
                          {formatPkr(Math.abs(billDelta))}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-500">
                        No prior bill
                      </span>
                    )}
                  </div>
                  {billDeltaPct !== null && (
                    <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                      {billDeltaPct > 0 ? "+" : ""}
                      {billDeltaPct.toFixed(1)}% vs prior month
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-400">
              {report.driverAnalysis}{" "}
              {avgCostCurr !== null && (
                <>
                  Calculated average blended cost:{" "}
                  <span className="font-mono text-slate-200">
                    PKR {avgCostCurr.toFixed(2)}/kWh
                  </span>
                  {avgCostPrev !== null && (
                    <>
                      {" "}
                      (prior:{" "}
                      <span className="font-mono text-slate-300">
                        PKR {avgCostPrev.toFixed(2)}/kWh
                      </span>
                      )
                    </>
                  )}
                  .
                </>
              )}
            </p>
          </div>

          {/* Verification Checklist + Confusing Terms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-amber-300" />
                <div>
                  <div className="text-xs font-semibold text-amber-300">
                    Bill Verification Checklist
                  </div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Checks Relevant to This Bill
                  </h3>
                </div>
              </div>

              <ul className="space-y-3 text-xs leading-relaxed text-slate-300 list-disc pl-4">
                {report.itemsToVerify.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-cyan-300" />
                <div>
                  <div className="text-xs font-semibold text-cyan-300">
                    Explain the Terms
                  </div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Key Terms on Your Bill
                  </h3>
                </div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {report.termExplanations.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">
                        {item.term}
                      </span>
                      {item.amountNote && (
                        <span className="font-mono text-xs text-cyan-300 tabular-nums shrink-0">
                          {item.amountNote}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {item.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        workflowStage === "idle" && (
          <div className="rounded-xl bg-[#0F1623] border border-dashed border-slate-800 p-8 text-center">
            <p className="text-sm font-medium text-slate-300">
              Select a bill image or PDF above to begin extraction
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Your uploaded file will stay visible while we extract fields locally for you to review and confirm.
            </p>
          </div>
        )
      )}
    </div>
  );
};
