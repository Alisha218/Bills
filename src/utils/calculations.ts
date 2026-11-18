import {
  ApplianceItem,
  BillBreakdown,
  BillInvestigationReport,
  BillRecord,
  MonthlyEntry,
  RateConfig,
} from "../types/bill";
import { PAKISTANI_BILL_CATEGORY_HELP } from "../data/demoData";

export function formatPkr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Mandatory simulator formula:
 * Monthly kWh = (Wattage × Quantity × Hours per day × Days per month) / 1000
 */
export function calculateApplianceKwh(item: ApplianceItem): number {
  const wattage = Math.max(0, Number(item.wattage) || 0);
  const quantity = Math.max(0, Number(item.quantity) || 0);
  const hours = Math.min(24, Math.max(0, Number(item.hoursPerDay) || 0));
  const days = Math.min(31, Math.max(0, Number(item.daysPerMonth) || 0));
  return (wattage * quantity * hours * days) / 1000;
}

export function calculateTotalSimulatorKwh(items: ApplianceItem[]): number {
  return items.reduce((sum, item) => sum + calculateApplianceKwh(item), 0);
}

export function calculateAverageCostPerUnit(
  totalBillAmount: number,
  unitsConsumed: number
): number | null {
  if (!unitsConsumed || unitsConsumed <= 0 || totalBillAmount < 0) {
    return null;
  }
  return totalBillAmount / unitsConsumed;
}

export function calculatePercentageChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    previous <= 0
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

export function resolveEffectiveRate(
  rateConfig: RateConfig,
  activeBill: BillRecord | null
): { rate: number; label: string } {
  if (rateConfig.mode === "bill-average" && activeBill) {
    const avg = calculateAverageCostPerUnit(
      activeBill.totalBillAmount,
      activeBill.unitsConsumed
    );
    if (avg !== null) {
      return {
        rate: avg,
        label: `Derived from active bill (${activeBill.billingMonth} avg: PKR ${avg.toFixed(2)}/kWh)`,
      };
    }
  }
  if (rateConfig.mode === "custom") {
    const safeRate = Math.max(1, Number(rateConfig.customRate) || 45);
    return {
      rate: safeRate,
      label: `User-entered rate (PKR ${safeRate.toFixed(2)}/kWh)`,
    };
  }
  const illustrative = Math.max(1, Number(rateConfig.illustrativeRate) || 48);
  return {
    rate: illustrative,
    label: `Illustrative sample rate only (PKR ${illustrative.toFixed(2)}/kWh — not an official tariff)`,
  };
}

export function estimateNextMonthBill(
  activeBill: BillRecord | null,
  history: MonthlyEntry[]
): { amount: number | null; basisNote: string } {
  if (!activeBill) {
    return { amount: null, basisNote: "Requires an active bill to estimate" };
  }

  if (history.length >= 3) {
    const lastThree = history.slice(-3);
    const avgThree =
      lastThree.reduce((acc, item) => acc + item.billAmount, 0) / lastThree.length;
    const blended = activeBill.totalBillAmount * 0.65 + avgThree * 0.35;
    return {
      amount: Math.round(blended),
      basisNote: "Calculated estimate (65% current bill + 35% 3-month rolling average)",
    };
  }

  if (activeBill.previousBillAmount && activeBill.previousBillAmount > 0) {
    const blended =
      activeBill.totalBillAmount * 0.7 + activeBill.previousBillAmount * 0.3;
    return {
      amount: Math.round(blended),
      basisNote: "Calculated estimate (weighted blend of current and prior month)",
    };
  }

  return {
    amount: Math.round(activeBill.totalBillAmount),
    basisNote: "Calculated estimate assuming similar consumption next month",
  };
}

export function generateLocalBillInvestigation(
  bill: BillRecord,
  previousBill?: BillRecord | null
): BillInvestigationReport {
  const avgRate = calculateAverageCostPerUnit(
    bill.totalBillAmount,
    bill.unitsConsumed
  );

  const prevAmount = previousBill?.totalBillAmount ?? bill.previousBillAmount;
  const prevUnits = previousBill?.unitsConsumed ?? bill.previousUnitsConsumed;
  const prevAvgRate =
    prevAmount !== null && prevAmount !== undefined && prevUnits && prevUnits > 0
      ? prevAmount / prevUnits
      : null;

  const amountChangePct = calculatePercentageChange(bill.totalBillAmount, prevAmount);
  const unitChangePct = calculatePercentageChange(bill.unitsConsumed, prevUnits);

  // Determine neutral verdict category strictly from evidence
  let verdictCategory: BillInvestigationReport["verdictCategory"] = "insufficient-data";
  let verdictHeadline = "Insufficient information to determine the cause of change";

  if (prevAmount !== null && prevAmount !== undefined && prevUnits !== null && prevUnits !== undefined) {
    const unitDiff = bill.unitsConsumed - prevUnits;
    const amountDiff = bill.totalBillAmount - prevAmount;
    if (unitDiff > 0 && amountChangePct !== null && unitChangePct !== null) {
      if (amountChangePct > unitChangePct + 6) {
        verdictCategory = "charges-faster-than-consumption";
        verdictHeadline = "Total charges increased faster than consumption";
      } else {
        verdictCategory = "consumption-increased";
        verdictHeadline = "Consumption increased compared to the previous month";
      }
    } else if (unitDiff <= 0 && amountDiff > 0) {
      verdictCategory = "additional-charges-verify";
      verdictHeadline = "Additional charges or higher unit cost require verification";
    } else if (unitDiff < 0 && amountDiff <= 0) {
      verdictCategory = "consumption-decreased";
      verdictHeadline = "Both consumption and total payable decreased";
    } else {
      verdictCategory = "additional-charges-verify";
      verdictHeadline = "Payable amount shifted slightly despite steady units";
    }
  } else if (prevAmount !== null && prevAmount !== undefined) {
    const amountDiff = bill.totalBillAmount - prevAmount;
    verdictCategory =
      amountDiff > 0 ? "additional-charges-verify" : "consumption-decreased";
    verdictHeadline =
      amountDiff > 0
        ? "Total payable increased; prior units needed to separate usage vs. rate"
        : "Total payable decreased compared to the previous bill";
  }

  let summary = `Your ${bill.provider} bill for ${bill.billingMonth} is ${formatPkr(bill.totalBillAmount)} for ${formatNumber(bill.unitsConsumed)} kWh`;
  if (avgRate !== null) {
    summary += ` (an average of PKR ${avgRate.toFixed(2)} per unit including all listed charges).`;
  } else {
    summary += ".";
  }

  if (amountChangePct !== null && prevAmount !== null && prevAmount !== undefined) {
    const dir = amountChangePct >= 0 ? "increased" : "decreased";
    summary += ` Total payable ${dir} by ${formatPkr(Math.abs(bill.totalBillAmount - prevAmount))} (${Math.abs(amountChangePct).toFixed(1)}%) compared to ${formatPkr(prevAmount)}.`;
  }

  // Driver analysis
  let driverAnalysis =
    "Previous month units or itemized breakdown were not provided, so we cannot isolate whether the bill was driven by higher usage or higher per-unit charges.";

  if (
    prevAmount !== null &&
    prevAmount !== undefined &&
    prevUnits !== null &&
    prevUnits !== undefined &&
    avgRate !== null &&
    prevAvgRate !== null
  ) {
    const unitDiff = bill.unitsConsumed - prevUnits;
    const rateDiff = avgRate - prevAvgRate;
    const usageDriverEst = unitDiff * prevAvgRate;
    const rateDriverEst = (bill.totalBillAmount - prevAmount) - usageDriverEst;

    driverAnalysis = `Units moved from ${prevUnits} kWh to ${bill.unitsConsumed} kWh (${unitDiff >= 0 ? "+" : ""}${unitDiff} kWh), while your average cost per unit moved from PKR ${prevAvgRate.toFixed(2)} to PKR ${avgRate.toFixed(2)} (${rateDiff >= 0 ? "+" : ""}PKR ${rateDiff.toFixed(2)}/kWh). Roughly ${formatPkr(Math.abs(usageDriverEst))} of the bill change aligns with ${unitDiff >= 0 ? "higher" : "lower"} consumption, and ${formatPkr(Math.abs(rateDriverEst))} aligns with ${rateDiff >= 0 ? "higher" : "lower"} effective per-unit charges and adjustments.`;
  }

  // Confusing terms tailored to actual extracted amounts
  const termExplanations: BillInvestigationReport["termExplanations"] = [
    {
      term: "Average Cost per Unit",
      amountNote: avgRate !== null ? `PKR ${avgRate.toFixed(2)} / kWh` : undefined,
      explanation:
        "Calculated as Total Bill ÷ Units Consumed. Because Pakistani bills bundle base electricity charges with FPA, fixed fees, and taxes, this blended figure is higher than the base unit tariff alone.",
    },
  ];

  if (bill.breakdown.fuelPriceAdjustment !== null) {
    termExplanations.push({
      term: PAKISTANI_BILL_CATEGORY_HELP.fuelPriceAdjustment.title,
      amountNote: formatPkr(bill.breakdown.fuelPriceAdjustment),
      explanation: PAKISTANI_BILL_CATEGORY_HELP.fuelPriceAdjustment.explanation,
    });
  }

  if (bill.breakdown.taxes !== null || bill.breakdown.duties !== null) {
    const combinedTaxes =
      (bill.breakdown.taxes ?? 0) + (bill.breakdown.duties ?? 0);
    termExplanations.push({
      term: "Taxes & Electricity Duties",
      amountNote: formatPkr(combinedTaxes),
      explanation:
        "Includes government levies such as General Sales Tax (GST), PTV Fee, Neelum-Jhelum / FC surcharges, withholding income tax (when thresholds apply), and provincial electricity duty.",
    });
  }

  if (bill.breakdown.fixedCharges !== null) {
    termExplanations.push({
      term: PAKISTANI_BILL_CATEGORY_HELP.fixedCharges.title,
      amountNote: formatPkr(bill.breakdown.fixedCharges),
      explanation: PAKISTANI_BILL_CATEGORY_HELP.fixedCharges.explanation,
    });
  }

  if (bill.breakdown.otherAdjustments !== null) {
    termExplanations.push({
      term: PAKISTANI_BILL_CATEGORY_HELP.otherAdjustments.title,
      amountNote: formatPkr(bill.breakdown.otherAdjustments),
      explanation: PAKISTANI_BILL_CATEGORY_HELP.otherAdjustments.explanation,
    });
  }

  // Verification checklist strictly relevant to present fields
  const itemsToVerify: string[] = [];

  if (bill.currentMeterReading !== null && bill.previousMeterReading !== null) {
    const readingDiff = bill.currentMeterReading - bill.previousMeterReading;
    if (Math.abs(readingDiff - bill.unitsConsumed) > 5) {
      itemsToVerify.push(
        `Your meter reading difference (${bill.previousMeterReading} → ${bill.currentMeterReading} = ${readingDiff} units) differs from the billed ${bill.unitsConsumed} units. Verify whether a meter multiplier, estimated reading, or prior adjustment applies.`
      );
    } else {
      itemsToVerify.push(
        `Confirm the printed current reading (${bill.currentMeterReading}) matches the reading shown on your physical electricity meter.`
      );
    }
  } else {
    itemsToVerify.push(
      "Compare the current meter reading printed on your paper bill against your physical meter display."
    );
  }

  if (bill.issueDate || bill.dueDate) {
    itemsToVerify.push(
      `Check the billing dates (${bill.issueDate ? `Issued: ${bill.issueDate}` : ""}${bill.issueDate && bill.dueDate ? " · " : ""}${bill.dueDate ? `Due: ${bill.dueDate}` : ""}) to confirm a normal ~30-day billing period${
        bill.amountAfterDueDate !== null
          ? ` and avoid the ${formatPkr(bill.amountAfterDueDate - bill.totalBillAmount)} late surcharge (After Due Date: ${formatPkr(bill.amountAfterDueDate)}).`
          : "."
      }`
    );
  }

  if (bill.unitsConsumed >= 195 && bill.unitsConsumed <= 320) {
    itemsToVerify.push(
      `Your consumption (${bill.unitsConsumed} kWh) is near common 200-unit or 300-unit residential slab transitions. Verify whether crossing a slab threshold raised your effective rate.`
    );
  }

  if (amountChangePct !== null && amountChangePct > 20) {
    itemsToVerify.push(
      "Your payable amount rose by more than 20%. Verify whether carried-forward arrears, FPA from an earlier high-usage month, or QTA contributed."
    );
  }

  if (bill.breakdown.otherAdjustments !== null && bill.breakdown.otherAdjustments > 0) {
    itemsToVerify.push(
      `Review the Other Adjustments / Arrears line (${formatPkr(bill.breakdown.otherAdjustments)}) on the paper bill to see if it reflects QTA or an unpaid prior balance.`
    );
  }

  const practicalNextSteps = [
    "Use the Bill Difference Detector to compare two full bills side-by-side and pinpoint which exact charge category changed most.",
    "Open the Usage Simulator (now benchmarked against your confirmed billed units) to see which appliances drive your load.",
    "Save this month in Compare & Track to spot seasonal cooling spikes before they surprise you.",
  ];

  return {
    verdictHeadline,
    verdictCategory,
    summary,
    driverAnalysis,
    termExplanations,
    itemsToVerify,
    practicalNextSteps,
    generatedBy: "local",
  };
}

export interface CategoryDiffRow {
  key: keyof BillBreakdown;
  label: string;
  prev: number | null;
  curr: number | null;
  delta: number | null;
  pctChange: number | null;
}

export interface DeterministicBillDiff {
  unitsPrev: number;
  unitsCurr: number;
  unitsDelta: number;
  unitsPct: number | null;
  totalPrev: number;
  totalCurr: number;
  totalDelta: number;
  totalPct: number | null;
  avgRatePrev: number | null;
  avgRateCurr: number | null;
  avgRateDelta: number | null;
  avgRatePct: number | null;
  categories: CategoryDiffRow[];
  largestChangedCategory: CategoryDiffRow | null;
  increasedItems: Array<{ label: string; deltaText: string; absDelta: number }>;
  decreasedItems: Array<{ label: string; deltaText: string; absDelta: number }>;
  verificationFlags: string[];
  becauseSummary: string;
}

export function computeDeterministicBillDiff(
  prev: BillRecord,
  curr: BillRecord
): DeterministicBillDiff {
  const unitsDelta = curr.unitsConsumed - prev.unitsConsumed;
  const unitsPct = calculatePercentageChange(curr.unitsConsumed, prev.unitsConsumed);
  const totalDelta = curr.totalBillAmount - prev.totalBillAmount;
  const totalPct = calculatePercentageChange(curr.totalBillAmount, prev.totalBillAmount);

  const avgRatePrev = calculateAverageCostPerUnit(prev.totalBillAmount, prev.unitsConsumed);
  const avgRateCurr = calculateAverageCostPerUnit(curr.totalBillAmount, curr.unitsConsumed);
  const avgRateDelta =
    avgRatePrev !== null && avgRateCurr !== null ? avgRateCurr - avgRatePrev : null;
  const avgRatePct =
    avgRatePrev !== null && avgRateCurr !== null
      ? calculatePercentageChange(avgRateCurr, avgRatePrev)
      : null;

  const categoryKeys: Array<{ key: keyof BillBreakdown; label: string }> = [
    { key: "electricityCharges", label: "Electricity Charges" },
    { key: "fuelPriceAdjustment", label: "Fuel Price Adjustment (FPA)" },
    { key: "taxes", label: "Taxes" },
    { key: "duties", label: "Electricity Duty" },
    { key: "fixedCharges", label: "Fixed Charges" },
    { key: "otherAdjustments", label: "Other Adjustments / QTA" },
  ];

  const categories: CategoryDiffRow[] = categoryKeys.map(({ key, label }) => {
    const pVal = prev.breakdown[key];
    const cVal = curr.breakdown[key];
    const delta = pVal !== null && cVal !== null ? cVal - pVal : null;
    const pctChange =
      pVal !== null && cVal !== null && pVal > 0
        ? calculatePercentageChange(cVal, pVal)
        : null;
    return { key, label, prev: pVal, curr: cVal, delta, pctChange };
  });

  const comparableCategories = categories.filter((c) => c.delta !== null);
  const largestChangedCategory =
    comparableCategories.length > 0
      ? [...comparableCategories].sort(
          (a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)
        )[0]
      : null;

  const increasedItems: DeterministicBillDiff["increasedItems"] = [];
  const decreasedItems: DeterministicBillDiff["decreasedItems"] = [];

  if (unitsDelta > 0) {
    increasedItems.push({
      label: "Units Consumed",
      deltaText: `+${unitsDelta} kWh${unitsPct !== null ? ` (+${unitsPct.toFixed(1)}%)` : ""}`,
      absDelta: unitsDelta,
    });
  } else if (unitsDelta < 0) {
    decreasedItems.push({
      label: "Units Consumed",
      deltaText: `${unitsDelta} kWh${unitsPct !== null ? ` (${unitsPct.toFixed(1)}%)` : ""}`,
      absDelta: Math.abs(unitsDelta),
    });
  }

  if (avgRateDelta !== null) {
    if (avgRateDelta > 0.25) {
      increasedItems.push({
        label: "Average Cost per Unit",
        deltaText: `+PKR ${avgRateDelta.toFixed(2)}/kWh`,
        absDelta: avgRateDelta,
      });
    } else if (avgRateDelta < -0.25) {
      decreasedItems.push({
        label: "Average Cost per Unit",
        deltaText: `-PKR ${Math.abs(avgRateDelta).toFixed(2)}/kWh`,
        absDelta: Math.abs(avgRateDelta),
      });
    }
  }

  for (const cat of comparableCategories) {
    if ((cat.delta ?? 0) > 0) {
      increasedItems.push({
        label: cat.label,
        deltaText: `+${formatPkr(cat.delta)}`,
        absDelta: cat.delta ?? 0,
      });
    } else if ((cat.delta ?? 0) < 0) {
      decreasedItems.push({
        label: cat.label,
        deltaText: `-${formatPkr(Math.abs(cat.delta ?? 0))}`,
        absDelta: Math.abs(cat.delta ?? 0),
      });
    }
  }

  const verificationFlags: string[] = [];
  if (comparableCategories.length === 0) {
    verificationFlags.push(
      "Itemized charge breakdown was missing on one or both bills, so category-level drivers could not be compared."
    );
  }
  if (avgRateDelta !== null && Math.abs(avgRateDelta) >= 3) {
    verificationFlags.push(
      `Effective cost per unit shifted by ${avgRateDelta >= 0 ? "+" : ""}PKR ${avgRateDelta.toFixed(2)}/kWh (${prev.billingMonth} PKR ${avgRatePrev?.toFixed(2)} vs. ${curr.billingMonth} PKR ${avgRateCurr?.toFixed(2)}). Check whether your usage crossed a slab threshold or FPA/QTA changed.`
    );
  }
  if (
    curr.currentMeterReading !== null &&
    curr.previousMeterReading !== null &&
    Math.abs(curr.currentMeterReading - curr.previousMeterReading - curr.unitsConsumed) > 5
  ) {
    verificationFlags.push(
      `Current bill meter reading difference (${curr.currentMeterReading - curr.previousMeterReading}) does not match billed units (${curr.unitsConsumed}). Verify the printed meter snapshot.`
    );
  }
  if (
    curr.breakdown.otherAdjustments !== null &&
    prev.breakdown.otherAdjustments !== null &&
    curr.breakdown.otherAdjustments - prev.breakdown.otherAdjustments > 500
  ) {
    verificationFlags.push(
      `Other Adjustments / QTA rose by +${formatPkr(curr.breakdown.otherAdjustments - prev.breakdown.otherAdjustments)}. Confirm whether arrears or quarterly tariff adjustments were applied.`
    );
  }

  // Deterministic "Your bill changed because..." summary
  let becauseSummary = "";
  if (totalDelta === 0) {
    becauseSummary = `Your ${curr.billingMonth} bill remained unchanged at ${formatPkr(curr.totalBillAmount)} compared to ${prev.billingMonth}.`;
  } else {
    const dirWord = totalDelta > 0 ? "increased" : "decreased";
    const parts: string[] = [];
    parts.push(
      `Your bill ${dirWord} by ${formatPkr(Math.abs(totalDelta))} (${totalPct !== null ? `${Math.abs(totalPct).toFixed(1)}%` : ""}) from ${prev.billingMonth} to ${curr.billingMonth}.`
    );

    if (unitsDelta !== 0) {
      parts.push(
        `Electricity consumption ${unitsDelta > 0 ? "rose" : "dropped"} by ${Math.abs(unitsDelta)} kWh (${prev.unitsConsumed} → ${curr.unitsConsumed} kWh).`
      );
    } else {
      parts.push(`Consumption stayed flat at ${curr.unitsConsumed} kWh.`);
    }

    if (largestChangedCategory && largestChangedCategory.delta !== null) {
      parts.push(
        `Among itemized categories, ${largestChangedCategory.label} changed the most (${largestChangedCategory.delta >= 0 ? "+" : "-"}${formatPkr(Math.abs(largestChangedCategory.delta))}).`
      );
    } else {
      parts.push(
        "Itemized charge lines were not available on both bills to isolate individual tax or FPA shifts."
      );
    }

    becauseSummary = parts.join(" ");
  }

  return {
    unitsPrev: prev.unitsConsumed,
    unitsCurr: curr.unitsConsumed,
    unitsDelta,
    unitsPct,
    totalPrev: prev.totalBillAmount,
    totalCurr: curr.totalBillAmount,
    totalDelta,
    totalPct,
    avgRatePrev,
    avgRateCurr,
    avgRateDelta,
    avgRatePct,
    categories,
    largestChangedCategory,
    increasedItems,
    decreasedItems,
    verificationFlags,
    becauseSummary,
  };
}

export function exportHistoryToCsv(entries: MonthlyEntry[]): void {
  const headers = [
    "Month",
    "Provider",
    "Units (kWh)",
    "Bill Amount (PKR)",
    "Avg PKR/kWh",
    "Notes",
    "Type",
  ];
  const rows = entries.map((e) => {
    const avg = e.unitsConsumed > 0 ? (e.billAmount / e.unitsConsumed).toFixed(2) : "0";
    return [
      `"${e.month.replace(/"/g, '""')}"`,
      `"${e.provider}"`,
      e.unitsConsumed,
      e.billAmount,
      avg,
      `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      e.isDemo ? "Demo Sample" : "User Saved",
    ].join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bill-check-monthly-history.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
