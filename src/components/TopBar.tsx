import React from "react";
import { Menu } from "lucide-react";
import { BillRecord, NavSection } from "../types/bill";

interface TopBarProps {
  activeSection: NavSection;
  activeBill: BillRecord | null;
  isDemoMode: boolean;
  onOpenMobileMenu: () => void;
  onNavigateAnalyze: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: "Overview",
  analyze: "Analyze My Bill",
  difference: "Bill Difference Detector",
  breakdown: "Bill Breakdown",
  simulator: "Usage Simulator",
  compare: "Compare & Track",
  tips: "Energy Saving Tips",
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  activeBill,
  isDemoMode,
  onOpenMobileMenu,
  onNavigateAnalyze,
}) => {
  const billingLabel = activeBill
    ? `${activeBill.billingMonth} · ${activeBill.provider}`
    : "November 2026 · No active bill";

  const modeLabel = isDemoMode
    ? "Demo Household"
    : activeBill
    ? activeBill.source === "extracted"
      ? "Extracted Bill"
      : "Manual Entry"
    : "Ready";

  return (
    <header className="sticky top-0 z-30 bg-[#090E17]/92 backdrop-blur-md border-b border-slate-800/80">
      <div className="flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-8 h-16">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-400"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base sm:text-lg font-semibold text-white whitespace-nowrap shrink-0">
            Bill Check
          </span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium text-slate-300 truncate hidden sm:inline">
            {SECTION_TITLES[activeSection]}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2.5 text-xs text-slate-400 whitespace-nowrap shrink-0">
          <span className="text-slate-200 font-medium">{billingLabel}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              isDemoMode
                ? "text-amber-300 font-medium"
                : "text-cyan-300 font-medium"
            }
          >
            {modeLabel}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateAnalyze}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            Analyze a Bill
          </button>
        </div>
      </div>
    </header>
  );
};
