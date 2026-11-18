import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ApplianceItem,
  BillBreakdown,
  BillRecord,
  MonthlyEntry,
  NavSection,
  RateConfig,
} from "./types/bill";
import {
  DEMO_APPLIANCES,
  DEMO_BILL,
  DEMO_HISTORY,
  DEMO_PREVIOUS_BILL,
} from "./data/demoData";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { OverviewSection } from "./components/OverviewSection";
import { AnalyzeBillSection } from "./components/AnalyzeBillSection";
import { BillDifferenceSection } from "./components/BillDifferenceSection";
import { BillBreakdownSection } from "./components/BillBreakdownSection";
import { UsageSimulatorSection } from "./components/UsageSimulatorSection";
import { CompareTrackSection } from "./components/CompareTrackSection";
import { EnergyTipsSection } from "./components/EnergyTipsSection";

const STORAGE_KEYS = {
  activeBill: "billcheck_active_bill_v1",
  previousDiffBill: "billcheck_diff_prev_v1",
  currentDiffBill: "billcheck_diff_curr_v1",
  history: "billcheck_history_v1",
  appliances: "billcheck_appliances_v1",
  rateConfig: "billcheck_rate_config_v1",
  demoMode: "billcheck_demo_mode_v1",
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isDemoMode, setIsDemoMode] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_KEYS.demoMode, false)
  );
  const [activeBill, setActiveBill] = useState<BillRecord | null>(() =>
    readStorage<BillRecord | null>(STORAGE_KEYS.activeBill, null)
  );
  const [diffPreviousBill, setDiffPreviousBill] = useState<BillRecord | null>(() =>
    readStorage<BillRecord | null>(STORAGE_KEYS.previousDiffBill, null)
  );
  const [diffCurrentBill, setDiffCurrentBill] = useState<BillRecord | null>(() =>
    readStorage<BillRecord | null>(STORAGE_KEYS.currentDiffBill, null)
  );
  const [history, setHistory] = useState<MonthlyEntry[]>(() =>
    readStorage<MonthlyEntry[]>(STORAGE_KEYS.history, [])
  );
  const [appliances, setAppliances] = useState<ApplianceItem[]>(() =>
    readStorage<ApplianceItem[]>(STORAGE_KEYS.appliances, [])
  );
  const [rateConfig, setRateConfig] = useState<RateConfig>(() =>
    readStorage<RateConfig>(STORAGE_KEYS.rateConfig, {
      mode: "illustrative",
      customRate: 52,
      illustrativeRate: 48,
    })
  );

  // Persist state to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.demoMode,
        JSON.stringify(isDemoMode)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.activeBill,
        JSON.stringify(activeBill)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.previousDiffBill,
        JSON.stringify(diffPreviousBill)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.currentDiffBill,
        JSON.stringify(diffCurrentBill)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.history,
        JSON.stringify(history)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.appliances,
        JSON.stringify(appliances)
      );
      window.localStorage.setItem(
        STORAGE_KEYS.rateConfig,
        JSON.stringify(rateConfig)
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [
    isDemoMode,
    activeBill,
    diffPreviousBill,
    diffCurrentBill,
    history,
    appliances,
    rateConfig,
  ]);

  const handleExploreDemo = () => {
    setIsDemoMode(true);
    setActiveBill(DEMO_BILL);
    setDiffPreviousBill(DEMO_PREVIOUS_BILL);
    setDiffCurrentBill(DEMO_BILL);
    setHistory((prev) => {
      const userEntries = prev.filter((item) => !item.isDemo);
      return [...DEMO_HISTORY, ...userEntries];
    });
    setAppliances(DEMO_APPLIANCES);
    setRateConfig((prev) => ({
      ...prev,
      mode: "bill-average",
    }));
  };

  const handleClearDemo = () => {
    setIsDemoMode(false);
    setActiveBill((prev) => (prev?.source === "demo" ? null : prev));
    setDiffPreviousBill((prev) => (prev?.source === "demo" ? null : prev));
    setDiffCurrentBill((prev) => (prev?.source === "demo" ? null : prev));
    setHistory((prev) => prev.filter((item) => !item.isDemo));
    setAppliances([]);
    setRateConfig((prev) => ({
      ...prev,
      mode: "illustrative",
    }));
  };

  const handleApplyAnalyzedBill = (bill: BillRecord, addToHistory: boolean) => {
    setIsDemoMode(false);
    setActiveBill(bill);
    setDiffCurrentBill(bill);
    setRateConfig((prev) => ({
      ...prev,
      mode: "bill-average",
    }));
    if (addToHistory) {
      setHistory((prev) => {
        const cleaned = prev.filter((item) => !item.isDemo);
        const newEntry: MonthlyEntry = {
          id: `hist-${bill.id}`,
          month: bill.billingMonth,
          provider: bill.provider,
          unitsConsumed: bill.unitsConsumed,
          billAmount: bill.totalBillAmount,
          notes:
            bill.source === "extracted"
              ? "Extracted from uploaded bill"
              : "Manual bill analysis",
          isDemo: false,
        };
        return [...cleaned, newEntry];
      });
    }
  };

  const handleUpdateBreakdown = (breakdown: BillBreakdown) => {
    if (!activeBill) return;
    const updated = { ...activeBill, breakdown };
    setActiveBill(updated);
    if (diffCurrentBill?.id === activeBill.id) {
      setDiffCurrentBill(updated);
    }
  };

  const handleAddHistoryEntry = (entry: MonthlyEntry) => {
    setHistory((prev) => [...prev, entry]);
  };

  const handleDeleteHistoryEntry = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllUserEntries = () => {
    setHistory((prev) => prev.filter((item) => Boolean(item.isDemo)));
  };

  return (
    <div className="min-h-screen flex bg-[#090E17] text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isDemoMode={isDemoMode}
        onExploreDemo={handleExploreDemo}
        onClearDemo={handleClearDemo}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          activeBill={activeBill}
          isDemoMode={isDemoMode}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateAnalyze={() => setActiveSection("analyze")}
        />

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeSection === "overview" && (
                <OverviewSection
                  activeBill={activeBill}
                  history={history}
                  isDemoMode={isDemoMode}
                  onExploreDemo={handleExploreDemo}
                  onNavigate={setActiveSection}
                />
              )}

              {activeSection === "analyze" && (
                <AnalyzeBillSection
                  activeBill={activeBill}
                  previousBillForContext={diffPreviousBill}
                  isDemoMode={isDemoMode}
                  onApplyAnalyzedBill={handleApplyAnalyzedBill}
                  onNavigateBreakdown={() => setActiveSection("breakdown")}
                  onNavigateDifference={() => setActiveSection("difference")}
                />
              )}

              {activeSection === "difference" && (
                <BillDifferenceSection
                  previousBill={diffPreviousBill}
                  currentBill={diffCurrentBill}
                  isDemoMode={isDemoMode}
                  onSetPreviousBill={setDiffPreviousBill}
                  onSetCurrentBill={setDiffCurrentBill}
                />
              )}

              {activeSection === "breakdown" && (
                <BillBreakdownSection
                  activeBill={activeBill}
                  isDemoMode={isDemoMode}
                  onUpdateBreakdown={handleUpdateBreakdown}
                  onNavigateAnalyze={() => setActiveSection("analyze")}
                />
              )}

              {activeSection === "simulator" && (
                <UsageSimulatorSection
                  appliances={appliances}
                  onChangeAppliances={setAppliances}
                  rateConfig={rateConfig}
                  onChangeRateConfig={setRateConfig}
                  activeBill={activeBill}
                />
              )}

              {activeSection === "compare" && (
                <CompareTrackSection
                  history={history}
                  isDemoMode={isDemoMode}
                  onAddEntry={handleAddHistoryEntry}
                  onDeleteEntry={handleDeleteHistoryEntry}
                  onClearAllUserEntries={handleClearAllUserEntries}
                  onExploreDemo={handleExploreDemo}
                />
              )}

              {activeSection === "tips" && (
                <EnergyTipsSection
                  appliances={appliances}
                  activeBill={activeBill}
                  rateConfig={rateConfig}
                  onNavigateSimulator={() => setActiveSection("simulator")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="border-t border-slate-800/70 px-4 sm:px-8 py-4 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span>
              Bill Check · Understand your bill. Take control of your energy.
            </span>
            <span>
              Calculations &amp; simulations are informational estimates and not official DISCO invoices.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
