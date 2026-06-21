/**
 * carbon.ts — CO₂ Calculation Utilities
 *
 * All emission factors are sourced from:
 *  - IPCC (2021) Sixth Assessment Report
 *  - UK DESNZ Conversion Factors 2023
 *  - EPA eGRID 2023 (electricity)
 *
 * Calculations return CO₂-equivalent (CO₂e) in kilograms.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityType = 'transit' | 'food' | 'energy';

export type TransitMode =
  | 'car'
  | 'motorcycle'
  | 'bus'
  | 'train'
  | 'subway'
  | 'flight_domestic'
  | 'flight_international'
  | 'bicycle'
  | 'walking';

export type FoodItem =
  | 'beef'
  | 'lamb'
  | 'pork'
  | 'chicken'
  | 'fish'
  | 'dairy'
  | 'eggs'
  | 'vegetables'
  | 'rice'
  | 'bread';

export type EnergySource = 'grid_electricity' | 'natural_gas' | 'lpg' | 'coal';

export type Unit = 'km' | 'grams' | 'kwh' | 'litres' | 'kg';

export interface ActivityLabel {
  activityType: ActivityType;
  label: TransitMode | FoodItem | EnergySource;
}

export interface Co2Result {
  co2Kg: number;
  label: string;
  activityType: ActivityType;
}

// ─── Emission Factor Tables ───────────────────────────────────────────────────

/**
 * Transit emission factors in kg CO₂e per passenger-kilometre.
 */
const TRANSIT_FACTORS: Record<TransitMode, number> = {
  car: 0.192,               // Average petrol car, UK DESNZ 2023
  motorcycle: 0.114,        // 125cc average
  bus: 0.089,               // Local bus, average occupancy
  train: 0.041,             // National rail average
  subway: 0.028,            // Urban metro average
  flight_domestic: 0.255,   // Per passenger-km incl. radiative forcing
  flight_international: 0.195, // Long haul, economy class
  bicycle: 0.0,             // Zero operational emissions
  walking: 0.0,             // Zero operational emissions
};

/**
 * Food emission factors in kg CO₂e per kilogram of food.
 */
const FOOD_FACTORS: Record<FoodItem, number> = {
  beef: 27.0,       // kg CO₂e per kg (beef, average global)
  lamb: 24.5,       // kg CO₂e per kg
  pork: 7.6,        // kg CO₂e per kg
  chicken: 6.9,     // kg CO₂e per kg
  fish: 5.4,        // kg CO₂e per kg (farmed fish average)
  dairy: 3.2,       // kg CO₂e per kg (cow's milk)
  eggs: 4.5,        // kg CO₂e per kg
  rice: 2.7,        // kg CO₂e per kg (includes methane from paddies)
  bread: 0.9,       // kg CO₂e per kg
  vegetables: 0.4,  // kg CO₂e per kg (average mixed vegetables)
};

/**
 * Energy emission factors in kg CO₂e per kWh.
 */
const ENERGY_FACTORS: Record<EnergySource, number> = {
  grid_electricity: 0.233,  // kg CO₂e per kWh (global average, IEA 2023)
  natural_gas: 0.203,       // kg CO₂e per kWh (combustion)
  lpg: 0.214,               // kg CO₂e per kWh
  coal: 0.341,              // kg CO₂e per kWh
};

// ─── Core Calculation Functions ───────────────────────────────────────────────

/**
 * Calculates the CO₂ equivalent for a transit activity.
 * @param mode    - Vehicle or transport mode
 * @param distanceKm - Distance travelled in kilometres
 * @returns CO₂e in kilograms
 */
export function calculateTransitCO2(mode: TransitMode, distanceKm: number): number {
  if (distanceKm < 0) throw new RangeError('Distance cannot be negative');
  const factor = TRANSIT_FACTORS[mode] !== undefined ? TRANSIT_FACTORS[mode] : 0.192;
  return roundCO2(factor * distanceKm);
}

/**
 * Calculates the CO₂ equivalent for a food activity.
 * @param item       - Food item consumed
 * @param weightGrams - Amount consumed in grams
 * @returns CO₂e in kilograms
 */
export function calculateFoodCO2(item: FoodItem, weightGrams: number): number {
  if (weightGrams < 0) throw new RangeError('Weight cannot be negative');
  const factor = FOOD_FACTORS[item] !== undefined ? FOOD_FACTORS[item] : 2.7;
  const weightKg = weightGrams / 1000;
  return roundCO2(factor * weightKg);
}

/**
 * Calculates the CO₂ equivalent for an energy activity.
 * @param source - Energy source type
 * @param kwh    - Energy consumed in kilowatt-hours
 * @returns CO₂e in kilograms
 */
export function calculateEnergyCO2(source: EnergySource, kwh: number): number {
  if (kwh < 0) throw new RangeError('Energy consumption cannot be negative');
  const factor = ENERGY_FACTORS[source] !== undefined ? ENERGY_FACTORS[source] : 0.233;
  return roundCO2(factor * kwh);
}

/**
 * Unified dispatcher — routes to the correct calculation function based on
 * activityType. Used by the Express route handler to avoid duplicated logic.
 *
 * @param activityType - "transit" | "food" | "energy"
 * @param label        - The specific mode/item/source key
 * @param value        - The numeric quantity
 * @param unit         - The unit of measurement
 * @returns CO₂e in kilograms
 */
export function calculateCO2(
  activityType: ActivityType,
  label: string,
  value: number,
  unit: Unit,
): number {
  const norm = label.toLowerCase().trim().replace(/ /g, '_');
  switch (activityType) {
    case 'transit': {
      const distanceKm = unit === 'km' ? value : value * 1.60934; // miles → km
      return calculateTransitCO2(norm as TransitMode, distanceKm);
    }
    case 'food': {
      const grams = unit === 'grams' ? value : value * 1000; // kg → grams
      return calculateFoodCO2(norm as FoodItem, grams);
    }
    case 'energy': {
      // Accept kWh directly; convert litres of LPG/gas if needed (1L LPG ≈ 6.9 kWh)
      const kwh = unit === 'kwh' ? value : value * 6.9;
      return calculateEnergyCO2(norm as EnergySource, kwh);
    }
    default:
      throw new Error(`Unknown activityType: ${activityType}`);
  }
}

// ─── Aggregation Utilities ────────────────────────────────────────────────────

export interface DailyTotal {
  date: string;   // ISO date string "YYYY-MM-DD"
  co2Kg: number;
}

/**
 * Groups an array of activity logs by calendar date and sums their CO₂.
 * Used to build chart data for the frontend Recharts dashboard.
 */
export function aggregateByDay(
  logs: Array<{ loggedAt: Date; co2Kg: number }>,
): DailyTotal[] {
  const map = new Map<string, number>();

  for (const log of logs) {
    const date = log.loggedAt.toISOString().split('T')[0];
    map.set(date, (map.get(date) ?? 0) + log.co2Kg);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, co2Kg]) => ({ date, co2Kg: roundCO2(co2Kg) }));
}

/**
 * Returns total CO₂ across all logs.
 */
export function totalCO2(logs: Array<{ co2Kg: number }>): number {
  return roundCO2(logs.reduce((sum, log) => sum + log.co2Kg, 0));
}

/**
 * Compares two periods and returns the percentage change.
 * Positive = increased emissions, Negative = reduced.
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return roundCO2(((current - previous) / previous) * 100);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rounds CO₂ values to 3 decimal places to avoid floating-point noise. */
function roundCO2(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ─── Exported Factor Tables (for test assertions) ─────────────────────────────
export { TRANSIT_FACTORS, FOOD_FACTORS, ENERGY_FACTORS };
