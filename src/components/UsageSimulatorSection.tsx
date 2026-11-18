import React, { useMemo, useState } from "react";
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
  Plus,
  Trash2,
  Sliders,
  Snowflake,
  Zap,
  Sparkles,
  Scale,
  Info,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
import {
  ApplianceCategory,
  ApplianceItem,
  BillRecord,
  RateConfig,
} from "../types/bill";
import {
  APPLIANCE_CATALOG,
  DEMO_APPLIANCES,
  EFFICIENT_HOUSEHOLD_APPLIANCES,
} from "../data/demoData";
import {
  calculateApplianceKwh,
  calculateTotalSimulatorKwh,
  formatNumber,
  formatPkr,
  resolveEffectiveRate,
} from "../utils/calculations";

interface UsageSimulatorSectionProps {
  appliances: ApplianceItem[];
  onChangeAppliances: (items: ApplianceItem[]) => void;
  rateConfig: RateConfig;
  onChangeRateConfig: (cfg: RateConfig) => void;
  activeBill: BillRecord | null;
}

type ScenarioTab = "scenario-a" | "scenario-b" | "scenario-c";

export const UsageSimulatorSection: React.FC<UsageSimulatorSectionProps> = ({
  appliances,
  onChangeAppliances,
  rateConfig,
  onChangeRateConfig,
  activeBill,
}) => {
  const [selectedCatalogCategory, setSelectedCatalogCategory] =
    useState<ApplianceCategory>("Air Conditioner");
  const [customName, setCustomName] = useState("");
  const [activeScenario, setActiveScenario] = useState<ScenarioTab>("scenario-a");

  // Scenario A: Reduce AC daily hours
  const [acHoursReduction, setAcHoursReduction] = useState<number>(1.5);

  // Scenario B: Conventional->LED bulb conversion + Standby reduction + Hour trims
  const [conventionalBulbsCount, setConventionalBulbsCount] = useState<number>(4);
  const [conventionalBulbWatts, setConventionalBulbWatts] = useState<number>(40);
  const [bulbHoursPerDay, setBulbHoursPerDay] = useState<number>(6);
  const [standbyReductionWatts, setStandbyReductionWatts] = useState<number>(20);
  const [scenarioBTrimHours, setScenarioBTrimHours] = useState<
    Record<string, number>
  >({});

  // Scenario C: Compare Current Household vs Efficient Household B
  const [householdB, setHouseholdB] = useState<ApplianceItem[]>(
    EFFICIENT_HOUSEHOLD_APPLIANCES
  );

  // Optional AI simulator briefing
  const [aiBriefing, setAiBriefing] = useState<{
    headline: string;
    insights: string[];
  } | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  const effectiveRate = useMemo(
    () => resolveEffectiveRate(rateConfig, activeBill),
    [rateConfig, activeBill]
  );

  const applianceRows = useMemo(() => {
    const withKwh = appliances.map((item) => ({
      ...item,
      monthlyKwh: calculateApplianceKwh(item),
    }));
    const total = withKwh.reduce((sum, r) => sum + r.monthlyKwh, 0);
    return withKwh
      .map((r) => ({
        ...r,
        sharePct: total > 0 ? (r.monthlyKwh / total) * 100 : 0,
        estimatedCost: r.monthlyKwh * effectiveRate.rate,
      }))
      .sort((a, b) => b.monthlyKwh - a.monthlyKwh);
  }, [appliances, effectiveRate.rate]);

  const totalKwh = useMemo(
    () => calculateTotalSimulatorKwh(appliances),
    [appliances]
  );
  const estimatedBillPkr = totalKwh * effectiveRate.rate;
  const topThree = applianceRows.slice(0, 3);

  // Comparison against Confirmed Billed Units (Part 4)
  const billedDeltaKwh =
    activeBill !== null ? totalKwh - activeBill.unitsConsumed : null;
  const billedDeltaPct =
    activeBill !== null && activeBill.unitsConsumed > 0
      ? ((totalKwh - activeBill.unitsConsumed) / activeBill.unitsConsumed) * 100
      : null;

  // Scenario A calculations
  const acAppliances = appliances.filter(
    (a) => a.category === "Air Conditioner"
  );
  const scenarioASavedKwh = useMemo(() => {
    return acAppliances.reduce((saved, ac) => {
      const reducedHours = Math.max(0, ac.hoursPerDay - acHoursReduction);
      const originalKwh = calculateApplianceKwh(ac);
      const reducedKwh =
        (ac.wattage * ac.quantity * reducedHours * ac.daysPerMonth) / 1000;
      return saved + Math.max(0, originalKwh - reducedKwh);
    }, 0);
  }, [acAppliances, acHoursReduction]);
  const scenarioANewKwh = Math.max(0, totalKwh - scenarioASavedKwh);
  const scenarioASavedPkr = scenarioASavedKwh * effectiveRate.rate;

  // Scenario B calculations: LED bulb swap + standby cut + daily hours trims
  const ledTargetWatts = 10;
  const ledSwapSavedKwh = useMemo(() => {
    const wattDiff = Math.max(0, conventionalBulbWatts - ledTargetWatts);
    return (wattDiff * conventionalBulbsCount * bulbHoursPerDay * 30) / 1000;
  }, [conventionalBulbWatts, conventionalBulbsCount, bulbHoursPerDay]);

  const standbySavedKwh = useMemo(() => {
    return (standbyReductionWatts * 24 * 30) / 1000;
  }, [standbyReductionWatts]);

  const scenarioBTrimmedItems = useMemo(() => {
    return appliances.map((item) => {
      const adjustedHours =
        scenarioBTrimHours[item.id] !== undefined
          ? scenarioBTrimHours[item.id]
          : item.hoursPerDay;
      return {
        ...item,
        hoursPerDay: adjustedHours,
      };
    });
  }, [appliances, scenarioBTrimHours]);

  const scenarioBTrimmedKwh = useMemo(
    () => calculateTotalSimulatorKwh(scenarioBTrimmedItems),
    [scenarioBTrimmedItems]
  );

  const scenarioBHoursSaved = Math.max(0, totalKwh - scenarioBTrimmedKwh);
  const scenarioBTotalSavedKwh =
    scenarioBHoursSaved + ledSwapSavedKwh + standbySavedKwh;
  const scenarioBNewKwh = Math.max(0, totalKwh - scenarioBTotalSavedKwh);
  const scenarioBSavedPkr = scenarioBTotalSavedKwh * effectiveRate.rate;

  // Scenario C calculations (Household A vs Efficient Household B)
  const householdBKwh = useMemo(
    () => calculateTotalSimulatorKwh(householdB),
    [householdB]
  );
  const householdBCost = householdBKwh * effectiveRate.rate;

  const comparisonChartData = useMemo(() => {
    if (activeScenario === "scenario-a") {
      return [
        {
          name: "Current Usage",
          kWh: Number(totalKwh.toFixed(1)),
          PKR: Math.round(estimatedBillPkr),
        },
        {
          name: `AC -${acHoursReduction}h/day`,
          kWh: Number(scenarioANewKwh.toFixed(1)),
          PKR: Math.round(scenarioANewKwh * effectiveRate.rate),
        },
      ];
    }
    if (activeScenario === "scenario-b") {
      return [
        {
          name: "Baseline",
          kWh: Number(totalKwh.toFixed(1)),
          PKR: Math.round(estimatedBillPkr),
        },
        {
          name: "LED + Standby + Trims",
          kWh: Number(scenarioBNewKwh.toFixed(1)),
          PKR: Math.round(scenarioBNewKwh * effectiveRate.rate),
        },
      ];
    }
    return [
      {
        name: "Household A (Yours)",
        kWh: Number(totalKwh.toFixed(1)),
        PKR: Math.round(estimatedBillPkr),
      },
      {
        name: "Household B (Efficient)",
        kWh: Number(householdBKwh.toFixed(1)),
        PKR: Math.round(householdBCost),
      },
    ];
  }, [
    activeScenario,
    totalKwh,
    estimatedBillPkr,
    acHoursReduction,
    scenarioANewKwh,
    effectiveRate.rate,
    scenarioBNewKwh,
    householdBKwh,
    householdBCost,
  ]);

  const handleAddAppliance = () => {
    const preset =
      APPLIANCE_CATALOG.find((c) => c.category === selectedCatalogCategory) ??
      APPLIANCE_CATALOG[0];
    const newItem: ApplianceItem = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name:
        selectedCatalogCategory === "Other" && customName.trim()
          ? customName.trim()
          : preset.defaultName,
      category: preset.category,
      quantity: 1,
      wattage: preset.defaultWattage,
      hoursPerDay: preset.defaultHours,
      daysPerMonth: preset.defaultDays,
    };
    onChangeAppliances([newItem, ...appliances]);
    if (selectedCatalogCategory === "Other") {
      setCustomName("");
    }
  };

  const handleUpdateAppliance = (
    id: string,
    field: keyof ApplianceItem,
    value: string | number
  ) => {
    onChangeAppliances(
      appliances.map((item) => {
        if (item.id !== id) return item;
        if (field === "name" || field === "category") {
          return { ...item, [field]: value };
        }
        const num = Math.max(0, Number(value) || 0);
        if (field === "hoursPerDay") {
          return { ...item, hoursPerDay: Math.min(24, num) };
        }
        if (field === "daysPerMonth") {
          return { ...item, daysPerMonth: Math.min(31, num) };
        }
        return { ...item, [field]: num };
      })
    );
  };

  const handleRemoveAppliance = (id: string) => {
    onChangeAppliances(appliances.filter((item) => item.id !== id));
  };

  const handleGenerateBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const res = await fetch("/api/explain-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalKwh: Math.round(totalKwh),
          actualBilledUnits: activeBill?.unitsConsumed ?? null,
          estimatedBillPkr: Math.round(estimatedBillPkr),
          ratePkr: Number(effectiveRate.rate.toFixed(2)),
          topAppliances: topThree.map((t) => ({
            name: t.name,
            monthlyKwh: Math.round(t.monthlyKwh),
            sharePct: Math.round(t.sharePct),
          })),
        }),
      });
      if (!res.ok) throw new Error("AI unavailable");
      const data = await res.json();
      if (data?.advice) {
        setAiBriefing(data.advice);
        return;
      }
      throw new Error("Empty advice");
    } catch {
      const top = topThree[0];
      setAiBriefing({
        headline: top
          ? `${top.name} accounts for ${top.sharePct.toFixed(0)}% of your simulated monthly load.`
          : "Add appliances to inspect your consumption profile.",
        insights: [
          activeBill
            ? `Your simulated appliances total ${Math.round(totalKwh)} kWh compared to ${activeBill.unitsConsumed} kWh billed on your ${activeBill.billingMonth} bill (${billedDeltaKwh !== null && billedDeltaKwh >= 0 ? "+" : ""}${Math.round(billedDeltaKwh ?? 0)} kWh difference).`
            : `Your top three appliances account for ${topThree.reduce((s, t) => s + t.sharePct, 0).toFixed(0)}% of total estimated units (${Math.round(totalKwh)} kWh/month).`,
          "Testing Scenario A (AC runtime) and Scenario B (replacing conventional bulbs with LEDs + cutting standby load) shows practical unit reductions without guessing tariff slabs.",
          "Actual utility bills also depend on compressor duty cycles, voltage fluctuations, UPS battery losses, FPA/QTA adjustments, and DISCO slab boundaries.",
        ],
      });
    } finally {
      setLoadingBriefing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Interactive Usage Simulator
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Model your household appliances using{" "}
            <span className="font-mono text-slate-300 text-xs">
              (Wattage × Qty × Hours/day × Days/mo) ÷ 1000
            </span>{" "}
            and compare directly against your analyzed bill.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeAppliances(DEMO_APPLIANCES)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Load Typical Household Preset
          </button>
          <button
            type="button"
            onClick={handleGenerateBriefing}
            disabled={loadingBriefing || appliances.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loadingBriefing ? "Analyzing Load..." : "Explain My Usage Impact"}
          </button>
        </div>
      </div>

      {/* Top Summary Metrics + Confirmed Billed Units Benchmark (Part 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">
            Simulated Appliance Usage
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-cyan-300 tabular-nums">
            {formatNumber(totalKwh, 1)}{" "}
            <span className="text-sm font-normal text-slate-400">kWh</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Across {appliances.length} appliance{appliances.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">
            Confirmed Billed Units Reference
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
            {activeBill ? `${formatNumber(activeBill.unitsConsumed)} kWh` : "No active bill"}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {activeBill
              ? `${activeBill.provider} · ${activeBill.billingMonth}`
              : "Analyze a bill or load Demo to benchmark"}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="text-xs font-medium text-slate-400">
            Simulated vs. Billed Difference
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {billedDeltaKwh !== null && billedDeltaPct !== null ? (
              <span
                className={
                  Math.abs(billedDeltaPct) <= 10
                    ? "text-lime-300"
                    : "text-amber-300"
                }
              >
                {billedDeltaKwh >= 0 ? "+" : ""}
                {formatNumber(billedDeltaKwh, 1)} kWh
              </span>
            ) : (
              <span className="text-slate-500 text-base">—</span>
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            {billedDeltaPct !== null
              ? `${billedDeltaPct >= 0 ? "+" : ""}${billedDeltaPct.toFixed(1)}% vs. actual billed units`
              : "Requires a confirmed bill"}
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Estimated Energy Cost
            </span>
            <span className="font-mono text-[11px] text-lime-300">ESTIMATE</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
            {formatPkr(estimatedBillPkr)}
          </div>
          <div className="mt-2 text-xs text-slate-400 truncate" title={effectiveRate.label}>
            {effectiveRate.label}
          </div>
        </div>
      </div>

      {/* Why Simulated vs Billed Can Differ */}
      {activeBill && (
        <div className="flex items-start gap-3 rounded-xl bg-[#0D1420] border border-slate-800/80 px-5 py-3.5 text-xs text-slate-300">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-semibold text-white">
              Comparing against {activeBill.billingMonth} ({activeBill.unitsConsumed} kWh billed):
            </span>{" "}
            {billedDeltaKwh !== null && Math.abs(billedDeltaKwh) <= 25
              ? "Your appliance inventory closely matches your billed units."
              : "Appliance estimates and actual billed units commonly differ due to AC/fridge compressor duty cycles, seasonal ambient heat, UPS battery charging losses, voltage drops, and unlogged electronics."}
          </p>
        </div>
      )}

      {/* Rate Basis Control */}
      <div className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white">
            Selected Rate Assumption (PKR / kWh)
          </span>
          <span className="text-[11px] text-slate-400">
            Used for estimated monetary savings · Not a guaranteed bill reduction
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!activeBill}
            onClick={() =>
              onChangeRateConfig({ ...rateConfig, mode: "bill-average" })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              rateConfig.mode === "bill-average" && activeBill
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "bg-[#090E17] text-slate-300 border border-slate-700/80 disabled:opacity-40"
            }`}
          >
            Active Bill Average{" "}
            {activeBill
              ? `(PKR ${(
                  activeBill.totalBillAmount / activeBill.unitsConsumed
                ).toFixed(1)})`
              : "(No Bill)"}
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeRateConfig({ ...rateConfig, mode: "custom" })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              rateConfig.mode === "custom"
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "bg-[#090E17] text-slate-300 border border-slate-700/80"
            }`}
          >
            Custom Rate (PKR/kWh)
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeRateConfig({ ...rateConfig, mode: "illustrative" })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              rateConfig.mode === "illustrative"
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "bg-[#090E17] text-slate-300 border border-slate-700/80"
            }`}
          >
            Illustrative Sample Rate
          </button>
        </div>

        {rateConfig.mode === "custom" && (
          <div className="flex items-center gap-3 pt-1">
            <label
              htmlFor="custom-rate-input"
              className="text-xs text-slate-300 whitespace-nowrap"
            >
              Your rate (PKR/kWh):
            </label>
            <input
              id="custom-rate-input"
              type="number"
              min="1"
              step="0.5"
              value={rateConfig.customRate}
              onChange={(e) =>
                onChangeRateConfig({
                  ...rateConfig,
                  customRate: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-28 rounded-lg bg-[#090E17] border border-slate-700 px-3 py-1.5 font-mono text-sm text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>
        )}

        {rateConfig.mode === "illustrative" && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label
              htmlFor="illustrative-rate-select"
              className="text-xs text-slate-400"
            >
              Sample benchmark rate (not an official tariff):
            </label>
            <select
              id="illustrative-rate-select"
              value={rateConfig.illustrativeRate}
              onChange={(e) =>
                onChangeRateConfig({
                  ...rateConfig,
                  illustrativeRate: Number(e.target.value),
                })
              }
              className="rounded-lg bg-[#090E17] border border-slate-700 px-3 py-1.5 font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value={35}>PKR 35 / kWh (Low-slab illustrative)</option>
              <option value={48}>PKR 48 / kWh (Mid-slab illustrative)</option>
              <option value={60}>PKR 60 / kWh (High-slab + taxes illustrative)</option>
            </select>
          </div>
        )}
      </div>

      {/* Optional AI / Local Briefing */}
      {aiBriefing && (
        <div className="rounded-xl bg-[#0D1624] border border-cyan-500/30 p-5 space-y-2">
          <div className="text-sm font-semibold text-cyan-200">
            {aiBriefing.headline}
          </div>
          <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
            {aiBriefing.insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Highest-Consuming Appliances + Interactive Scenarios */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Ranked High Consumers */}
        <div className="xl:col-span-5 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Highest-Consuming Appliances
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ranked by share of your simulated monthly units
            </p>

            {applianceRows.length > 0 ? (
              <div className="mt-5 space-y-4">
                {applianceRows.slice(0, 6).map((item, idx) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-200 truncate">
                        {idx + 1}. {item.name}
                      </span>
                      <span className="font-mono text-slate-300 tabular-nums shrink-0">
                        {formatNumber(item.monthlyKwh, 1)} kWh ·{" "}
                        <span className="text-cyan-300">
                          {item.sharePct.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          idx === 0
                            ? "bg-cyan-400"
                            : idx === 1
                            ? "bg-lime-400"
                            : "bg-sky-400/80"
                        }`}
                        style={{ width: `${Math.min(100, item.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-xs text-slate-400">
                Add appliances below to see which devices drive your bill.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            Top 3 appliances contribute{" "}
            <span className="font-mono text-white font-semibold tabular-nums">
              {topThree
                .reduce((sum, item) => sum + item.sharePct, 0)
                .toFixed(0)}
              %
            </span>{" "}
            of total simulated usage.
          </div>
        </div>

        {/* Interactive What-If Scenarios (A, B, C) */}
        <div className="xl:col-span-7 rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Interactive Savings Scenarios
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Test AC reduction, LED bulb swaps, standby cuts &amp; efficient households
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#090E17] border border-slate-800 self-start">
              <button
                type="button"
                onClick={() => setActiveScenario("scenario-a")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeScenario === "scenario-a"
                    ? "bg-cyan-400 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                A: Reduce AC
              </button>
              <button
                type="button"
                onClick={() => setActiveScenario("scenario-b")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeScenario === "scenario-b"
                    ? "bg-cyan-400 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                B: LED &amp; Standby
              </button>
              <button
                type="button"
                onClick={() => setActiveScenario("scenario-c")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  activeScenario === "scenario-c"
                    ? "bg-cyan-400 text-slate-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                C: Compare 2 Homes
              </button>
            </div>
          </div>

          {activeScenario === "scenario-a" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Snowflake className="h-4 w-4 text-cyan-300" />
                Scenario A: Reduce Daily Air Conditioner Usage
              </div>

              {acAppliances.length > 0 ? (
                <>
                  <div className="rounded-lg bg-[#090E17] border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        Reduce daily AC runtime by:
                      </span>
                      <span className="font-mono text-sm font-semibold text-cyan-300 tabular-nums">
                        -{acHoursReduction.toFixed(1)} hrs / day
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.5"
                      value={acHoursReduction}
                      onChange={(e) =>
                        setAcHoursReduction(Number(e.target.value))
                      }
                      className="w-full"
                      aria-label="Reduce daily AC usage hours"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>0 hrs (no change)</span>
                      <span>3 hrs/day less</span>
                      <span>6 hrs/day less</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                      <div className="text-[11px] text-slate-400">
                        Estimated Units Saved
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold text-lime-300 tabular-nums">
                        {formatNumber(scenarioASavedKwh, 1)} kWh/mo
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                      <div className="text-[11px] text-slate-400">
                        Est. Monetary Saving
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold text-lime-300 tabular-nums">
                        {formatPkr(scenarioASavedPkr)}/mo
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                      <div className="text-[11px] text-slate-400">
                        New Simulated Total
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                        {formatNumber(scenarioANewKwh, 1)} kWh
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-amber-300">
                  Add an Air Conditioner appliance below to simulate AC runtime reductions.
                </p>
              )}
            </div>
          )}

          {activeScenario === "scenario-b" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Lightbulb className="h-4 w-4 text-lime-300" />
                  Scenario B: Replace Conventional Bulbs with LEDs &amp; Cut Standby
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConventionalBulbsCount(4);
                    setConventionalBulbWatts(40);
                    setBulbHoursPerDay(6);
                    setStandbyReductionWatts(20);
                    setScenarioBTrimHours({});
                  }}
                  className="text-xs text-cyan-300 hover:text-cyan-200"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#090E17] border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white">
                      Conventional → 10W LED Swap
                    </span>
                    <span className="font-mono text-lime-300 tabular-nums">
                      -{formatNumber(ledSwapSavedKwh, 1)} kWh/mo
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-400 block mb-1">Bulbs</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={conventionalBulbsCount}
                        onChange={(e) =>
                          setConventionalBulbsCount(Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-full rounded bg-[#0F1623] border border-slate-700 px-2 py-1 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Old W</label>
                      <input
                        type="number"
                        min="10"
                        max="150"
                        value={conventionalBulbWatts}
                        onChange={(e) =>
                          setConventionalBulbWatts(Math.max(10, Number(e.target.value) || 10))
                        }
                        className="w-full rounded bg-[#0F1623] border border-slate-700 px-2 py-1 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Hrs/day</label>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        value={bulbHoursPerDay}
                        onChange={(e) =>
                          setBulbHoursPerDay(Math.min(24, Math.max(0, Number(e.target.value) || 0)))
                        }
                        className="w-full rounded bg-[#0F1623] border border-slate-700 px-2 py-1 font-mono text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-[#090E17] border border-slate-800 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white">
                      Standby &amp; UPS Idle Cut
                    </span>
                    <span className="font-mono text-lime-300 tabular-nums">
                      -{formatNumber(standbySavedKwh, 1)} kWh/mo
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Constant standby watts eliminated:</span>
                      <span className="font-mono text-cyan-300">
                        {standbyReductionWatts} W
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="80"
                      step="5"
                      value={standbyReductionWatts}
                      onChange={(e) =>
                        setStandbyReductionWatts(Number(e.target.value))
                      }
                      className="w-full"
                      aria-label="Standby watts eliminated"
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto pr-1 space-y-2">
                {appliances.slice(0, 4).map((item) => {
                  const testHours =
                    scenarioBTrimHours[item.id] !== undefined
                      ? scenarioBTrimHours[item.id]
                      : item.hoursPerDay;
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg bg-[#090E17] border border-slate-800 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {item.hoursPerDay}h/day → {testHours}h/day
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="0.25"
                        value={testHours}
                        onChange={(e) =>
                          setScenarioBTrimHours((prev) => ({
                            ...prev,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        className="sm:w-40"
                        aria-label={`Adjust daily hours for ${item.name}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    Total Units Saved
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-lime-300 tabular-nums">
                    {formatNumber(scenarioBTotalSavedKwh, 1)} kWh/mo
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    Est. Monetary Saving
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-lime-300 tabular-nums">
                    {formatPkr(scenarioBSavedPkr)}/mo
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    New Simulated Total
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                    {formatNumber(scenarioBNewKwh, 1)} kWh
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeScenario === "scenario-c" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Scale className="h-4 w-4 text-cyan-300" />
                  Scenario C: Current Setup vs. Energy-Efficient Household
                </div>
                <button
                  type="button"
                  onClick={() => setHouseholdB(EFFICIENT_HOUSEHOLD_APPLIANCES)}
                  className="text-xs text-cyan-300 hover:text-cyan-200"
                >
                  Reset Efficient Benchmark
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Household B models realistic upgrades for Pakistani homes: 35W BLDC inverter ceiling fans instead of 75W AC fans, AC at 26°C with 1.5h less runtime, float-switched water pump, and lower standby draw.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    Household A (Yours)
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-white tabular-nums">
                    {formatNumber(totalKwh, 0)} kWh · {formatPkr(estimatedBillPkr)}
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    Household B (Efficient)
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-lime-300 tabular-nums">
                    {formatNumber(householdBKwh, 0)} kWh · {formatPkr(householdBCost)}
                  </div>
                </div>
                <div className="rounded-lg bg-[#0B111C] border border-slate-800 p-3.5">
                  <div className="text-[11px] text-slate-400">
                    Estimated Difference
                  </div>
                  <div className="mt-1 font-mono text-base font-semibold text-cyan-300 tabular-nums">
                    {formatNumber(totalKwh - householdBKwh, 0)} kWh ·{" "}
                    {formatPkr(estimatedBillPkr - householdBCost)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Before & After Comparison Chart */}
          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  tick={{ fill: "#CBD5E1", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748B"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit=" kWh"
                  width={62}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748B"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
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
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  yAxisId="left"
                  dataKey="kWh"
                  name="Monthly Units (kWh)"
                  fill="#22D3EE"
                  radius={[4, 4, 0, 0]}
                  barSize={42}
                />
                <Bar
                  yAxisId="right"
                  dataKey="PKR"
                  name="Estimated Cost (PKR)"
                  fill="#A3E635"
                  radius={[4, 4, 0, 0]}
                  barSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Add Appliance Bar + Editable Appliance Table */}
      <section className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Household Appliance Inventory
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Edit quantity, wattage, daily hours, or monthly days. All estimates update instantaneously.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedCatalogCategory}
              onChange={(e) =>
                setSelectedCatalogCategory(e.target.value as ApplianceCategory)
              }
              aria-label="Choose appliance category to add"
              className="rounded-lg bg-[#090E17] border border-slate-700 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              {APPLIANCE_CATALOG.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category} ({cat.defaultWattage}W)
                </option>
              ))}
            </select>

            {selectedCatalogCategory === "Other" && (
              <input
                type="text"
                placeholder="Appliance name..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-40 rounded-lg bg-[#090E17] border border-slate-700 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            )}

            <button
              type="button"
              onClick={handleAddAppliance}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Appliance
            </button>
          </div>
        </div>

        {appliances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 pr-3">Appliance</th>
                  <th className="py-2.5 px-2 text-right">Qty</th>
                  <th className="py-2.5 px-2 text-right">Wattage (W)</th>
                  <th className="py-2.5 px-2 text-right">Hours / Day</th>
                  <th className="py-2.5 px-2 text-right">Days / Month</th>
                  <th className="py-2.5 px-2 text-right">Monthly kWh</th>
                  <th className="py-2.5 px-2 text-right">Est. Cost</th>
                  <th className="py-2.5 pl-2 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {applianceRows.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          handleUpdateAppliance(item.id, "name", e.target.value)
                        }
                        aria-label="Appliance name"
                        className="w-full min-w-[180px] rounded bg-transparent hover:bg-[#090E17] focus:bg-[#090E17] border border-transparent focus:border-slate-700 px-2 py-1 text-sm text-white focus:outline-none"
                      />
                      <div className="px-2 text-[11px] text-slate-500">
                        {item.category}
                      </div>
                    </td>

                    <td className="py-2.5 px-2 text-right">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateAppliance(
                            item.id,
                            "quantity",
                            e.target.value
                          )
                        }
                        aria-label={`Quantity for ${item.name}`}
                        className="w-16 rounded bg-[#090E17] border border-slate-700/80 px-2 py-1 text-right font-mono text-xs text-white tabular-nums focus:border-cyan-400 focus:outline-none"
                      />
                    </td>

                    <td className="py-2.5 px-2 text-right">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={item.wattage}
                        onChange={(e) =>
                          handleUpdateAppliance(
                            item.id,
                            "wattage",
                            e.target.value
                          )
                        }
                        aria-label={`Wattage for ${item.name}`}
                        className="w-20 rounded bg-[#090E17] border border-slate-700/80 px-2 py-1 text-right font-mono text-xs text-white tabular-nums focus:border-cyan-400 focus:outline-none"
                      />
                    </td>

                    <td className="py-2.5 px-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.25"
                        value={item.hoursPerDay}
                        onChange={(e) =>
                          handleUpdateAppliance(
                            item.id,
                            "hoursPerDay",
                            e.target.value
                          )
                        }
                        aria-label={`Hours per day for ${item.name}`}
                        className="w-20 rounded bg-[#090E17] border border-slate-700/80 px-2 py-1 text-right font-mono text-xs text-white tabular-nums focus:border-cyan-400 focus:outline-none"
                      />
                    </td>

                    <td className="py-2.5 px-2 text-right">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={item.daysPerMonth}
                        onChange={(e) =>
                          handleUpdateAppliance(
                            item.id,
                            "daysPerMonth",
                            e.target.value
                          )
                        }
                        aria-label={`Days per month for ${item.name}`}
                        className="w-16 rounded bg-[#090E17] border border-slate-700/80 px-2 py-1 text-right font-mono text-xs text-white tabular-nums focus:border-cyan-400 focus:outline-none"
                      />
                    </td>

                    <td className="py-2.5 px-2 text-right font-mono text-xs font-semibold text-cyan-300 tabular-nums">
                      {formatNumber(item.monthlyKwh, 1)} kWh
                    </td>

                    <td className="py-2.5 px-2 text-right font-mono text-xs text-slate-200 tabular-nums">
                      {formatPkr(item.estimatedCost)}
                    </td>

                    <td className="py-2.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveAppliance(item.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center">
            <Zap className="h-6 w-6 text-slate-500 mx-auto" />
            <p className="mt-2 text-sm text-slate-300">
              Your simulator inventory is empty
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Use &ldquo;Add Appliance&rdquo; above or click &ldquo;Load Typical Household Preset&rdquo; to start simulating.
            </p>
          </div>
        )}
      </section>

      {/* Mandatory Estimate Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl bg-[#0D1420] border border-slate-800/80 px-5 py-4 text-xs text-slate-400">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="text-slate-200 font-medium">Simulation Disclaimer:</span>{" "}
          Estimated monthly savings and energy bills are informational estimates based on your selected rate assumption, not guaranteed bill reductions. Actual Pakistani electricity bills vary due to progressive tariff slabs, protected/unprotected consumer status, FPA, QTA, fixed charges, and taxes.
        </p>
      </div>
    </div>
  );
};
