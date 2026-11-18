import React, { useMemo, useState } from "react";
import { Sliders, Info } from "lucide-react";
import { ApplianceItem, BillRecord, RateConfig } from "../types/bill";
import { ENERGY_SAVING_TIPS } from "../data/demoData";
import {
  calculateApplianceKwh,
  formatNumber,
  formatPkr,
  resolveEffectiveRate,
} from "../utils/calculations";

interface EnergyTipsSectionProps {
  appliances: ApplianceItem[];
  activeBill: BillRecord | null;
  rateConfig: RateConfig;
  onNavigateSimulator: () => void;
}

const TIP_CATEGORIES = [
  "All",
  "Air Conditioner",
  "Refrigerator",
  "Fans & Lighting",
  "Standby Power",
  "Maintenance",
  "Peak Hours",
] as const;

export const EnergyTipsSection: React.FC<EnergyTipsSectionProps> = ({
  appliances,
  activeBill,
  rateConfig,
  onNavigateSimulator,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const effectiveRate = useMemo(
    () => resolveEffectiveRate(rateConfig, activeBill),
    [rateConfig, activeBill]
  );

  // Rank user's top simulated appliances to power personalized guidance
  const topAppliances = useMemo(() => {
    return [...appliances]
      .map((item) => ({
        ...item,
        monthlyKwh: calculateApplianceKwh(item),
      }))
      .sort((a, b) => b.monthlyKwh - a.monthlyKwh)
      .slice(0, 3);
  }, [appliances]);

  const personalizedTips = useMemo(() => {
    const topCats = new Set(topAppliances.map((a) => a.category));
    return ENERGY_SAVING_TIPS.filter((tip) =>
      tip.matchedApplianceCategories.some((cat) => topCats.has(cat))
    );
  }, [topAppliances]);

  const filteredTips = useMemo(() => {
    if (selectedCategory === "All") return ENERGY_SAVING_TIPS;
    return ENERGY_SAVING_TIPS.filter((t) => t.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">
            Energy Saving Tips for Pakistani Homes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Practical habits tailored to local appliances, summer cooling, UPS standby losses, and peak-hour awareness.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateSimulator}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/25 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          <Sliders className="h-3.5 w-3.5" />
          Test in Usage Simulator
        </button>
      </div>

      {/* Personalized Section Based on Simulator Top Consumers */}
      <section className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Personalized Priority Actions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Matched to your highest-consuming appliances in the Usage Simulator
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            Illustrative value basis: PKR {effectiveRate.rate.toFixed(2)}/kWh
          </span>
        </div>

        {topAppliances.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topAppliances.map((app, index) => (
                <div
                  key={app.id}
                  className="rounded-lg bg-[#090E17] border border-slate-800 p-4"
                >
                  <div className="text-[11px] font-mono text-cyan-300">
                    #{index + 1} Consumer · {app.category}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">
                    {app.name}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-400 tabular-nums">
                    {formatNumber(app.monthlyKwh, 1)} kWh/mo ·{" "}
                    {formatPkr(app.monthlyKwh * effectiveRate.rate)} est.
                  </div>
                </div>
              ))}
            </div>

            {personalizedTips.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {personalizedTips.slice(0, 4).map((tip) => {
                  const estPkr =
                    tip.estimatedKwhSavedPerMonth * effectiveRate.rate;
                  return (
                    <div
                      key={tip.id}
                      className="rounded-lg bg-[#0B111C] border border-slate-800/90 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-lime-300">
                          {tip.category}
                        </span>
                        <span className="font-mono text-xs text-slate-300 tabular-nums">
                          ~{tip.estimatedKwhSavedPerMonth} kWh/mo ({formatPkr(estPkr)}*)
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white">
                        {tip.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {tip.action}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        <span className="text-slate-300 font-medium">
                          Assumption:
                        </span>{" "}
                        {tip.assumption}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400">
            Add appliances in the Usage Simulator to unlock personalized recommendations ranked by your actual household load.
          </p>
        )}
      </section>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TIP_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? "bg-cyan-400 text-slate-950 font-semibold"
                : "bg-[#0F1623] text-slate-300 border border-slate-800 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Practical Tips Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredTips.map((tip) => {
          const estPkr = tip.estimatedKwhSavedPerMonth * effectiveRate.rate;
          return (
            <article
              key={tip.id}
              className="rounded-xl bg-[#0F1623] border border-slate-800/90 p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-cyan-300">
                    {tip.category}
                  </span>
                  <span className="font-mono text-lime-300 tabular-nums">
                    Est. ~{tip.estimatedKwhSavedPerMonth} kWh/mo ·{" "}
                    {formatPkr(estPkr)}*
                  </span>
                </div>

                <h3 className="font-display text-base font-semibold text-white">
                  {tip.title}
                </h3>

                <div className="space-y-2 text-xs leading-relaxed">
                  <p className="text-slate-200">
                    <span className="font-semibold text-white">
                      The action:{" "}
                    </span>
                    {tip.action}
                  </p>
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-300">
                      Why it matters:{" "}
                    </span>
                    {tip.whyItMatters}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">
                  *Stated assumption:
                </span>{" "}
                {tip.assumption} Not a guaranteed bill reduction.
              </div>
            </article>
          );
        })}
      </section>

      <div className="flex items-start gap-3 rounded-xl bg-[#0D1420] border border-slate-800/80 px-5 py-4 text-xs text-slate-400">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <span className="text-slate-200 font-medium">Note on Potential Savings:</span>{" "}
          Estimated PKR figures above multiply each stated kWh assumption by your selected rate basis ({effectiveRate.label}). Actual savings depend on ambient weather, appliance age, and your DISCO&apos;s progressive slab structure.
        </p>
      </div>
    </div>
  );
};
