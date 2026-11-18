import { ExtractedBillPayload, FieldExtractionStatus, ProviderName } from "../types/bill";
import { PROVIDERS } from "../data/demoData";

export interface UploadedBillFile {
  name: string;
  sizeBytes: number;
  mimeType: string;
  dataUrl: string;
  base64: string;
  isPdf: boolean;
}

const EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export function resolveSupportedMimeType(file: File): string | null {
  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ]);
  if (file.type && allowed.has(file.type.toLowerCase())) {
    return file.type.toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : file.type.toLowerCase();
  }
  const lowerName = file.name.toLowerCase();
  for (const [ext, mime] of Object.entries(EXTENSION_TO_MIME)) {
    if (lowerName.endsWith(ext)) {
      return mime;
    }
  }
  return null;
}

export function readBillFile(file: File): Promise<UploadedBillFile> {
  return new Promise((resolve, reject) => {
    const mimeType = resolveSupportedMimeType(file);
    if (!mimeType) {
      reject(
        new Error(
          "Unsupported file format. Please select a PNG, JPEG, WEBP image or a PDF electricity bill."
        )
      );
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      reject(
        new Error(
          "File size exceeds 12 MB. Please upload a smaller image or PDF."
        )
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Could not read the selected file from your device."));
    };
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!base64) {
        reject(new Error("The selected file appears to be empty."));
        return;
      }
      resolve({
        name: file.name,
        sizeBytes: file.size,
        mimeType,
        dataUrl,
        base64,
        isPdf: mimeType === "application/pdf",
      });
    };
    reader.readAsDataURL(file);
  });
}

export interface BillReviewFormState {
  provider: ProviderName | "";
  billingMonth: string;
  dueDate: string;
  unitsConsumed: string;
  previousMeterReading: string;
  currentMeterReading: string;
  perUnitRate: string;
  connectedLoad: string;
  electricityCharges: string;
  taxesAndAdditionalCharges: string;
  totalBillAmount: string;
  amountAfterDueDate: string;
}

export const EMPTY_BILL_FORM: BillReviewFormState = {
  provider: "",
  billingMonth: "",
  dueDate: "",
  unitsConsumed: "",
  previousMeterReading: "",
  currentMeterReading: "",
  perUnitRate: "",
  connectedLoad: "",
  electricityCharges: "",
  taxesAndAdditionalCharges: "",
  totalBillAmount: "",
  amountAfterDueDate: "",
};

function strOrEmpty(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export function mapExtractedToFormAndStatus(ext: ExtractedBillPayload): {
  form: BillReviewFormState;
  statusMap: Record<keyof BillReviewFormState, FieldExtractionStatus>;
  extractedCount: number;
  totalTrackedFields: number;
} {
  const uncertainSet = new Set(
    Array.isArray(ext.uncertainFields) ? ext.uncertainFields : []
  );

  const normalizedProvider: ProviderName | "" = ext.provider
    ? PROVIDERS.includes(ext.provider as ProviderName)
      ? (ext.provider as ProviderName)
      : "Other"
    : "";

  const form: BillReviewFormState = {
    provider: normalizedProvider,
    billingMonth: strOrEmpty(ext.billingMonth),
    dueDate: strOrEmpty(ext.dueDate),
    unitsConsumed: strOrEmpty(ext.unitsConsumed),
    previousMeterReading: strOrEmpty(ext.previousMeterReading),
    currentMeterReading: strOrEmpty(ext.currentMeterReading),
    perUnitRate: strOrEmpty(ext.perUnitRate),
    connectedLoad: strOrEmpty(ext.connectedLoad),
    electricityCharges: strOrEmpty(ext.electricityCharges),
    taxesAndAdditionalCharges: strOrEmpty(ext.taxesAndAdditionalCharges),
    totalBillAmount: strOrEmpty(ext.totalBillAmount),
    amountAfterDueDate: strOrEmpty(ext.amountAfterDueDate),
  };

  const keys = Object.keys(form) as Array<keyof BillReviewFormState>;
  const statusMap = {} as Record<
    keyof BillReviewFormState,
    FieldExtractionStatus
  >;

  let extractedCount = 0;

  for (const key of keys) {
    const hasVal = form[key] !== "";
    if (!hasVal) {
      statusMap[key] = "missing";
    } else if (uncertainSet.has(key)) {
      statusMap[key] = "uncertain";
      extractedCount++;
    } else {
      statusMap[key] = "extracted";
      extractedCount++;
    }
  }

  return {
    form,
    statusMap,
    extractedCount,
    totalTrackedFields: keys.length,
  };
}
