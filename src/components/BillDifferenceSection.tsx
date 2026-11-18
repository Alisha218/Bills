import React, { useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Upload,
  FileText,
  Sparkles,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import {
  BillBreakdown,
  BillRecord,
  FieldExtractionStatus,
  ProviderName,
} from "../types/bill";
import { DEMO_BILL, DEMO_PREVIOUS_BILL } from "../data/demoData";
import {
  computeDeterministicBillDiff,
  formatNumber,
  formatPkr,
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

interface BillDifferenceSectionProps {
  previousBill: BillRecord | null;
  currentBill: BillRecord | null;
  isDemoMode: boolean;
  onSetPreviousBill: (bill: BillRecord | null) => void;
  onSetCurrentBill: (bill: BillRecord | null) => void;
}

interface SlotEditorState {
  file: UploadedBillFile | null;
  extracting: boolean;
  ocrProgress: OcrProgressUpdate | null;
  error: string | null;
  mode: "idle" | "review";
  sourceKind: "manual" | "extracted";
  form: BillReviewFormState;
  statusMap: Record<keyof BillReviewFormState, FieldExtractionStatus>;
  notes: string | null;
  rawOcrText: string | null;
  ocrConfidence: number | null;
  extractionMethod: "pdf-text" | "pdf-ocr" | "image-ocr" | null;
  validationWarnings: string[];
  validationError: string | null;
}

const DEFAULT_STATUS_MAP: Record<
  keyof BillReviewFormState,
  FieldExtractionStatus
> = Object.keys(EMPTY_BILL_FORM).reduce((acc, k) => {
  acc[k as keyof BillReviewFormState] = "missing";
  return acc;
}, {} as Record<keyof BillReviewFormState, FieldExtractionStatus>);

function createInitialSlot(): SlotEditorState {
  return {
    file: null,
    extracting: false,
    ocrProgress: null,
    error: null,
    mode: "idle",
    sourceKind: "manual",
    form: { ...EMPTY_BILL_FORM },
    statusMap: { ...DEFAULT_STATUS_MAP },
    notes: null,
    rawOcrText: null,
    ocrConfidence: null,
    extractionMethod: null,
    validationWarnings: [],
    validationError: null,
  };
}

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

function billToForm(bill: BillRecord): BillReviewFormState {
  const combinedTaxes = getCombinedTaxesAndAdditionalCharges(bill.breakdown);
  return {
    provider: bill.provider,
    billingMonth: bill.billingMonth,
    dueDate: bill.dueDate ?? "",
    unitsConsumed: String(bill.unitsConsumed),
    previousMeterReading:
      bill.previousMeterReading !== null ? String(bill.previousMeterReading) : "",
    currentMeterReading:
      bill.currentMeterReading !== null ? String(bill.currentMeterReading) : "",
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
  };
}

function buildStatusMapFromForm(
  form: BillReviewFormState
): Record<keyof BillReviewFormState, FieldExtractionStatus> {
  const keys = Object.keys(form) as Array<keyof BillReviewFormState>;
  return keys.reduce((acc, k) => {
    acc[k] = form[k].trim() !== "" ? "extracted" : "missing";
    return acc;
  }, {} as Record<keyof BillReviewFormState, FieldExtractionStatus>);
}

export const BillDifferenceSection: React.FC<BillDifferenceSectionProps> = ({
  previousBill,
  currentBill,
  isDemoMode,
  onSetPreviousBill,
  onSetCurrentBill,
}) => {
  const [prevSlot, setPrevSlot] = useState<SlotEditorState>(createInitialSlot);
  const [currSlot, setCurrSlot] = useState<SlotEditorState>(createInitialSlot);
  const [editingTarget, setEditingTarget] = useState<"prev" | "curr" | null>(null);

  const [aiExplanation, setAiExplanation] = useState<{
    becauseSummary: string;
    verificationFlags: string[];
  } | null>(null);
  const [loadingAiDiff, setLoadingAiDiff] = useState(false);

  const prevFileRef = useRef<HTMLInputElement | null>(null);
  const currFileRef = useRef<HTMLInputElement | null>(null);

  const updateSlot = (
    target: "prev" | "curr",
    updater: (s: SlotEditorState) => SlotEditorState
  ) => {
    if (target === "prev") setPrevSlot(updater);
    else setCurrSlot(updater);
  };

  const handleSelectFile = async (target: "prev" | "curr", file: File | undefined) => {
    if (!file) return;
    updateSlot(target, (s) => ({ ...s, error: null, validationError: null }));
    try {
      const parsed = await readBillFile(file);
      updateSlot(target, (s) => ({
        ...s,
        file: parsed,
        error: null,
        mode: "idle",
      }));
    } catch (err) {
      updateSlot(target, (s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to read file.",
      }));
    }
  };

  const handleExtractSlot = async (target: "prev" | "curr") => {
    const slot = target === "prev" ? prevSlot : currSlot;
    if (!slot.file) return;

    updateSlot(target, (s) => ({
      ...s,
      extracting: true,
      ocrProgress: { stage: "Starting local extraction...", progress: 4 },
      error: null,
    }));
    try {
      const extracted = await extractBillLocally(slot.file, (update) => {
        updateSlot(target, (s) => ({ ...s, ocrProgress: update }));
      });
      const mapped = mapExtractedToFormAndStatus(extracted);
      updateSlot(target, (s) => ({
        ...s,
        extracting: false,
        mode: "review",
        sourceKind: "extracted",
        form: mapped.form,
        statusMap: mapped.statusMap,
        rawOcrText: extracted.rawOcrText ?? null,
        ocrConfidence: extracted.ocrConfidence ?? null,
        extractionMethod: extracted.extractionMethod ?? null,
        validationWarnings: extracted.validationWarnings ?? [],
        notes:
          extracted.extractionNotes ??
          `Extracted ${mapped.extractedCount} of ${mapped.totalTrackedFields} fields locally. Review and confirm below.`,
      }));
      setEditingTarget(target);
    } catch (err) {
      updateSlot(target, (s) => ({
        ...s,
        extracting: false,
        error:
          err instanceof Error
            ? err.message
            : "Local OCR extraction failed. File remains attached for retry or manual entry.",
      }));
    }
  };

  const handleConfirmSlot = (target: "prev" | "curr", e: React.FormEvent) => {
    e.preventDefault();
    const slot = target === "prev" ? prevSlot : currSlot;
    const provider = slot.form.provider;
    const month = slot.form.billingMonth.trim();
    const units = Number(slot.form.unitsConsumed);
    const total = Number(slot.form.totalBillAmount);

    if (
      !provider ||
      !month ||
      !Number.isFinite(units) ||
      units < 0 ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      updateSlot(target, (s) => ({
        ...s,
        validationError:
          "Please confirm Electricity Provider, Billing Month, Units Consumed (≥ 0), and Total Bill Amount (> 0 PKR).",
      }));
      return;
    }

    const parsedRate = toNullableNumber(slot.form.perUnitRate);

    const record: BillRecord = {
      id: `diff-${target}-${Date.now()}`,
      provider: provider as ProviderName,
      consumerNumber: null,
      meterNumber: null,
      billingMonth: month,
      issueDate: null,
      dueDate: slot.form.dueDate.trim() || null,
      unitsConsumed: Math.round(units),
      totalBillAmount: Math.round(total),
      amountAfterDueDate: toNullableNumber(slot.form.amountAfterDueDate),
      perUnitRate: parsedRate !== null ? Math.round(parsedRate * 100) / 100 : null,
      connectedLoad: slot.form.connectedLoad.trim() || null,
      previousBillAmount: null,
      previousUnitsConsumed: null,
      previousMeterReading: toNullableNumber(slot.form.previousMeterReading),
      currentMeterReading: toNullableNumber(slot.form.currentMeterReading),
      meterPhase: null,
      source: slot.sourceKind,
      breakdown: {
        electricityCharges: toNullableNumber(slot.form.electricityCharges),
        fuelPriceAdjustment: null,
        taxes: toNullableNumber(slot.form.taxesAndAdditionalCharges, true),
        duties: null,
        fixedCharges: null,
        otherAdjustments: null,
      },
      createdAt: new Date().toISOString(),
      extractionNotes: slot.notes,
      fieldStatus: slot.statusMap,
    };

    if (target === "prev") {
      onSetPreviousBill(record);
    } else {
      onSetCurrentBill(record);
    }
    updateSlot(target, (s) => ({ ...s, mode: "idle", validationError: null }));
    setEditingTarget(null);
    setAiExplanation(null);
  };

  const deterministicDiff = useMemo(() => {
    if (!previousBill || !currentBill) return null;
    return computeDeterministicBillDiff(previousBill, currentBill);
  }, [previousBill, currentBill]);

  const handleGenerateAiComparison = async () => {
    if (!previousBill || !currentBill || !deterministicDiff) return;
    setLoadingAiDiff(true);
    try {
      const res = await fetch("/api/compare-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previousBill,
          currentBill,
          deterministicDiff,
        }),
      });
      if (!res.ok) throw new Error("AI unavailable");
      const data = await res.json();
      if (data?.comparison?.becauseSummary) {
        setAiExplanation({
          becauseSummary: data.comparison.becauseSummary,
          verificationFlags: Array.isArray(data.comparison.verificationFlags)
            ? data.comparison.verificationFlags
            : deterministicDiff.verificationFlags,
        });
      }
    } catch {
      setAiExplanation({
        becauseSummary: deterministicDiff.becauseSummary,
        verificationFlags: deterministicDiff.verificationFlags,
      });
    } finally {
      setLoadingAiDiff(false);
    }
  };

  const chartData = useMemo(() => {
    if (!previousBill || !currentBill || !deterministicDiff) return [];
    const rows = [
      {
        name: "Total Bill",
        [previousBill.billingMonth]: previousBill.totalBillAmount,
        [currentBill.billingMonth]: currentBill.totalBillAmount,
      },
    ];
    for (const cat of deterministicDiff.categories) {
      if (cat.prev !== null || cat.curr !== null) {
        rows.push({
          name: cat.label.replace("Fuel Price Adjustment (FPA)", "FPA").replace("Other Adjustments / QTA", "QTA / Other"),
          [previousBill.billingMonth]: cat.prev ?? 0,
          [currentBill.billingMonth]: cat.curr ?? 0,
        });
      }
    }
    return rows;
  }, [previousBill, currentBill, deterministicDiff]);

  const renderSlotCard = (
    target: "prev" | "curr",
    title: string,
    bill: BillRecord | null,
    slot: SlotEditorState,
    fileInputRef: React.RefObject<HTMLInputElement | null>
  ) => (
    <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
        <div>
          <span className="text-xs font-semibold text-cyan-300">{title}</span>
          <h2 className="font-display text-base font-semibold text-white">
            {bill
              ? `${bill.billingMonth} · ${bill.provider}`
              : "Attach or Enter Bill"}
          </h2>
        </div>
        {bill && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-lime-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready
          </span>
        )}
      </div>

      {bill && (
        <div className="rounded-lg bg-[#090E17] border border-slate-800 p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-lg font-semibold text-white tabular-nums">
              {formatPkr(bill.totalBillAmount)}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {formatNumber(bill.unitsConsumed)} kWh ·{" "}
              {bill.unitsConsumed > 0
                ? `PKR ${(bill.totalBillAmount / bill.unitsConsumed).toFixed(2)}/unit`
                : "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextForm = billToForm(bill);
              updateSlot(target, (s) => ({
                ...s,
                mode: "review",
                form: nextForm,
                statusMap: buildStatusMapFromForm(nextForm),
                validationError: null,
                sourceKind: bill.source === "extracted" ? "extracted" : "manual",
              }));
              setEditingTarget(target);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleSelectFile(target, e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {slot.file && (
        <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {slot.file.isPdf ? (
              <FileText className="h-5 w-5 text-cyan-300 shrink-0" />
            ) : (
              <img
                src={slot.file.dataUrl}
                alt={slot.file.name}
                className="h-10 w-10 rounded object-cover border border-slate-700 shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {slot.file.name}
              </div>
              <div className="text-[11px] text-slate-400">
                {(slot.file.sizeBytes / 1024).toFixed(0)} KB
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleExtractSlot(target)}
            disabled={slot.extracting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-950 bg-lime-400 hover:bg-lime-300 disabled:opacity-70 whitespace-nowrap shrink-0"
          >
            {slot.extracting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Extract Bill Info
              </>
            )}
          </button>
        </div>
      )}

      {slot.extracting && slot.ocrProgress && (
        <div className="rounded-lg bg-[#090E17] border border-cyan-500/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-cyan-200 font-medium truncate">
              {slot.ocrProgress.stage}
            </span>
            <span className="font-mono text-cyan-300 tabular-nums shrink-0 ml-2">
              {slot.ocrProgress.progress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-lime-400 transition-all duration-200"
              style={{ width: `${Math.max(4, slot.ocrProgress.progress)}%` }}
            />
          </div>
        </div>
      )}

      {slot.error && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{slot.error}</span>
          </div>
          <div className="flex flex-wrap gap-2 pl-6">
            {slot.file && (
              <button
                type="button"
                onClick={() => handleExtractSlot(target)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-300 text-slate-950 font-semibold"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                updateSlot(target, (s) => ({ ...s, mode: "review", sourceKind: "manual" }));
                setEditingTarget(target);
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white border border-slate-700"
            >
              Fill Manually
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap"
        >
          <Upload className="h-3.5 w-3.5" />
          {slot.file ? "Replace File" : "Upload Bill Image / PDF"}
        </button>
        <button
          type="button"
          onClick={() => {
            const nextForm = bill ? billToForm(bill) : { ...EMPTY_BILL_FORM };
            updateSlot(target, (s) => ({
              ...s,
              mode: "review",
              sourceKind: "manual",
              form: nextForm,
              statusMap: bill ? buildStatusMapFromForm(nextForm) : { ...DEFAULT_STATUS_MAP },
              validationError: null,
            }));
            setEditingTarget(target);
          }}
          className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap"
        >
          Enter Manually
        </button>
      </div>
    </div>
  );

  const activeEditSlot = editingTarget === "prev" ? prevSlot : editingTarget === "curr" ? currSlot : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="text-cyan-300 font-medium">Signature Investigation Tool</span>
            {isDemoMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300 font-medium">
                  DEMO DATA — NOT ACTUAL BILLS
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Bill Difference Detector
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload or enter your Previous Month and Current Month electricity bills to see exactly what increased, what decreased, and why your bill changed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onSetPreviousBill(DEMO_PREVIOUS_BILL);
            onSetCurrentBill(DEMO_BILL);
            setAiExplanation(null);
            setEditingTarget(null);
          }}
          className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          Load Sample 2-Bill Pair
        </button>
      </div>

      {/* Two Bill Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSlotCard("prev", "Bill 1 · Previous Month", previousBill, prevSlot, prevFileRef)}
        {renderSlotCard("curr", "Bill 2 · Current Month", currentBill, currSlot, currFileRef)}
      </div>

      {/* Inline Review / Manual Editor for whichever slot is open */}
      {editingTarget && activeEditSlot && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300">
              Editing {editingTarget === "prev" ? "Previous Month Bill" : "Current Month Bill"}
            </span>
            <button
              type="button"
              onClick={() => setEditingTarget(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close Editor
            </button>
          </div>
          <BillReviewPanel
            uploadedFile={activeEditSlot.file}
            form={activeEditSlot.form}
            statusMap={activeEditSlot.statusMap}
            isExtractionMode={activeEditSlot.sourceKind === "extracted"}
            extractionNotes={activeEditSlot.notes}
            rawOcrText={activeEditSlot.rawOcrText}
            ocrConfidence={activeEditSlot.ocrConfidence}
            extractionMethod={activeEditSlot.extractionMethod}
            validationWarnings={activeEditSlot.validationWarnings}
            validationError={activeEditSlot.validationError}
            confirmButtonLabel={
              editingTarget === "prev"
                ? "Save Previous Month Bill"
                : "Save Current Month Bill"
            }
            onChangeField={(field, val) =>
              updateSlot(editingTarget, (s) => ({
                ...s,
                form: { ...s.form, [field]: val },
                statusMap: {
                  ...s.statusMap,
                  [field]: val.trim() === "" ? "missing" : "edited",
                },
              }))
            }
            onSubmit={(e) => handleConfirmSlot(editingTarget, e)}
          />
        </div>
      )}

      {/* Comparison Results */}
      {previousBill && currentBill && deterministicDiff ? (
        <div className="space-y-6">
          {/* "Your bill changed because..." Highlight Panel */}
          <section className="rounded-xl bg-gradient-to-br from-[#101929] to-[#0B121E] border border-cyan-500/30 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-white">
                Your bill changed because...
              </h2>
              <button
                type="button"
                onClick={handleGenerateAiComparison}
                disabled={loadingAiDiff}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                {loadingAiDiff ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Refine with AI Explanation
                  </>
                )}
              </button>
            </div>

            <p className="text-sm leading-relaxed text-slate-200">
              {aiExplanation?.becauseSummary ?? deterministicDiff.becauseSummary}
            </p>
          </section>

          {/* 6 Required Difference Questions Answered Clearly */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* 1. What increased? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-3">
              <div className="text-xs font-semibold text-rose-300">
                1. What Increased?
              </div>
              {deterministicDiff.increasedItems.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {deterministicDiff.increasedItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-rose-300 tabular-nums shrink-0">
                        {item.deltaText}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  No compared metrics increased between these two bills.
                </p>
              )}
            </div>

            {/* 2. What decreased? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-3">
              <div className="text-xs font-semibold text-lime-300">
                2. What Decreased?
              </div>
              {deterministicDiff.decreasedItems.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {deterministicDiff.decreasedItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-lime-300 tabular-nums shrink-0">
                        {item.deltaText}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  No compared metrics decreased between these two bills.
                </p>
              )}
            </div>

            {/* 3. Which charge changed the most? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-2">
              <div className="text-xs font-semibold text-cyan-300">
                3. Which Charge Changed the Most?
              </div>
              {deterministicDiff.largestChangedCategory &&
              deterministicDiff.largestChangedCategory.delta !== null ? (
                <>
                  <div className="text-base font-semibold text-white">
                    {deterministicDiff.largestChangedCategory.label}
                  </div>
                  <div className="font-mono text-lg font-semibold text-cyan-300 tabular-nums">
                    {deterministicDiff.largestChangedCategory.delta >= 0 ? "+" : "-"}
                    {formatPkr(
                      Math.abs(deterministicDiff.largestChangedCategory.delta)
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono tabular-nums">
                    {formatPkr(deterministicDiff.largestChangedCategory.prev)} →{" "}
                    {formatPkr(deterministicDiff.largestChangedCategory.curr)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  Insufficient itemized category data on both bills to rank individual charges.
                </p>
              )}
            </div>

            {/* 4. Did consumption increase? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                4. Did Consumption Increase?
              </div>
              <div className="flex items-center gap-2">
                {deterministicDiff.unitsDelta > 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-rose-400" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-lime-400" />
                )}
                <span className="font-display text-lg font-semibold text-white">
                  {deterministicDiff.unitsDelta > 0
                    ? "Yes — Consumption Increased"
                    : deterministicDiff.unitsDelta < 0
                    ? "No — Consumption Decreased"
                    : "Unchanged"}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-300 tabular-nums">
                {deterministicDiff.unitsPrev} kWh → {deterministicDiff.unitsCurr}{" "}
                kWh ({deterministicDiff.unitsDelta > 0 ? "+" : ""}
                {deterministicDiff.unitsDelta} kWh)
              </div>
            </div>

            {/* 5. Did average cost per unit increase? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                5. Did Avg Cost per Unit Increase?
              </div>
              {deterministicDiff.avgRateDelta !== null &&
              deterministicDiff.avgRatePrev !== null &&
              deterministicDiff.avgRateCurr !== null ? (
                <>
                  <div className="font-display text-lg font-semibold text-white">
                    {deterministicDiff.avgRateDelta > 0.25
                      ? "Yes — Unit Rate Rose"
                      : deterministicDiff.avgRateDelta < -0.25
                      ? "No — Unit Rate Dropped"
                      : "Roughly Flat"}
                  </div>
                  <div className="font-mono text-xs text-slate-300 tabular-nums">
                    PKR {deterministicDiff.avgRatePrev.toFixed(2)} → PKR{" "}
                    {deterministicDiff.avgRateCurr.toFixed(2)} / kWh (
                    {deterministicDiff.avgRateDelta >= 0 ? "+" : ""}
                    PKR {deterministicDiff.avgRateDelta.toFixed(2)})
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400">
                  Insufficient unit data to compare cost per unit.
                </p>
              )}
            </div>

            {/* 6. Which differences need verification? */}
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-2">
              <div className="text-xs font-semibold text-amber-300">
                6. Differences to Verify
              </div>
              {(aiExplanation?.verificationFlags ??
                deterministicDiff.verificationFlags).length > 0 ? (
                <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                  {(
                    aiExplanation?.verificationFlags ??
                    deterministicDiff.verificationFlags
                  ).map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Changes appear consistent with consumption differences; verify printed meter readings against your physical meter.
                </p>
              )}
            </div>
          </div>

          {/* Side-by-Side Comparison Table + Chart */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            <div className="xl:col-span-7 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6">
              <h3 className="font-display text-lg font-semibold text-white mb-4">
                Side-by-Side Bill Comparison
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                      <th className="py-2.5 pr-3">Metric / Category</th>
                      <th className="py-2.5 px-2 text-right">
                        {previousBill.billingMonth}
                      </th>
                      <th className="py-2.5 px-2 text-right">
                        {currentBill.billingMonth}
                      </th>
                      <th className="py-2.5 pl-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-sm">
                    <tr>
                      <td className="py-3 pr-3 font-medium text-white">
                        Units Consumed (kWh)
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-300 tabular-nums">
                        {formatNumber(previousBill.unitsConsumed)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-cyan-300 tabular-nums">
                        {formatNumber(currentBill.unitsConsumed)}
                      </td>
                      <td
                        className={`py-3 pl-2 text-right font-mono text-xs tabular-nums ${
                          deterministicDiff.unitsDelta <= 0
                            ? "text-lime-300"
                            : "text-rose-300"
                        }`}
                      >
                        {deterministicDiff.unitsDelta > 0 ? "+" : ""}
                        {deterministicDiff.unitsDelta} kWh
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 pr-3 font-medium text-white">
                        Total Payable (PKR)
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-300 tabular-nums">
                        {formatPkr(previousBill.totalBillAmount)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-white font-semibold tabular-nums">
                        {formatPkr(currentBill.totalBillAmount)}
                      </td>
                      <td
                        className={`py-3 pl-2 text-right font-mono text-xs font-semibold tabular-nums ${
                          deterministicDiff.totalDelta <= 0
                            ? "text-lime-300"
                            : "text-rose-300"
                        }`}
                      >
                        {deterministicDiff.totalDelta > 0 ? "+" : "-"}
                        {formatPkr(Math.abs(deterministicDiff.totalDelta))}
                      </td>
                    </tr>
                    {deterministicDiff.categories.map((cat) => (
                      <tr key={cat.key}>
                        <td className="py-2.5 pr-3 text-slate-300">
                          {cat.label}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-400 tabular-nums">
                          {cat.prev !== null ? formatPkr(cat.prev) : "Unavailable"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-200 tabular-nums">
                          {cat.curr !== null ? formatPkr(cat.curr) : "Unavailable"}
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono text-xs tabular-nums">
                          {cat.delta !== null ? (
                            <span
                              className={
                                cat.delta <= 0
                                  ? "text-lime-300"
                                  : "text-rose-300"
                              }
                            >
                              {cat.delta > 0 ? "+" : cat.delta < 0 ? "-" : ""}
                              {formatPkr(Math.abs(cat.delta))}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-5 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Visual Category Shift
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  PKR comparison across available charges
                </p>
              </div>
              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1E293B"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#64748B"
                      tick={{ fill: "#94A3B8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#64748B"
                      tick={{ fill: "#94A3B8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B111C",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#F8FAFC",
                      }}
                      formatter={(val: unknown) => formatPkr(Number(val))}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      dataKey={previousBill.billingMonth}
                      fill="#64748B"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey={currentBill.billingMonth}
                      fill="#22D3EE"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[#0F1623] border border-dashed border-slate-800 p-10 text-center">
          <p className="text-sm font-medium text-slate-200">
            Upload or enter both bills above to detect differences
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Once both Previous Month and Current Month bills are ready, Bill Check automatically isolates unit shifts, rate shifts, and category changes.
          </p>
        </div>
      )}
    </div>
  );
};
