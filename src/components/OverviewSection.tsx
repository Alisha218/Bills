import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileSearch,
  GitCompare,
  Sliders,
  Sparkles,
  Info,
} from "lucide-react";
import { BillRecord, MonthlyEntry, NavSection } from "../types/bill";
import {
  calculatePercentageChange,
  estimateNextMonthBill,
  formatNumber,
  formatPkr,
} from "../utils/calculations";

interface OverviewSectionProps {
  activeBill: BillRecord | null;
  history: MonthlyEntry[];
  isDemoMode: boolean;
  onExploreDemo: () => void;
  onNavigate: (section: NavSection) => void;
}

const CHART_COLORS = [
  "#22D3EE",
  "#A3E635",
  "#38BDF8",
  "#F59E0B",
  "#818CF8",
  "#94A3B8",
];

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  activeBill,
  history,
  isDemoMode,
  onExploreDemo,
  onNavigate,
}) => {
  const pctChange = activeBill
    ? calculatePercentageChange(
        activeBill.totalBillAmount,
        activeBill.previousBillAmount
      )
    : null;

  const nextMonthEstimate = estimateNextMonthBill(activeBill, history);

  const compositionData = activeBill
    ? [
        {
          name: "Electricity Charges",
          value: activeBill.breakdown.electricityCharges,
        },
        { name: "Taxes", value: activeBill.breakdown.taxes },
        {
          name: "Fuel Price Adj. (FPA)",
          value: activeBill.breakdown.fuelPriceAdjustment,
        },
        {
          name: "Other Adj. (QTA)",
          value: activeBill.breakdown.otherAdjustments,
        },
        { name: "Fixed Charges", value: activeBill.breakdown.fixedCharges },
        { name: "Duties", value: activeBill.breakdown.duties },
      ].filter(
        (item): item is { name: string; value: number } =>
          item.value !== null && item.value > 0
      )
    : [];

  return (
    <div className="space-y-8">
      {/* Hero Banner communicating the core value proposition immediately */}
      <section className="rounded-xl bg-gradient-to-br from-[#101827] via-[#0F1726] to-[#0B111C] border border-slate-800/90 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-cyan-300">Bill Check</span>
              <span aria-hidden="true">·</span>
              <span>Understand your bill. Take control of your energy.</span>
              {isDemoMode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-amber-300 font-medium">
                    DEMO DATA — NOT AN ACTUAL BILL
                  </span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white [text-wrap:balance]">
              Upload your bill. Discover what changed. Understand what you&apos;re paying for.
            </h1>
            <p className="text-sm sm:text-[15px] leading-relaxed text-slate-300 max-w-xl">
              {activeBill
                ? `Active investigation for ${activeBill.provider} (${activeBill.billingMonth}). Compare two bills side-by-side or simulate appliance reductions below.`
                : "Read Pakistani electricity bills with AI extraction, detect month-over-month differences, and test how appliance changes impact your units."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!isDemoMode && (
              <button
                type="button"
                onClick={onExploreDemo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-4 w-4" />
                Explore Demo
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate("analyze")}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isDemoMode
                  ? "text-slate-950 bg-cyan-400 hover:bg-cyan-300"
                  : "text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700"
              }`}
            >
              <FileSearch className="h-4 w-4" />
              Analyze a Bill
            </button>
          </div>
        </div>

        {/* 3 Prioritized Core Workflows */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => onNavigate("analyze")}
            className="text-left rounded-lg bg-[#090E17]/90 hover:bg-[#0B121E] border border-slate-800 hover:border-cyan-500/40 p-4 transition-colors group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span>01. Bill Investigation</span>
              <FileSearch className="h-4 w-4" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-cyan-200">
              Upload &amp; Review Bill
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Extract all 15 bill fields, verify uncertain values side-by-side, and get a full change verdict.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("difference")}
            className="text-left rounded-lg bg-[#090E17]/90 hover:bg-[#0B121E] border border-slate-800 hover:border-lime-500/40 p-4 transition-colors group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-lime-300">
              <span>02. Signature Feature</span>
              <GitCompare className="h-4 w-4" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-lime-200">
              Bill Difference Detector
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Compare previous and current bills side-by-side to pinpoint why your payable amount changed.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("simulator")}
            className="text-left rounded-lg bg-[#090E17]/90 hover:bg-[#0B121E] border border-slate-800 hover:border-cyan-500/40 p-4 transition-colors group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span>03. Interactive Modeling</span>
              <Sliders className="h-4 w-4" />
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white group-hover:text-cyan-200">
              What if I reduce usage?
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Benchmark appliances against your billed kWh and test AC, LED bulb, and standby reductions.
            </p>
          </button>
        </div>
      </section>

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">
            {isDemoMode ? "Current Sample Bill" : "Current Estimated / Latest Bill"}
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
            {activeBill ? formatPkr(activeBill.totalBillAmount) : "PKR —"}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {activeBill
              ? `${activeBill.provider} · ${activeBill.billingMonth}`
              : "Upload or explore demo to populate"}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">Units Consumed</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-cyan-300 tabular-nums">
            {activeBill ? `${formatNumber(activeBill.unitsConsumed)} kWh` : "— kWh"}
          </div>
          <div className="mt-2 text-xs text-slate-400 tabular-nums">
            {activeBill && activeBill.unitsConsumed > 0
              ? `Avg PKR ${(activeBill.totalBillAmount / activeBill.unitsConsumed).toFixed(2)} / unit`
              : "Calculated as Total ÷ Units"}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">
            Previous Month&apos;s Bill
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
            {activeBill?.previousBillAmount !== null &&
            activeBill?.previousBillAmount !== undefined
              ? formatPkr(activeBill.previousBillAmount)
              : "PKR —"}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs tabular-nums">
            {pctChange !== null ? (
              <>
                {pctChange <= 0 ? (
                  <ArrowDownRight className="h-3.5 w-3.5 text-lime-400 shrink-0" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                )}
                <span
                  className={
                    pctChange <= 0
                      ? "text-lime-300 font-medium"
                      : "text-rose-300 font-medium"
                  }
                >
                  {pctChange > 0 ? "+" : ""}
                  {pctChange.toFixed(1)}% {pctChange <= 0 ? "decrease" : "increase"}
                </span>
              </>
            ) : (
              <span className="text-slate-400">Prior month comparison</span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Estimated Next Month&apos;s Bill
            </span>
            <span className="text-[11px] font-mono text-cyan-300">ESTIMATE</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-lime-300 tabular-nums">
            {nextMonthEstimate.amount !== null
              ? formatPkr(nextMonthEstimate.amount)
              : "PKR —"}
          </div>
          <div className="mt-2 text-xs text-slate-400 line-clamp-2">
            {nextMonthEstimate.basisNote}
          </div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Monthly Consumption Trend
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Units consumed (kWh) across recorded months ·{" "}
                {isDemoMode ? "Sample household history" : "Saved tracker data"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("compare")}
              className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors whitespace-nowrap shrink-0"
            >
              Open Compare & Track →
            </button>
          </div>

          {history.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={history}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="overviewUnitsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    unit=" kWh"
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0B111C",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                    }}
                    formatter={(value: unknown, name: unknown) => {
                      const num = Number(value) || 0;
                      if (name === "unitsConsumed") {
                        return [`${num} kWh`, "Units Consumed"];
                      }
                      return [formatPkr(num), "Bill Amount"];
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="unitsConsumed"
                    stroke="#22D3EE"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#overviewUnitsGrad)"
                    activeDot={{ r: 5, fill: "#22D3EE", stroke: "#090E17", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6">
              <p className="text-sm font-medium text-slate-300">
                No monthly consumption history loaded yet
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                Click &ldquo;Explore Demo&rdquo; to inspect a 6-month Pakistani household trend, or add entries in Compare &amp; Track.
              </p>
              <button
                type="button"
                onClick={onExploreDemo}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors"
              >
                Explore Demo
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Bill Composition
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Breakdown of charges from your active bill
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("breakdown")}
              className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors whitespace-nowrap shrink-0"
            >
              Full Breakdown →
            </button>
          </div>

          {compositionData.length > 0 ? (
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 my-auto">
              <div className="h-52 w-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={compositionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {compositionData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        />
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
                      formatter={(value: unknown) => [formatPkr(Number(value)), "Amount"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full space-y-2.5">
                {compositionData.map((item, idx) => {
                  const pct =
                    activeBill && activeBill.totalBillAmount > 0
                      ? (item.value / activeBill.totalBillAmount) * 100
                      : 0;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-xs shrink-0"
                          style={{
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="font-mono text-slate-100 tabular-nums shrink-0">
                        {formatPkr(item.value)}{" "}
                        <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-slate-800 rounded-lg p-6">
              <p className="text-sm font-medium text-slate-300">
                {activeBill
                  ? "Detailed charge categories were not provided on this bill"
                  : "No bill composition available yet"}
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-xs">
                {activeBill
                  ? "Bill Check marks unprovided categories as unavailable instead of guessing. You can add them in Bill Breakdown."
                  : "Explore Demo or upload an electricity bill to visualize electricity charges, FPA, duties, and taxes."}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl bg-[#0D1420] border border-slate-800/80 px-5 py-4 text-xs text-slate-400">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="text-slate-200 font-medium">Data Transparency:</span>{" "}
          {isDemoMode
            ? "You are viewing DEMO DATA — NOT AN ACTUAL BILL. Sample values represent an illustrative LESCO residential household so you can explore all features without an API key."
            : "Bill Check separates entered/extracted bill figures from calculated estimates and never fabricates official DISCO tariff slabs or missing charges."}
        </p>
      </div>
    </div>
  );
};
