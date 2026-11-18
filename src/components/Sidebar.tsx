import React from "react";
import {
  LayoutDashboard,
  FileSearch,
  GitCompare,
  PieChart,
  Sliders,
  BarChart3,
  Lightbulb,
  Zap,
  X,
  RotateCcw,
} from "lucide-react";
import { NavSection } from "../types/bill";

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isDemoMode: boolean;
  onExploreDemo: () => void;
  onClearDemo: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analyze", label: "Analyze My Bill", icon: FileSearch },
  { id: "difference", label: "Bill Difference Detector", icon: GitCompare },
  { id: "breakdown", label: "Bill Breakdown", icon: PieChart },
  { id: "simulator", label: "Usage Simulator", icon: Sliders },
  { id: "compare", label: "Compare & Track", icon: BarChart3 },
  { id: "tips", label: "Energy Saving Tips", icon: Lightbulb },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  isDemoMode,
  onExploreDemo,
  onClearDemo,
  mobileOpen,
  onCloseMobile,
}) => {
  const content = (
    <div className="flex h-full flex-col justify-between bg-[#0B111C] border-r border-slate-800/80 px-4 py-6">
      <div>
        <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold tracking-tight text-white truncate">
                Bill Check
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Understand your bill
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg focus-visible:outline-2 focus-visible:outline-cyan-400"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-6 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  active
                    ? "bg-cyan-500/12 text-cyan-300 border border-cyan-500/25"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-cyan-300" : "text-slate-500"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        <div className="px-2">
          <div className="text-xs font-medium text-slate-300">
            {isDemoMode ? "Demo Household Active" : "Sample Data Available"}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {isDemoMode
              ? "Showing sample LESCO bills. All demo figures are clearly labeled."
              : "Load realistic Pakistani sample bills to explore all features."}
          </p>
        </div>
        {isDemoMode ? (
          <button
            type="button"
            onClick={() => {
              onClearDemo();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Exit Demo Mode
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onExploreDemo();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Explore Demo
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{content}</div>
        </div>
      )}
    </>
  );
};
