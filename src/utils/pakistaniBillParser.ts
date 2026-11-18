import { ExtractedBillPayload, ProviderName } from "../types/bill";

export interface OcrLineInfo {
  text: string;
  confidence: number;
}

export interface BillParseInput {
  rawText: string;
  ocrConfidence: number | null;
  extractionMethod: "pdf-text" | "pdf-ocr" | "image-ocr";
  lines?: OcrLineInfo[];
}

const MONTH_MAP: Record<string, string> = {
  jan: "January",
  january: "January",
  feb: "February",
  february: "February",
  mar: "March",
  march: "March",
  apr: "April",
  april: "April",
  may: "May",
  jun: "June",
  june: "June",
  jul: "July",
  july: "July",
  aug: "August",
  august: "August",
  sep: "September",
  sept: "September",
  september: "September",
  oct: "October",
  october: "October",
  nov: "November",
  november: "November",
  dec: "December",
  december: "December",
};

const PROVIDER_PATTERNS: Array<{
  provider: ProviderName;
  regex: RegExp;
  note?: string;
}> = [
  {
    provider: "K-Electric",
    regex: /\b(?:k[\s-]*electric|karachi\s+electric|kesc|ke\.com\.pk)\b/i,
  },
  {
    provider: "LESCO",
    regex: /\b(?:lesco|lahore\s+electric\s+supply|lesco\.gov\.pk)\b/i,
  },
  {
    provider: "IESCO",
    regex: /\b(?:iesco|islamabad\s+electric\s+supply|iesco\.com\.pk)\b/i,
  },
  {
    provider: "FESCO",
    regex: /\b(?:fesco|faisalabad\s+electric\s+supply|fesco\.com\.pk)\b/i,
  },
  {
    provider: "MEPCO",
    regex: /\b(?:mepco|multan\s+electric\s+power|mepco\.com\.pk)\b/i,
  },
  {
    provider: "HESCO",
    regex: /\b(?:hesco|hyderabad\s+electric\s+supply|hesco\.gov\.pk)\b/i,
  },
  {
    provider: "GEPCO",
    regex: /\b(?:gepco|gujranwala\s+electric\s+power|gepco\.com\.pk)\b/i,
  },
  {
    provider: "QESCO",
    regex: /\b(?:qesco|quetta\s+electric\s+supply|qesco\.com\.pk)\b/i,
  },
  {
    provider: "Other",
    regex: /\b(pesco|sepco|tesco|hazesco|wapda)\b/i,
    note: "Other Pakistani utility",
  },
];

// Lines from the 12-month billing history table on PITC/KE bills (e.g. "SEP-25  310  18450  18450")
const HISTORY_ROW_REGEX =
  /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s\-/]?\d{2,4}\s+\d{1,5}\s+[\d,]+/i;

function normalizeLines(rawText: string, ocrLines?: OcrLineInfo[]): OcrLineInfo[] {
  if (ocrLines && ocrLines.length > 0) {
    return ocrLines
      .map((l) => ({
        text: l.text.replace(/\s+/g, " ").trim(),
        confidence: l.confidence,
      }))
      .filter((l) => l.text.length > 0);
  }
  return rawText
    .split(/\r?\n/)
    .map((line) => ({
      text: line.replace(/\s+/g, " ").trim(),
      confidence: 95,
    }))
    .filter((l) => l.text.length > 0);
}

/**
 * Parses Pakistani currency / numeric strings like "23,840", "Rs. 23,840/-", "39.45", "(320)".
 */
export function parsePakistaniNumber(
  token: string,
  options: { allowNegative?: boolean; allowDecimals?: boolean } = {}
): number | null {
  if (!token) return null;
  let cleaned = token.trim();
  // Strip Pakistani "/-" currency suffix before checking negative sign
  cleaned = cleaned.replace(/\/-+$/g, "");

  let isNegative = false;
  if (/^\([\d,.\s]+\)$/.test(cleaned)) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  } else if (/^-\s*[\d,.]+/.test(cleaned)) {
    isNegative = true;
    cleaned = cleaned.replace(/^-\s*/, "");
  }

  // Common OCR digit confusions inside numeric tokens
  cleaned = cleaned
    .replace(/,/g, "")
    .replace(/(?<=\d)[Oo](?=\d)/g, "0")
    .replace(/^[Oo](?=\d)/g, "0")
    .replace(/(?<=\d)[Oo]$/g, "0")
    .replace(/[^\d.]/g, "");

  if (!cleaned || cleaned === ".") return null;
  const dotParts = cleaned.split(".");
  if (dotParts.length > 2) {
    cleaned = dotParts.slice(0, -1).join("") + "." + dotParts[dotParts.length - 1];
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  const signed = isNegative ? -value : value;
  if (!options.allowNegative && signed < 0) return null;

  if (options.allowDecimals) {
    return Math.round(signed * 100) / 100;
  }
  return Math.round(signed);
}

function normalizeBillingMonth(raw: string): string | null {
  const text = raw.trim();
  const wordMatch = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[\s,\-/]*(\d{2,4})\b/i
  );
  if (wordMatch) {
    const monthName = MONTH_MAP[wordMatch[1].toLowerCase()];
    let yearNum = Number(wordMatch[2]);
    if (wordMatch[2].length === 2) {
      yearNum += 2000;
    }
    if (monthName && yearNum >= 2000 && yearNum <= 2099) {
      return `${monthName} ${yearNum}`;
    }
  }

  const numMatch = text.match(/\b(0?[1-9]|1[0-2])[\-/](20\d{2})\b/);
  if (numMatch) {
    const monthIndex = Number(numMatch[1]);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[monthIndex - 1]} ${numMatch[2]}`;
  }

  return null;
}

function extractDateToken(text: string): string | null {
  const dmyWord = text.match(
    /\b(\d{1,2})[\s\-/](jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s\-/,]*(\d{2,4})\b/i
  );
  if (dmyWord) {
    const day = Number(dmyWord[1]);
    if (day >= 1 && day <= 31) {
      const mKey = dmyWord[2].toLowerCase().slice(0, 3);
      const shortMonths: Record<string, string> = {
        jan: "Jan",
        feb: "Feb",
        mar: "Mar",
        apr: "Apr",
        may: "May",
        jun: "Jun",
        jul: "Jul",
        aug: "Aug",
        sep: "Sep",
        oct: "Oct",
        nov: "Nov",
        dec: "Dec",
      };
      const year = dmyWord[3].length === 2 ? `20${dmyWord[3]}` : dmyWord[3];
      return `${String(day).padStart(2, "0")} ${shortMonths[mKey] ?? dmyWord[2]} ${year}`;
    }
  }

  const dmyNum = text.match(/\b(\d{1,2})[\-/](\d{1,2})[\-/](20\d{2}|\d{2})\b/);
  if (dmyNum) {
    const day = Number(dmyNum[1]);
    const month = Number(dmyNum[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = dmyNum[3].length === 2 ? `20${dmyNum[3]}` : dmyNum[3];
      return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
    }
  }

  const iso = text.match(/\b(20\d{2})[\-/](\d{1,2})[\-/](\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, "0")}-${iso[2].padStart(2, "0")}-${iso[1]}`;
  }

  return null;
}

interface NumberMatch {
  value: number;
  confidence: number;
  lineIndex: number;
  rawLine: string;
  isFallback?: boolean;
}

function extractNumbersFromText(
  text: string,
  options: {
    allowNegative?: boolean;
    allowDecimals?: boolean;
    min?: number;
    max?: number;
  } = {}
): number[] {
  const amountPattern =
    /(?:PKR|Rs\.?|RS\.?)?\s*(\(?-?\s*[\dOo,]+(?:\.\d{1,2})?(?:\/-)?\)?)/gi;
  const results: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = amountPattern.exec(text)) !== null) {
    const token = m[1];
    const parsed = parsePakistaniNumber(token, {
      allowNegative: options.allowNegative,
      allowDecimals: options.allowDecimals,
    });
    if (parsed === null) continue;
    if (options.min !== undefined && parsed < options.min) continue;
    if (options.max !== undefined && parsed > options.max) continue;
    results.push(parsed);
  }
  return results;
}

function findLabeledNumber(
  lines: OcrLineInfo[],
  labelRegex: RegExp,
  options: {
    allowNegative?: boolean;
    allowDecimals?: boolean;
    min?: number;
    max?: number;
    excludeLineRegex?: RegExp;
    afterLabelOnly?: boolean;
  } = {}
): NumberMatch | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (HISTORY_ROW_REGEX.test(line.text)) continue;
    if (options.excludeLineRegex && options.excludeLineRegex.test(line.text)) {
      continue;
    }

    const match = line.text.match(labelRegex);
    if (!match || match.index === undefined) continue;

    const tail = line.text.slice(match.index + match[0].length);
    const tailNums = extractNumbersFromText(tail, options);
    // Drop trailing year if multiple numbers exist on same line
    const filtered = tailNums.filter(
      (n, idx) =>
        !(
          idx > 0 &&
          Number.isInteger(n) &&
          n >= 2020 &&
          n <= 2035 &&
          tailNums.length > 1
        )
    );

    if (filtered.length > 0) {
      return {
        value: filtered[0],
        confidence: line.confidence,
        lineIndex: i,
        rawLine: line.text,
      };
    }

    if (!options.afterLabelOnly && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (
        !HISTORY_ROW_REGEX.test(nextLine.text) &&
        (!options.excludeLineRegex || !options.excludeLineRegex.test(nextLine.text)) &&
        nextLine.text.length <= 65
      ) {
        const nextNums = extractNumbersFromText(nextLine.text, options);
        if (nextNums.length > 0) {
          return {
            value: nextNums[0],
            confidence: Math.min(line.confidence, nextLine.confidence),
            lineIndex: i + 1,
            rawLine: `${line.text} | ${nextLine.text}`,
            isFallback: true,
          };
        }
      }
    }
  }

  return null;
}

function findLabeledDate(
  lines: OcrLineInfo[],
  labelRegex: RegExp,
  excludeRegex?: RegExp
): { value: string; confidence: number; uncertain: boolean } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (excludeRegex && excludeRegex.test(line.text)) continue;
    const match = line.text.match(labelRegex);
    if (!match || match.index === undefined) continue;

    const tail = line.text.slice(match.index + match[0].length);
    const dateInTail = extractDateToken(tail);
    if (dateInTail) {
      return {
        value: dateInTail,
        confidence: line.confidence,
        uncertain: line.confidence < 70,
      };
    }

    const dateInLine = extractDateToken(line.text);
    if (dateInLine) {
      return {
        value: dateInLine,
        confidence: line.confidence,
        uncertain: true,
      };
    }

    if (i + 1 < lines.length) {
      const nextDate = extractDateToken(lines[i + 1].text);
      if (nextDate) {
        return {
          value: nextDate,
          confidence: Math.min(line.confidence, lines[i + 1].confidence),
          uncertain: true,
        };
      }
    }
  }
  return null;
}

export function parsePakistaniElectricityBill(
  input: BillParseInput
): ExtractedBillPayload {
  const lines = normalizeLines(input.rawText, input.lines);
  const fullText = lines.map((l) => l.text).join("\n");
  const uncertainFields = new Set<string>();
  const validationWarnings: string[] = [];

  // 1. Electricity Provider
  let provider: string | null = null;
  let detectedOtherName: string | null = null;
  const matchedProviders: ProviderName[] = [];

  for (const item of PROVIDER_PATTERNS) {
    const m = fullText.match(item.regex);
    if (m) {
      if (!matchedProviders.includes(item.provider)) {
        matchedProviders.push(item.provider);
      }
      if (item.provider === "Other" && !detectedOtherName) {
        detectedOtherName = m[1].toUpperCase();
      }
    }
  }

  if (matchedProviders.length === 1) {
    provider = matchedProviders[0];
  } else if (matchedProviders.length > 1) {
    const specific = matchedProviders.filter((p) => p !== "Other");
    if (specific.length === 1) {
      provider = specific[0];
    } else if (specific.length > 1) {
      provider = specific[0];
      uncertainFields.add("provider");
    } else {
      provider = "Other";
    }
  }

  // 2. Billing Month
  let billingMonth: string | null = null;
  for (const line of lines) {
    if (/(?:bill(?:ing)?\s*month|for\s*the\s*month|month\s*[:\-])/i.test(line.text)) {
      const normalized = normalizeBillingMonth(line.text);
      if (normalized) {
        billingMonth = normalized;
        if (line.confidence < 70) uncertainFields.add("billingMonth");
        break;
      }
    }
  }
  if (!billingMonth) {
    const headerText = lines
      .slice(0, 18)
      .map((l) => l.text)
      .join(" ");
    const normalized = normalizeBillingMonth(headerText);
    if (normalized) {
      billingMonth = normalized;
      uncertainFields.add("billingMonth");
    }
  }

  // 3. Due Date
  const dueDateMatch = findLabeledDate(
    lines,
    /(?:due\s*date|payment\s*due\s*date|last\s*date\s*of\s*payment|pay\s*by)/i,
    /after\s*due\s*date/i
  );
  const dueDate = dueDateMatch?.value ?? null;
  if (dueDateMatch?.uncertain) uncertainFields.add("dueDate");

  // 4. Meter Previous Reading, Meter Current Reading & Units Consumed (kWh)
  const multiColumnReadingHeader =
    /\bprev(?:ious)?\b.*\b(?:present|curr(?:ent)?)\b/i;

  let prevReadingMatch = findLabeledNumber(
    lines,
    /(?:previous\s*(?:meter\s*)?reading|prev\.?\s*(?:meter\s*)?reading|past\s*reading|prev\.?\s*rdg)/i,
    { min: 0, max: 9999999, excludeLineRegex: multiColumnReadingHeader }
  );
  let currReadingMatch = findLabeledNumber(
    lines,
    /(?:(?:current|present)\s*(?:meter\s*)?reading|curr\.?\s*(?:meter\s*)?reading|pres\.?\s*rdg)/i,
    { min: 0, max: 9999999, excludeLineRegex: multiColumnReadingHeader }
  );
  let unitsMatch = findLabeledNumber(
    lines,
    /(?:units\s*(?:consumed|billed|charged)|total\s*units|billed\s*units|energy\s*consumed|\bkwh\s*consumed\b|\bunits\b(?!\s*(?:rate|price)))/i,
    {
      min: 0,
      max: 500000,
      excludeLineRegex:
        /(?:previous\s*month\s*units|prior\s*units|last\s*year|rate\s*per\s*unit|per\s*unit|avg|price|\bprev(?:ious)?\b.*\b(?:present|curr(?:ent)?)\b)/i,
    }
  );

  // Tabular meter reading header: e.g. "PREVIOUS   PRESENT   MF   UNITS" -> "24182   24600   1   418"
  if (!prevReadingMatch || !currReadingMatch || !unitsMatch) {
    for (let i = 0; i < lines.length - 1; i++) {
      const hdr = lines[i].text;
      if (
        /\bprev(?:ious)?\b/i.test(hdr) &&
        /\b(?:present|curr(?:ent)?)\b/i.test(hdr) &&
        /\bunits\b/i.test(hdr)
      ) {
        const rowLine = lines[i + 1];
        if (!HISTORY_ROW_REGEX.test(rowLine.text)) {
          const nums = extractNumbersFromText(rowLine.text, {
            min: 0,
            max: 9999999,
          });
          if (nums.length >= 3) {
            const hasMf = /\bmf\b/i.test(hdr);
            const unitsCandidate =
              hasMf && nums.length >= 4 ? nums[3] : nums[nums.length - 1];
            if (!prevReadingMatch) {
              prevReadingMatch = {
                value: nums[0],
                confidence: rowLine.confidence,
                lineIndex: i + 1,
                rawLine: rowLine.text,
                isFallback: true,
              };
            }
            if (!currReadingMatch) {
              currReadingMatch = {
                value: nums[1],
                confidence: rowLine.confidence,
                lineIndex: i + 1,
                rawLine: rowLine.text,
                isFallback: true,
              };
            }
            if (!unitsMatch) {
              unitsMatch = {
                value: unitsCandidate,
                confidence: rowLine.confidence,
                lineIndex: i + 1,
                rawLine: rowLine.text,
                isFallback: true,
              };
            }
            break;
          }
        }
      }
    }
  }

  const previousMeterReading = prevReadingMatch?.value ?? null;
  const currentMeterReading = currReadingMatch?.value ?? null;
  const unitsConsumed = unitsMatch?.value ?? null;

  if (
    prevReadingMatch &&
    (prevReadingMatch.confidence < 68 || prevReadingMatch.isFallback)
  ) {
    uncertainFields.add("previousMeterReading");
  }
  if (
    currReadingMatch &&
    (currReadingMatch.confidence < 68 || currReadingMatch.isFallback)
  ) {
    uncertainFields.add("currentMeterReading");
  }
  if (unitsMatch && (unitsMatch.confidence < 68 || unitsMatch.isFallback)) {
    uncertainFields.add("unitsConsumed");
  }

  // Cross-check readings vs units (without fabricating missing values!)
  if (previousMeterReading !== null && currentMeterReading !== null) {
    if (currentMeterReading < previousMeterReading) {
      const hasRolloverNote = /\b(?:rollover|reset|meter\s*change|replaced|defective)\b/i.test(
        fullText
      );
      uncertainFields.add("previousMeterReading");
      uncertainFields.add("currentMeterReading");
      validationWarnings.push(
        hasRolloverNote
          ? `Current meter reading (${currentMeterReading}) is below previous (${previousMeterReading}); bill references a meter rollover or replacement.`
          : `Current meter reading (${currentMeterReading}) is lower than previous reading (${previousMeterReading}). Verify for OCR misread or meter replacement.`
      );
    } else if (unitsConsumed !== null) {
      const diff = currentMeterReading - previousMeterReading;
      if (Math.abs(diff - unitsConsumed) > 5) {
        uncertainFields.add("unitsConsumed");
        validationWarnings.push(
          `Meter reading difference (${currentMeterReading} − ${previousMeterReading} = ${diff} kWh) differs from extracted units (${unitsConsumed} kWh). Verify for meter multiplier or TOU peak/off-peak rows.`
        );
      }
    }
  }

  // 5. Printed Electricity Rate / Per-Unit Price (ONLY if explicitly printed — NEVER calculated)
  let perUnitRateMatch = findLabeledNumber(
    lines,
    /(?:per[\s-]*unit\s*(?:rate|price)|(?:rate|price)\s*(?:per|\/)\s*unit|unit\s*(?:rate|price)|tariff\s*rate|energy\s*rate|slab\s*rate|rate\s*\(\s*(?:rs|pkr)\s*\/\s*kwh\s*\))/i,
    { allowDecimals: true, min: 1, max: 150 }
  );
  // Also recognize explicit "418 x 39.00" or "39.00 / kWh" slab lines
  if (!perUnitRateMatch) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const multMatch = l.text.match(
        /\b\d{1,5}\s*[xX×]\s*(\d{1,3}(?:\.\d{1,2})?)\b/
      );
      const unitSlashMatch = l.text.match(
        /(?:PKR|Rs\.?)?\s*(\d{1,3}(?:\.\d{1,2})?)\s*\/\s*(?:kWh|unit)\b/i
      );
      const rawRate = multMatch?.[1] ?? unitSlashMatch?.[1];
      if (rawRate) {
        const val = parsePakistaniNumber(rawRate, { allowDecimals: true });
        if (val !== null && val >= 1 && val <= 150) {
          perUnitRateMatch = {
            value: val,
            confidence: l.confidence,
            lineIndex: i,
            rawLine: l.text,
          };
          break;
        }
      }
    }
  }
  const perUnitRate = perUnitRateMatch?.value ?? null;
  if (perUnitRateMatch && perUnitRateMatch.confidence < 70) {
    uncertainFields.add("perUnitRate");
  }

  // 6. Connected Load / Sanctioned Load / Watts (ONLY if explicitly printed)
  let connectedLoad: string | null = null;
  for (const line of lines) {
    const loadMatch = line.text.match(
      /(?:(?:connected|sanctioned|contract)\s*load(?:\s*\(\s*(?:kw|w|watts|kva)\s*\))?|load\s*\(\s*(?:kw|w|watts|kva)\s*\))\s*[:\-]?\s*(\d+(?:\.\d{1,2})?\s*(?:kW|KW|W|Watts|KVA|kVA)?)/i
    );
    if (loadMatch && loadMatch[1]) {
      const candidate = loadMatch[1].replace(/\s+/g, " ").trim();
      if (/^\d/.test(candidate)) {
        // Ensure unit suffix if label said (kW) or (W)
        const hasUnit = /(?:kw|w|watts|kva)$/i.test(candidate);
        connectedLoad = hasUnit
          ? candidate
          : /\bw\b/i.test(line.text) && !/\bkw\b/i.test(line.text)
          ? `${candidate} W`
          : `${candidate} kW`;
        if (line.confidence < 70) uncertainFields.add("connectedLoad");
        break;
      }
    }
  }

  // 7. Total Bill Amount (Within Due Date) vs Amount Payable After Due Date
  const sideBySideDueHeader = /within\s*due\s*date.*after\s*due\s*date/i;

  let totalBillMatch = findLabeledNumber(
    lines,
    /(?:payable\s*within\s*due\s*date|within\s*due\s*date|total\s*bill(?:\s*amount)?|total\s*payable|net\s*payable|amount\s*payable|total\s*amount\s*due)/i,
    {
      min: 1,
      max: 50000000,
      excludeLineRegex:
        /(?:^\s*(?:payable\s*)?after\s*due\s*date|within\s*due\s*date.*after\s*due\s*date)/i,
    }
  );
  let afterDueMatch = findLabeledNumber(
    lines,
    /(?:payable\s*after\s*due\s*date|after\s*due\s*date|amount\s*after\s*due|late\s*payment\s*amount)/i,
    {
      min: 1,
      max: 50000000,
      excludeLineRegex: sideBySideDueHeader,
    }
  );

  let totalBillAmount = totalBillMatch?.value ?? null;
  let amountAfterDueDate = afterDueMatch?.value ?? null;

  // Handle side-by-side header boxes:
  // "PAYABLE WITHIN DUE DATE   PAYABLE AFTER DUE DATE"
  // "23,840                    25,740"
  if (totalBillAmount === null || amountAfterDueDate === null) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].text;
      if (sideBySideDueHeader.test(l)) {
        const sameLineNums = extractNumbersFromText(l, { min: 1, max: 50000000 });
        if (sameLineNums.length >= 2) {
          if (totalBillAmount === null) totalBillAmount = sameLineNums[0];
          if (amountAfterDueDate === null) amountAfterDueDate = sameLineNums[1];
          break;
        }
        if (i + 1 < lines.length) {
          const nextNums = extractNumbersFromText(lines[i + 1].text, {
            min: 1,
            max: 50000000,
          });
          if (nextNums.length >= 2) {
            if (totalBillAmount === null) totalBillAmount = nextNums[0];
            if (amountAfterDueDate === null) amountAfterDueDate = nextNums[1];
            break;
          }
        }
      }
    }
  }

  if (
    totalBillMatch &&
    (totalBillMatch.confidence < 68 || totalBillMatch.isFallback)
  ) {
    uncertainFields.add("totalBillAmount");
  }
  if (
    afterDueMatch &&
    (afterDueMatch.confidence < 68 || afterDueMatch.isFallback)
  ) {
    uncertainFields.add("amountAfterDueDate");
  }

  if (
    totalBillAmount !== null &&
    amountAfterDueDate !== null &&
    amountAfterDueDate < totalBillAmount
  ) {
    uncertainFields.add("totalBillAmount");
    uncertainFields.add("amountAfterDueDate");
    validationWarnings.push(
      `Payable after due date (PKR ${amountAfterDueDate.toLocaleString()}) is lower than total bill within due date (PKR ${totalBillAmount.toLocaleString()}). Verify both boxes on the bill.`
    );
  }

  // 8. Electricity Charges (Base energy charges — strictly distinct from Total Bill Amount)
  const elecChargesMatch = findLabeledNumber(
    lines,
    /(?:cost\s*of\s*electricity|electricity\s*charges|energy\s*charges|variable\s*charges|supply\s*charges)/i,
    {
      min: 0,
      max: 50000000,
      excludeLineRegex:
        /(?:electricity\s*duty|payable\s*within|payable\s*after|total\s*bill)/i,
    }
  );
  const electricityCharges = elecChargesMatch?.value ?? null;
  if (
    elecChargesMatch &&
    (elecChargesMatch.confidence < 68 || elecChargesMatch.isFallback)
  ) {
    uncertainFields.add("electricityCharges");
  }

  if (
    electricityCharges !== null &&
    totalBillAmount !== null &&
    electricityCharges > totalBillAmount * 1.05
  ) {
    uncertainFields.add("electricityCharges");
    validationWarnings.push(
      `Electricity charges (PKR ${electricityCharges.toLocaleString()}) exceed Total Bill (PKR ${totalBillAmount.toLocaleString()}). Check whether a credit/subsidy applies or if a figure was misread.`
    );
  }

  // 9. Taxes and Additional Charges (explicit combined line OR sum of printed tax/surcharge/FPA/duty lines)
  const explicitTaxesMatch = findLabeledNumber(
    lines,
    /(?:taxes\s*(?:&|and)\s*(?:additional|other)\s*charges|total\s*taxes(?:\s*(?:&|and)\s*surcharges)?|govt\.?\s*taxes\s*(?:&|and)\s*duties)/i,
    { min: 0, max: 20000000 }
  );

  let taxesAndAdditionalCharges: number | null = explicitTaxesMatch?.value ?? null;
  const additionalParts: string[] = [];

  if (taxesAndAdditionalCharges === null) {
    const additionalChargeRules: Array<{
      name: string;
      regex: RegExp;
      allowNegative?: boolean;
    }> = [
      {
        name: "FPA",
        regex: /(?:fuel\s*(?:price|charges?)\s*adj(?:ustment)?|\bf\.?p\.?a\.?\b|\bf\.?c\.?a\.?\b)/i,
        allowNegative: true,
      },
      {
        name: "Electricity Duty",
        regex: /(?:electricity\s*duty|elect\.?\s*duty|\be\.?\s*d\.?\b(?=\s*[:\dR]))/i,
      },
      {
        name: "Fixed Charges",
        regex: /(?:fixed\s*charges|fixed\s*fee|meter\s*rent|service\s*charges|standing\s*charges)/i,
      },
      {
        name: "GST",
        regex: /(?:g\.?s\.?t\.?|general\s*sales\s*tax|sales\s*tax)/i,
      },
      {
        name: "Further/Extra Tax",
        regex: /(?:further\s*tax|extra\s*tax)/i,
      },
      {
        name: "Income Tax",
        regex: /(?:income\s*tax|advance\s*tax|\bwht\b)/i,
      },
      {
        name: "PTV Fee",
        regex: /(?:p\.?t\.?v\.?\s*fee|tv\s*fee|t\.?v\.?\s*fee)/i,
      },
      {
        name: "FC/NJ Surcharge",
        regex: /(?:f\.?c\.?\s*surcharge|n\.?j\.?\s*surcharge|financing\s*cost\s*surcharge)/i,
      },
      {
        name: "QTA/Other Adj",
        regex: /(?:q\.?t\.?a\.?|quarterly\s*tariff\s*adj(?:ustment)?|other\s*adjustments?|tariff\s*rationalization)/i,
        allowNegative: true,
      },
    ];

    let sum = 0;
    let foundAny = false;
    let minConf = 100;
    const usedLineIndices = new Set<number>();

    for (const rule of additionalChargeRules) {
      const m = findLabeledNumber(lines, rule.regex, {
        allowNegative: rule.allowNegative,
        min: rule.allowNegative ? -1000000 : 0,
        max: 20000000,
      });
      if (m && !usedLineIndices.has(m.lineIndex)) {
        usedLineIndices.add(m.lineIndex);
        sum += m.value;
        foundAny = true;
        minConf = Math.min(minConf, m.confidence);
        additionalParts.push(`${rule.name}: PKR ${m.value.toLocaleString()}`);
      }
    }

    if (foundAny) {
      taxesAndAdditionalCharges = sum;
      if (minConf < 68) uncertainFields.add("taxesAndAdditionalCharges");
    }
  } else if (
    explicitTaxesMatch &&
    (explicitTaxesMatch.confidence < 68 || explicitTaxesMatch.isFallback)
  ) {
    uncertainFields.add("taxesAndAdditionalCharges");
  }

  // Summary note
  const noteParts: string[] = [];
  const methodLabel =
    input.extractionMethod === "pdf-text"
      ? "Direct PDF text extraction"
      : input.extractionMethod === "pdf-ocr"
      ? "Local PDF rendering + Tesseract OCR"
      : "Local Tesseract image OCR";

  if (input.ocrConfidence !== null) {
    noteParts.push(
      `${methodLabel} (${Math.round(input.ocrConfidence)}% text confidence).`
    );
    if (input.ocrConfidence < 65) {
      noteParts.push(
        "Scan contrast or sharpness was moderate/low — please verify fields before confirming."
      );
    }
  } else {
    noteParts.push(`${methodLabel}.`);
  }

  if (detectedOtherName && provider === "Other") {
    noteParts.push(`Detected utility header: ${detectedOtherName}.`);
  }
  if (additionalParts.length > 0) {
    noteParts.push(
      `Combined printed taxes & charges (${additionalParts.join(", ")}).`
    );
  }

  return {
    provider,
    billingMonth,
    dueDate,
    unitsConsumed,
    previousMeterReading,
    currentMeterReading,
    perUnitRate,
    connectedLoad,
    electricityCharges,
    taxesAndAdditionalCharges,
    totalBillAmount,
    amountAfterDueDate,
    uncertainFields: Array.from(uncertainFields),
    extractionNotes: noteParts.join(" "),
    ocrConfidence: input.ocrConfidence,
    rawOcrText: input.rawText,
    extractionMethod: input.extractionMethod,
    validationWarnings,
  };
}
