import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  Trash2,
  Download,
  TrendingUp,
  TrendingDown,
  RotateCcw,
} from "lucide-react";
import { MonthlyEntry, ProviderName } from "../types/bill";
import { PROVIDERS } from "../data/demoData";
import {
  calculatePercentageChange,
  exportHistoryToCsv,
  formatNumber,
  formatPkr,
} from "../utils/calculations";

interface CompareTrackSectionProps {
  history: MonthlyEntry[];
  isDemoMode: boolean;
  onAddEntry: (entry: MonthlyEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAllUserEntries: () => void;
  onExploreDemo: () => void;
}

export const CompareTrackSection: React.FC<CompareTrackSectionProps> = ({
  history,
  isDemoMode,
  onAddEntry,
  onDeleteEntry,
  onClearAllUserEntries,
  onExploreDemo,
}) => {
  const [month, setMonth] = useState("November 2026");
  const [provider, setProvider] = useState<ProviderName>("LESCO");
  const [units, setUnits] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [chartMetric, setChartMetric] = useState<"units" | "amount">("units");

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    let highest = history[0];
    let lowest = history[0];
    let totalUnits = 0;
    let totalAmount = 0;

    for (const item of history) {
      if (item.unitsConsumed > highest.unitsConsumed) highest = item;
      if (item.unitsConsumed < lowest.unitsConsumed) lowest = item;
      totalUnits += item.unitsConsumed;
      totalAmount += item.billAmount;
    }

    const latest = history[history.length - 1];
    const previous = history.length >= 2 ? history[history.length - 2] : null;
    const latestChangePct = previous
      ? calculatePercentageChange(latest.billAmount, previous.billAmount)
      : null;

    return {
      highest,
      lowest,
      avgUnits: totalUnits / history.length,
      avgAmount: totalAmount / history.length,
      latestChangePct,
    };
  }, [history]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedMonth = month.trim();
    const u = Number(units);
    const b = Number(billAmount);

    if (!trimmedMonth) {
      setFormError("Please enter a billing month.");
      return;
    }
    if (!Number.isFinite(u) || u <= 0) {
      setFormError("Units consumed must be greater than 0.");
      return;
    }
    if (!Number.isFinite(b) || b <= 0) {
      setFormError("Bill amount must be greater than 0 PKR.");
      return;
    }

    onAddEntry({
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      month: trimmedMonth,
      provider,
      unitsConsumed: Math.round(u),
      billAmount: Math.round(b),
      notes: notes.trim() || undefined,
      isDemo: false,
    });

    setUnits("");
    setBillAmount("");
    setNotes("");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Saved locally in your browser</span>
            {isDemoMode && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-amber-300 font-medium">
                  INCLUDES DEMO DATA — NOT ACTUAL BILLS
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Compare &amp; Track Monthly Bills
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Log your monthly units and PKR amounts to track seasonal trends, spikes, and averages. Your entries persist across page refreshes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => exportHistoryToCsv(history)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
          {history.some((h) => !h.isDemo) && (
            <button
              type="button"
              onClick={onClearAllUserEntries}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear Saved Entries
            </button>
          )}
        </div>
      </div>

      {/* Add Monthly Entry Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-4"
      >
        <h2 className="font-display text-base font-semibold text-white">
          Add Monthly Bill Entry
        </h2>

        {formError && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-200">
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="track-month"
              className="block text-xs text-slate-400 mb-1"
            >
              Billing Month *
            </label>
            <input
              id="track-month"
              type="text"
              placeholder="e.g. November 2026"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="track-provider"
              className="block text-xs text-slate-400 mb-1"
            >
              Provider
            </label>
            <select
              id="track-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderName)}
              className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="track-units"
              className="block text-xs text-slate-400 mb-1"
            >
              Units Consumed (kWh) *
            </label>
            <input
              id="track-units"
              type="number"
              min="1"
              placeholder="e.g. 340"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="track-amount"
              className="block text-xs text-slate-400 mb-1"
            >
              Bill Amount (PKR) *
            </label>
            <input
              id="track-amount"
              type="number"
              min="1"
              placeholder="e.g. 18900"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="track-notes"
              className="block text-xs text-slate-400 mb-1"
            >
              Optional Note
            </label>
            <input
              id="track-notes"
              type="text"
              placeholder="e.g. 1 AC active"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg bg-[#090E17] border border-slate-700/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Save Month to Tracker
          </button>
        </div>
      </form>

      {/* Summary KPIs */}
      {stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
              <div className="text-xs text-slate-400">
                Average Monthly Consumption
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-cyan-300 tabular-nums">
                {formatNumber(stats.avgUnits, 0)} kWh
              </div>
              <div className="mt-1.5 text-xs text-slate-400 font-mono tabular-nums">
                Avg bill: {formatPkr(stats.avgAmount)}
              </div>
            </div>

            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
              <div className="text-xs text-slate-400">
                Highest Consumption Month
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-rose-300 tabular-nums">
                {formatNumber(stats.highest.unitsConsumed)} kWh
              </div>
              <div className="mt-1.5 text-xs text-slate-400 tabular-nums">
                {stats.highest.month} · {formatPkr(stats.highest.billAmount)}
              </div>
            </div>

            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
              <div className="text-xs text-slate-400">
                Lowest Consumption Month
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-lime-300 tabular-nums">
                {formatNumber(stats.lowest.unitsConsumed)} kWh
              </div>
              <div className="mt-1.5 text-xs text-slate-400 tabular-nums">
                {stats.lowest.month} · {formatPkr(stats.lowest.billAmount)}
              </div>
            </div>

            <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
              <div className="text-xs text-slate-400">
                Latest Month-over-Month Change
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-2xl font-semibold tabular-nums">
                {stats.latestChangePct !== null ? (
                  <>
                    {stats.latestChangePct <= 0 ? (
                      <TrendingDown className="h-5 w-5 text-lime-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-rose-400" />
                    )}
                    <span
                      className={
                        stats.latestChangePct <= 0
                          ? "text-lime-300"
                          : "text-rose-300"
                      }
                    >
                      {stats.latestChangePct > 0 ? "+" : ""}
                      {stats.latestChangePct.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <span className="text-base text-slate-400">
                    Add 2+ months
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                {history.length} month{history.length === 1 ? "" : "s"} tracked
              </div>
            </div>
          </div>

          {/* Interactive Monthly Chart */}
          <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  Monthly Trend Comparison
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Switch between units consumed (kWh) and bill amounts (PKR)
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#090E17] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setChartMetric("units")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    chartMetric === "units"
                      ? "bg-cyan-400 text-slate-950 font-semibold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Units (kWh)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric("amount")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    chartMetric === "amount"
                      ? "bg-cyan-400 text-slate-950 font-semibold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Bill Amount (PKR)
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={history}
                  margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1E293B"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: "#94A3B8", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={68}
                    unit={chartMetric === "units" ? " kWh" : ""}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0B111C",
                      borderColor: "#334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#F8FAFC",
                    }}
                    formatter={(val: unknown) =>
                      chartMetric === "units"
                        ? [`${Number(val)} kWh`, "Units Consumed"]
                        : [formatPkr(Number(val)), "Bill Amount"]
                    }
                  />
                  <Bar
                    dataKey={
                      chartMetric === "units" ? "unitsConsumed" : "billAmount"
                    }
                    fill={chartMetric === "units" ? "#22D3EE" : "#A3E635"}
                    radius={[5, 5, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Saved History Table */}
          <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6">
            <h2 className="font-display text-lg font-semibold text-white mb-4">
              Recorded Months
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                    <th className="py-2.5 pr-3">Month</th>
                    <th className="py-2.5 px-2">Provider</th>
                    <th className="py-2.5 px-2 text-right">Units (kWh)</th>
                    <th className="py-2.5 px-2 text-right">Bill (PKR)</th>
                    <th className="py-2.5 px-2 text-right">Avg PKR/Unit</th>
                    <th className="py-2.5 px-2 text-right">Change vs Prior</th>
                    <th className="py-2.5 px-2">Notes</th>
                    <th className="py-2.5 pl-2 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {history.map((entry, idx) => {
                    const prev = idx > 0 ? history[idx - 1] : null;
                    const diffPct = prev
                      ? calculatePercentageChange(
                          entry.billAmount,
                          prev.billAmount
                        )
                      : null;
                    const avgUnit =
                      entry.unitsConsumed > 0
                        ? entry.billAmount / entry.unitsConsumed
                        : 0;

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 pr-3 font-medium text-white">
                          {entry.month}
                          {entry.isDemo && (
                            <span className="ml-2 text-[11px] font-mono text-amber-300">
                              DEMO
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-slate-300">
                          {entry.provider}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-cyan-300 tabular-nums">
                          {formatNumber(entry.unitsConsumed)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-white tabular-nums">
                          {formatPkr(entry.billAmount)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-300 tabular-nums">
                          PKR {avgUnit.toFixed(2)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-xs tabular-nums">
                          {diffPct !== null ? (
                            <span
                              className={
                                diffPct <= 0
                                  ? "text-lime-300"
                                  : "text-rose-300"
                              }
                            >
                              {diffPct > 0 ? "+" : ""}
                              {diffPct.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-400 max-w-[200px] truncate">
                          {entry.notes || "—"}
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteEntry(entry.id)}
                            className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            aria-label={`Delete entry for ${entry.month}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-[#0F1623] border border-dashed border-slate-800 p-10 text-center">
          <p className="text-sm font-medium text-slate-200">
            No monthly bill entries saved yet
          </p>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Add your first monthly bill above, or explore the 6-month Pakistani demo dataset.
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
  );
};
