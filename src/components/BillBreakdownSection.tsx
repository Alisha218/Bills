import React, { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Edit3, Check, X } from "lucide-react";
import { BillBreakdown, BillRecord } from "../types/bill";
import { PAKISTANI_BILL_CATEGORY_HELP } from "../data/demoData";
import { formatPkr } from "../utils/calculations";

interface BillBreakdownSectionProps {
  activeBill: BillRecord | null;
  isDemoMode: boolean;
  onUpdateBreakdown: (breakdown: BillBreakdown) => void;
  onNavigateAnalyze: () => void;
}

const CATEGORY_ORDER: Array<{
  key: keyof BillBreakdown;
  color: string;
}> = [
  { key: "electricityCharges", color: "#22D3EE" },
  { key: "taxes", color: "#A3E635" },
  { key: "fuelPriceAdjustment", color: "#38BDF8" },
  { key: "otherAdjustments", color: "#F59E0B" },
  { key: "fixedCharges", color: "#818CF8" },
  { key: "duties", color: "#94A3B8" },
];

export const BillBreakdownSection: React.FC<BillBreakdownSectionProps> = ({
  activeBill,
  isDemoMode,
  onUpdateBreakdown,
  onNavigateAnalyze,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<keyof BillBreakdown, string>>({
    electricityCharges: "",
    fuelPriceAdjustment: "",
    taxes: "",
    duties: "",
    fixedCharges: "",
    otherAdjustments: "",
  });

  if (!activeBill) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Bill Breakdown
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            See how electricity charges, FPA, duties, fixed charges, and taxes make up your total bill.
          </p>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-dashed border-slate-800 p-10 text-center">
          <p className="text-sm font-medium text-slate-200">
            No active bill selected
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Upload or enter a bill in Analyze My Bill, or activate Demo Mode from Overview to explore a complete Pakistani bill breakdown.
          </p>
          <button
            type="button"
            onClick={onNavigateAnalyze}
            className="mt-5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
          >
            Go to Analyze My Bill
          </button>
        </div>
      </div>
    );
  }

  const startEditing = () => {
    setDraft({
      electricityCharges:
        activeBill.breakdown.electricityCharges !== null
          ? String(activeBill.breakdown.electricityCharges)
          : "",
      fuelPriceAdjustment:
        activeBill.breakdown.fuelPriceAdjustment !== null
          ? String(activeBill.breakdown.fuelPriceAdjustment)
          : "",
      taxes:
        activeBill.breakdown.taxes !== null
          ? String(activeBill.breakdown.taxes)
          : "",
      duties:
        activeBill.breakdown.duties !== null
          ? String(activeBill.breakdown.duties)
          : "",
      fixedCharges:
        activeBill.breakdown.fixedCharges !== null
          ? String(activeBill.breakdown.fixedCharges)
          : "",
      otherAdjustments:
        activeBill.breakdown.otherAdjustments !== null
          ? String(activeBill.breakdown.otherAdjustments)
          : "",
    });
    setEditing(true);
  };

  const handleSaveDraft = () => {
    const parseVal = (s: string): number | null => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      const num = Number(trimmed);
      return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
    };

    onUpdateBreakdown({
      electricityCharges: parseVal(draft.electricityCharges),
      fuelPriceAdjustment: parseVal(draft.fuelPriceAdjustment),
      taxes: parseVal(draft.taxes),
      duties: parseVal(draft.duties),
      fixedCharges: parseVal(draft.fixedCharges),
      otherAdjustments: parseVal(draft.otherAdjustments),
    });
    setEditing(false);
  };

  const chartItems = CATEGORY_ORDER.map((cat) => ({
    key: cat.key,
    name: PAKISTANI_BILL_CATEGORY_HELP[cat.key].title,
    value: activeBill.breakdown[cat.key],
    color: cat.color,
  })).filter(
    (item): item is { key: keyof BillBreakdown; name: string; value: number; color: string } =>
      item.value !== null && item.value > 0
  );

  const categorizedSum = chartItems.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="text-cyan-300 font-medium">
              {activeBill.provider} · {activeBill.billingMonth}
            </span>
            {isDemoMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300 font-medium">
                  DEMO DATA — NOT AN ACTUAL BILL
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Bill Breakdown
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every charge category explained in everyday language. Missing categories are marked unavailable rather than guessed.
          </p>
        </div>

        {!editing ? (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap shrink-0 self-start"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit Breakdown Amounts
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0 self-start">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-lime-400 hover:bg-lime-300 transition-colors whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              Save Breakdown
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors whitespace-nowrap"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Visual Donut + Summary Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Share of Total Payable
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Proportional split of itemized charges on this bill
            </p>
          </div>

          {chartItems.length > 0 ? (
            <div className="my-6 flex flex-col items-center">
              <div className="relative h-64 w-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartItems}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={100}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {chartItems.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B111C",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#F8FAFC",
                      }}
                      formatter={(val: unknown) => [formatPkr(Number(val)), "Amount"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[11px] text-slate-400">Total Payable</span>
                  <span className="font-mono text-lg font-semibold text-white tabular-nums">
                    {formatPkr(activeBill.totalBillAmount)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="my-8 rounded-lg border border-dashed border-slate-800 p-6 text-center">
              <p className="text-sm text-slate-300">
                No itemized charge amounts provided yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Click &ldquo;Edit Breakdown Amounts&rdquo; to enter line items from your paper bill.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 tabular-nums">
            <span>Itemized sum</span>
            <span className="font-mono text-slate-200">
              {categorizedSum > 0 ? formatPkr(categorizedSum) : "Unavailable"}
            </span>
          </div>
        </div>

        {/* Category-by-Category Detailed List */}
        <div className="lg:col-span-7 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <h2 className="font-display text-lg font-semibold text-white">
              Category Details &amp; Explanations
            </h2>
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {activeBill.unitsConsumed} kWh
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {CATEGORY_ORDER.map((cat) => {
              const meta = PAKISTANI_BILL_CATEGORY_HELP[cat.key];
              const value = activeBill.breakdown[cat.key];
              const share =
                value !== null && activeBill.totalBillAmount > 0
                  ? (value / activeBill.totalBillAmount) * 100
                  : null;

              return (
                <div key={cat.key} className="py-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-white">
                        {meta.title}
                      </span>
                    </div>

                    {editing ? (
                      <input
                        type="number"
                        min="0"
                        placeholder="Unavailable"
                        value={draft[cat.key]}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [cat.key]: e.target.value }))
                        }
                        className="w-36 rounded-md bg-[#090E17] border border-slate-700 px-2.5 py-1 text-right font-mono text-sm text-white focus:border-cyan-400 focus:outline-none"
                      />
                    ) : value !== null ? (
                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-semibold text-white tabular-nums">
                          {formatPkr(value)}
                        </span>
                        {share !== null && (
                          <span className="ml-2 font-mono text-xs text-slate-400 tabular-nums">
                            ({share.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 shrink-0">
                        Unavailable in source bill
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400 pl-5">
                    {meta.explanation}
                  </p>
                </div>
              );
            })}

            <div className="pt-4 flex items-center justify-between gap-4">
              <span className="font-display text-base font-semibold text-white">
                Total Payable
              </span>
              <span className="font-mono text-lg font-semibold text-cyan-300 tabular-nums">
                {formatPkr(activeBill.totalBillAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
