export type NavSection =
  | "overview"
  | "analyze"
  | "difference"
  | "breakdown"
  | "simulator"
  | "compare"
  | "tips";

export type ProviderName =
  | "K-Electric"
  | "LESCO"
  | "IESCO"
  | "FESCO"
  | "MEPCO"
  | "HESCO"
  | "GEPCO"
  | "QESCO"
  | "Other";

export type DataSourceKind = "demo" | "manual" | "extracted";

export type FieldExtractionStatus = "extracted" | "uncertain" | "missing" | "edited";

export interface BillBreakdown {
  electricityCharges: number | null;
  fuelPriceAdjustment: number | null;
  taxes: number | null;
  duties: number | null;
  fixedCharges: number | null;
  otherAdjustments: number | null;
}

export interface BillRecord {
  id: string;
  provider: ProviderName;
  consumerNumber: string | null;
  meterNumber: string | null;
  billingMonth: string;
  issueDate: string | null;
  dueDate: string | null;
  unitsConsumed: number;
  totalBillAmount: number;
  amountAfterDueDate: number | null;
  perUnitRate: number | null;
  connectedLoad: string | null;
  previousBillAmount: number | null;
  previousUnitsConsumed: number | null;
  previousMeterReading: number | null;
  currentMeterReading: number | null;
  meterPhase: string | null;
  source: DataSourceKind;
  breakdown: BillBreakdown;
  createdAt: string;
  extractionNotes?: string | null;
  fieldStatus?: Record<string, FieldExtractionStatus>;
}

export interface ExtractedBillPayload {
  provider: string | null;
  billingMonth: string | null;
  dueDate: string | null;
  unitsConsumed: number | null;
  previousMeterReading: number | null;
  currentMeterReading: number | null;
  perUnitRate: number | null;
  connectedLoad: string | null;
  electricityCharges: number | null;
  taxesAndAdditionalCharges: number | null;
  totalBillAmount: number | null;
  amountAfterDueDate: number | null;
  uncertainFields: string[];
  extractionNotes: string | null;
  ocrConfidence?: number | null;
  rawOcrText?: string | null;
  extractionMethod?: "pdf-text" | "pdf-ocr" | "image-ocr" | null;
  validationWarnings?: string[];
}

export interface BillTermExplanation {
  term: string;
  amountNote?: string;
  explanation: string;
}

export interface BillInvestigationReport {
  verdictHeadline: string;
  verdictCategory:
    | "consumption-increased"
    | "charges-faster-than-consumption"
    | "additional-charges-verify"
    | "consumption-decreased"
    | "insufficient-data";
  summary: string;
  driverAnalysis: string;
  termExplanations: BillTermExplanation[];
  itemsToVerify: string[];
  practicalNextSteps: string[];
  generatedBy: "gemini" | "local";
}

export interface BillDifferenceComparison {
  previousBill: BillRecord;
  currentBill: BillRecord;
  becauseSummary: string;
  verificationFlags: string[];
  generatedBy: "gemini" | "local";
}

export type ApplianceCategory =
  | "Air Conditioner"
  | "Refrigerator"
  | "Washing Machine"
  | "Television"
  | "Fans"
  | "Lights"
  | "Water Pump"
  | "Iron"
  | "Microwave"
  | "Other";

export interface ApplianceItem {
  id: string;
  name: string;
  category: ApplianceCategory;
  quantity: number;
  wattage: number;
  hoursPerDay: number;
  daysPerMonth: number;
}

export type RateSourceMode = "bill-average" | "custom" | "illustrative";

export interface RateConfig {
  mode: RateSourceMode;
  customRate: number;
  illustrativeRate: number;
}

export interface MonthlyEntry {
  id: string;
  month: string;
  provider: ProviderName;
  unitsConsumed: number;
  billAmount: number;
  notes?: string;
  isDemo?: boolean;
}

export interface EnergyTip {
  id: string;
  category:
    | "Air Conditioner"
    | "Refrigerator"
    | "Fans & Lighting"
    | "Standby Power"
    | "Maintenance"
    | "Peak Hours";
  title: string;
  action: string;
  whyItMatters: string;
  assumption: string;
  estimatedKwhSavedPerMonth: number;
  matchedApplianceCategories: ApplianceCategory[];
}
