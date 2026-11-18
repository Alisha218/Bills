import {
  ApplianceCategory,
  ApplianceItem,
  BillRecord,
  EnergyTip,
  MonthlyEntry,
  ProviderName,
} from "../types/bill";

export const PROVIDERS: ProviderName[] = [
  "K-Electric",
  "LESCO",
  "IESCO",
  "FESCO",
  "MEPCO",
  "HESCO",
  "GEPCO",
  "QESCO",
  "Other",
];

export const APPLIANCE_CATALOG: Array<{
  category: ApplianceCategory;
  defaultName: string;
  defaultWattage: number;
  defaultHours: number;
  defaultDays: number;
  typicalNote: string;
}> = [
  {
    category: "Air Conditioner",
    defaultName: "1.5 Ton Inverter AC",
    defaultWattage: 1200,
    defaultHours: 5,
    defaultDays: 25,
    typicalNote: "1.5T inverter averages 1,100–1,400W; non-inverter ~1,800W",
  },
  {
    category: "Refrigerator",
    defaultName: "Refrigerator (Inverter)",
    defaultWattage: 180,
    defaultHours: 14,
    defaultDays: 30,
    typicalNote: "Compressor cycles ~12–16 hrs effective run time daily",
  },
  {
    category: "Fans",
    defaultName: "Ceiling Fans (Standard)",
    defaultWattage: 75,
    defaultHours: 10,
    defaultDays: 30,
    typicalNote: "Standard AC fan ~75W; BLDC inverter fan ~32–35W",
  },
  {
    category: "Lights",
    defaultName: "LED Bulbs (12W)",
    defaultWattage: 12,
    defaultHours: 6,
    defaultDays: 30,
    typicalNote: "LED bulbs typically draw 9W–18W each",
  },
  {
    category: "Water Pump",
    defaultName: "Water Motor (1 HP)",
    defaultWattage: 750,
    defaultHours: 0.75,
    defaultDays: 30,
    typicalNote: "0.5–1 HP domestic water pump (~375W–750W)",
  },
  {
    category: "Iron",
    defaultName: "Electric Iron",
    defaultWattage: 1200,
    defaultHours: 0.4,
    defaultDays: 24,
    typicalNote: "High wattage heating element (1,000W–1,400W)",
  },
  {
    category: "Washing Machine",
    defaultName: "Washing Machine",
    defaultWattage: 500,
    defaultHours: 1.5,
    defaultDays: 12,
    typicalNote: "Spinner/washer cycle runs ~350W–550W",
  },
  {
    category: "Television",
    defaultName: "LED Television",
    defaultWattage: 90,
    defaultHours: 4,
    defaultDays: 30,
    typicalNote: "43–55 inch LED TV draws 75W–120W",
  },
  {
    category: "Microwave",
    defaultName: "Microwave Oven",
    defaultWattage: 1100,
    defaultHours: 0.25,
    defaultDays: 30,
    typicalNote: "Short daily bursts (10–20 mins/day)",
  },
  {
    category: "Other",
    defaultName: "Wi-Fi Router & Chargers",
    defaultWattage: 35,
    defaultHours: 24,
    defaultDays: 30,
    typicalNote: "Always-on electronics, UPS idle draw, or dispensers",
  },
];

export const DEMO_PREVIOUS_BILL: BillRecord = {
  id: "demo-lesco-sep-2026",
  provider: "LESCO",
  consumerNumber: "14-11223-0849102-R",
  meterNumber: "LES-849201",
  billingMonth: "September 2026",
  issueDate: "05 Oct 2026",
  dueDate: "19 Oct 2026",
  unitsConsumed: 485,
  totalBillAmount: 28450,
  amountAfterDueDate: 30720,
  perUnitRate: 40.43,
  connectedLoad: "2 kW",
  previousBillAmount: 30850,
  previousUnitsConsumed: 512,
  previousMeterReading: 23697,
  currentMeterReading: 24182,
  meterPhase: "Single-Phase Residential (A-1a)",
  source: "demo",
  breakdown: {
    electricityCharges: 19610,
    fuelPriceAdjustment: 1640,
    taxes: 5625,
    duties: 295,
    fixedCharges: 400,
    otherAdjustments: 880,
  },
  createdAt: "2026-10-05T10:00:00.000Z",
  extractionNotes:
    "Sample Pakistani household bill (September 2026 LESCO) created for comparison.",
};

export const DEMO_BILL: BillRecord = {
  id: "demo-lesco-oct-2026",
  provider: "LESCO",
  consumerNumber: "14-11223-0849102-R",
  meterNumber: "LES-849201",
  billingMonth: "October 2026",
  issueDate: "04 Nov 2026",
  dueDate: "18 Nov 2026",
  unitsConsumed: 418,
  totalBillAmount: 23840,
  amountAfterDueDate: 25740,
  perUnitRate: 39.0,
  connectedLoad: "2 kW",
  previousBillAmount: 28450,
  previousUnitsConsumed: 485,
  previousMeterReading: 24182,
  currentMeterReading: 24600,
  meterPhase: "Single-Phase Residential (A-1a)",
  source: "demo",
  breakdown: {
    electricityCharges: 16302,
    fuelPriceAdjustment: 1180,
    taxes: 4793,
    duties: 245,
    fixedCharges: 400,
    otherAdjustments: 920,
  },
  createdAt: "2026-11-04T10:00:00.000Z",
  extractionNotes:
    "Sample Pakistani household bill (October 2026 LESCO residential) created for exploration. Not an actual utility invoice.",
};

export const DEMO_HISTORY: MonthlyEntry[] = [
  {
    id: "demo-m-1",
    month: "May 2026",
    provider: "LESCO",
    unitsConsumed: 392,
    billAmount: 21650,
    notes: "Early summer fan & AC startup",
    isDemo: true,
  },
  {
    id: "demo-m-2",
    month: "June 2026",
    provider: "LESCO",
    unitsConsumed: 465,
    billAmount: 26900,
    notes: "Peak heatwave cooling hours",
    isDemo: true,
  },
  {
    id: "demo-m-3",
    month: "July 2026",
    provider: "LESCO",
    unitsConsumed: 530,
    billAmount: 32100,
    notes: "Highest monsoon humidity & AC load",
    isDemo: true,
  },
  {
    id: "demo-m-4",
    month: "August 2026",
    provider: "LESCO",
    unitsConsumed: 512,
    billAmount: 30850,
    notes: "Sustained summer AC usage",
    isDemo: true,
  },
  {
    id: "demo-m-5",
    month: "September 2026",
    provider: "LESCO",
    unitsConsumed: 485,
    billAmount: 28450,
    notes: "Mild cooling drop late month",
    isDemo: true,
  },
  {
    id: "demo-m-6",
    month: "October 2026",
    provider: "LESCO",
    unitsConsumed: 418,
    billAmount: 23840,
    notes: "Post-summer reduction in AC hours",
    isDemo: true,
  },
];

export const DEMO_APPLIANCES: ApplianceItem[] = [
  {
    id: "app-ac-1",
    name: "1.5 Ton Inverter AC (Bedroom)",
    category: "Air Conditioner",
    quantity: 1,
    wattage: 1200,
    hoursPerDay: 5,
    daysPerMonth: 25,
  },
  {
    id: "app-fridge-1",
    name: "Refrigerator (Inverter)",
    category: "Refrigerator",
    quantity: 1,
    wattage: 180,
    hoursPerDay: 14,
    daysPerMonth: 30,
  },
  {
    id: "app-fans-1",
    name: "Ceiling Fans (Standard 75W)",
    category: "Fans",
    quantity: 4,
    wattage: 75,
    hoursPerDay: 10,
    daysPerMonth: 30,
  },
  {
    id: "app-lights-1",
    name: "LED Lights (12W)",
    category: "Lights",
    quantity: 8,
    wattage: 12,
    hoursPerDay: 6,
    daysPerMonth: 30,
  },
  {
    id: "app-pump-1",
    name: "Water Pump (1 HP)",
    category: "Water Pump",
    quantity: 1,
    wattage: 750,
    hoursPerDay: 0.75,
    daysPerMonth: 30,
  },
  {
    id: "app-iron-1",
    name: "Electric Iron",
    category: "Iron",
    quantity: 1,
    wattage: 1200,
    hoursPerDay: 0.4,
    daysPerMonth: 24,
  },
  {
    id: "app-tv-1",
    name: "LED Television",
    category: "Television",
    quantity: 1,
    wattage: 90,
    hoursPerDay: 4,
    daysPerMonth: 30,
  },
  {
    id: "app-wash-1",
    name: "Washing Machine",
    category: "Washing Machine",
    quantity: 1,
    wattage: 500,
    hoursPerDay: 1.5,
    daysPerMonth: 12,
  },
  {
    id: "app-micro-1",
    name: "Microwave Oven",
    category: "Microwave",
    quantity: 1,
    wattage: 1100,
    hoursPerDay: 0.25,
    daysPerMonth: 30,
  },
  {
    id: "app-other-1",
    name: "Router, Chargers & UPS Standby",
    category: "Other",
    quantity: 1,
    wattage: 35,
    hoursPerDay: 24,
    daysPerMonth: 30,
  },
];

export const EFFICIENT_HOUSEHOLD_APPLIANCES: ApplianceItem[] = [
  {
    id: "eff-ac-1",
    name: "1.5 Ton Inverter AC (26°C + Timer)",
    category: "Air Conditioner",
    quantity: 1,
    wattage: 950,
    hoursPerDay: 3.5,
    daysPerMonth: 25,
  },
  {
    id: "eff-fridge-1",
    name: "Refrigerator (Cleaned Coils & Good Seal)",
    category: "Refrigerator",
    quantity: 1,
    wattage: 155,
    hoursPerDay: 12,
    daysPerMonth: 30,
  },
  {
    id: "eff-fans-1",
    name: "BLDC Inverter Ceiling Fans (35W)",
    category: "Fans",
    quantity: 4,
    wattage: 35,
    hoursPerDay: 9,
    daysPerMonth: 30,
  },
  {
    id: "eff-lights-1",
    name: "LED Lights (Task Lighting Only)",
    category: "Lights",
    quantity: 6,
    wattage: 10,
    hoursPerDay: 5,
    daysPerMonth: 30,
  },
  {
    id: "eff-pump-1",
    name: "Water Pump (Float Switch Controlled)",
    category: "Water Pump",
    quantity: 1,
    wattage: 750,
    hoursPerDay: 0.5,
    daysPerMonth: 30,
  },
  {
    id: "eff-iron-1",
    name: "Electric Iron (Batch Ironing)",
    category: "Iron",
    quantity: 1,
    wattage: 1200,
    hoursPerDay: 0.3,
    daysPerMonth: 16,
  },
  {
    id: "eff-tv-1",
    name: "LED Television (Power Strip Off)",
    category: "Television",
    quantity: 1,
    wattage: 85,
    hoursPerDay: 3,
    daysPerMonth: 30,
  },
  {
    id: "eff-wash-1",
    name: "Washing Machine (Full Loads Only)",
    category: "Washing Machine",
    quantity: 1,
    wattage: 500,
    hoursPerDay: 1.25,
    daysPerMonth: 10,
  },
  {
    id: "eff-micro-1",
    name: "Microwave Oven",
    category: "Microwave",
    quantity: 1,
    wattage: 1100,
    hoursPerDay: 0.2,
    daysPerMonth: 30,
  },
  {
    id: "eff-other-1",
    name: "Router & Chargers (Standby Trimmed)",
    category: "Other",
    quantity: 1,
    wattage: 18,
    hoursPerDay: 24,
    daysPerMonth: 30,
  },
];

export const PAKISTANI_BILL_CATEGORY_HELP: Record<
  string,
  { title: string; explanation: string }
> = {
  electricityCharges: {
    title: "Electricity Charges (Cost of Electricity)",
    explanation:
      "The base cost of the units (kWh) you consumed during the billing cycle, calculated according to your DISCO slab structure or Time-of-Use tariff.",
  },
  fuelPriceAdjustment: {
    title: "Fuel Price Adjustment (FPA)",
    explanation:
      "A variable monthly adjustment approved by NEPRA to account for changes in international fuel and generation costs (usually billed 1–2 months in arrears based on prior consumption).",
  },
  taxes: {
    title: "Taxes (GST, Income Tax, PTV Fee & Surcharges)",
    explanation:
      "Government levies collected through your utility bill, which typically include General Sales Tax (GST), Further Tax/Extra Tax (if applicable), PTV Fee, Neelum-Jhelum / FC Surcharge, and withholding income tax above certain thresholds.",
  },
  duties: {
    title: "Electricity Duty",
    explanation:
      "A provincial levy charged as a small percentage of the base electricity cost, collected by the distribution company on behalf of the provincial government.",
  },
  fixedCharges: {
    title: "Fixed Charges",
    explanation:
      "A standing monthly fee tied to your meter connection type or sanctioned load, charged regardless of how many units you consume.",
  },
  otherAdjustments: {
    title: "Other Adjustments (QTA / Arrears / Rebates)",
    explanation:
      "Includes Quarterly Tariff Adjustments (QTA), meter rent, late payment surcharges, or prior-month billing corrections where applicable.",
  },
};

export const ENERGY_SAVING_TIPS: EnergyTip[] = [
  {
    id: "tip-ac-26",
    category: "Air Conditioner",
    title: "Set AC to 26°C and pair with a ceiling fan",
    action:
      "Raise your air conditioner thermostat from 21–22°C to 26°C and keep a ceiling fan on medium speed to circulate cool air evenly.",
    whyItMatters:
      "Inverter compressors slow down significantly once the room reaches 26°C instead of running at full wattage all night. Pairing with a fan gives the same perceived comfort.",
    assumption:
      "Assumes reducing average 1.5 Ton AC draw or runtime by ~1.25 kWh/day over 25 summer days.",
    estimatedKwhSavedPerMonth: 31,
    matchedApplianceCategories: ["Air Conditioner"],
  },
  {
    id: "tip-ac-filters",
    category: "Maintenance",
    title: "Wash indoor AC mesh filters every 2 weeks",
    action:
      "Slide out the indoor unit dust filters, rinse with plain water, dry completely, and reinsert every 14 days during heavy summer use.",
    whyItMatters:
      "Clogged filters restrict airflow across the cooling coil, forcing the compressor to run longer to reach the same room temperature.",
    assumption:
      "Assumes a 5%–8% efficiency recovery on ~150 kWh/month AC usage.",
    estimatedKwhSavedPerMonth: 10,
    matchedApplianceCategories: ["Air Conditioner"],
  },
  {
    id: "tip-bldc-fans",
    category: "Fans & Lighting",
    title: "Replace high-draw AC ceiling fans with 35W BLDC inverter fans",
    action:
      "Swap older 75W–90W capacitor ceiling fans in the bedrooms used 10+ hours/day for 30W–35W BLDC inverter fans.",
    whyItMatters:
      "In Pakistani homes, ceiling fans run almost nonstop for 7–8 months a year. Cutting 40W per fan across 3–4 rooms yields steady baseline savings every single day.",
    assumption:
      "Assumes replacing 2 older 75W fans with 35W BLDC fans running 10 hrs/day for 30 days (40W × 2 × 10 × 30 / 1000).",
    estimatedKwhSavedPerMonth: 24,
    matchedApplianceCategories: ["Fans"],
  },
  {
    id: "tip-fridge-seal",
    category: "Refrigerator",
    title: "Check fridge door gasket & keep 4-inch rear clearance",
    action:
      "Test the door rubber seal with a sheet of paper, dust off rear condenser coils twice a year, and keep the fridge away from direct stove heat or sunlight.",
    whyItMatters:
      "Warm ambient air or leaky seals make the refrigerator compressor cycle far more often during hot Pakistani afternoons.",
    assumption:
      "Assumes trimming ~2 hours of unnecessary compressor run time per day on a 180W fridge over 30 days.",
    estimatedKwhSavedPerMonth: 11,
    matchedApplianceCategories: ["Refrigerator"],
  },
  {
    id: "tip-iron-batch",
    category: "Peak Hours",
    title: "Batch ironing & water pumping outside evening peak hours",
    action:
      "Iron a week's clothes in one or two sessions instead of heating the iron daily, and run your water motor in the morning rather than 6 PM–10 PM.",
    whyItMatters:
      "Heating an electric iron from cold wastes energy each time. For 3-phase Time-of-Use (TOU) meters, shifting heavy loads out of evening peak hours also avoids higher peak unit rates.",
    assumption:
      "Assumes cutting 10 cold warm-up cycles/month (~15 mins total) on a 1,200W iron and eliminating 10 mins/day of unnecessary pump overflow.",
    estimatedKwhSavedPerMonth: 7,
    matchedApplianceCategories: ["Iron", "Water Pump", "Washing Machine"],
  },
  {
    id: "tip-standby-ups",
    category: "Standby Power",
    title: "Eliminate phantom standby & audit UPS charging losses",
    action:
      "Turn off TVs, set-top boxes, microwaves, and idle chargers at the wall switch at night, and keep UPS batteries healthy so the charger isn't continuously float-charging a degraded battery.",
    whyItMatters:
      "Old UPS units with weak batteries and always-on entertainment strips can quietly consume 25–45W around the clock—adding 18–32 units a month without cooling or lighting anything.",
    assumption:
      "Assumes trimming 20W of continuous standby draw for 18 hrs/day over 30 days.",
    estimatedKwhSavedPerMonth: 11,
    matchedApplianceCategories: ["Other", "Television", "Microwave"],
  },
  {
    id: "tip-daylight-led",
    category: "Fans & Lighting",
    title: "Switch off daytime corridor/room lights & use task LEDs",
    action:
      "Use natural daylight in lounges and kitchens during daytime hours and replace any remaining CFLs or tube lights with 9W–12W LEDs.",
    whyItMatters:
      "Multiple decorative or corridor lights left on for hours add steady daytime load—and reduce cooling efficiency slightly by releasing heat.",
    assumption:
      "Assumes turning off 4 × 12W LED lights for 4 unnecessary hrs/day over 30 days.",
    estimatedKwhSavedPerMonth: 6,
    matchedApplianceCategories: ["Lights"],
  },
];
