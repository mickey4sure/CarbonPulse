/**
 * carbon.test.ts — Unit tests for CO₂ calculation utilities
 *
 * Tests every calculation function, edge case, and aggregation utility
 * in lib/carbon.ts. Uses the existing Mocha + Chai test runner.
 *
 * Run with: pnpm --filter backend test
 */

import { expect } from 'chai';
import {
  calculateTransitCO2,
  calculateFoodCO2,
  calculateEnergyCO2,
  calculateCO2,
  aggregateByDay,
  totalCO2,
  percentageChange,
  TRANSIT_FACTORS,
  FOOD_FACTORS,
  ENERGY_FACTORS,
} from '../lib/carbon';

// ─── Transit Tests ────────────────────────────────────────────────────────────

describe('calculateTransitCO2()', () => {
  it('calculates CO₂ for a car journey (15 km)', () => {
    const result = calculateTransitCO2('car', 15);
    // 0.192 kg/km × 15 km = 2.88 kg
    expect(result).to.equal(2.88);
  });

  it('calculates zero emissions for bicycle', () => {
    expect(calculateTransitCO2('bicycle', 100)).to.equal(0);
  });

  it('calculates zero emissions for walking', () => {
    expect(calculateTransitCO2('walking', 5)).to.equal(0);
  });

  it('calculates CO₂ for a domestic flight (500 km)', () => {
    const result = calculateTransitCO2('flight_domestic', 500);
    // 0.255 × 500 = 127.5 kg
    expect(result).to.equal(127.5);
  });

  it('calculates CO₂ for a train journey (100 km)', () => {
    const result = calculateTransitCO2('train', 100);
    // 0.041 × 100 = 4.1 kg
    expect(result).to.equal(4.1);
  });

  it('returns zero for zero distance', () => {
    expect(calculateTransitCO2('car', 0)).to.equal(0);
  });

  it('throws RangeError for negative distance', () => {
    expect(() => calculateTransitCO2('car', -10)).to.throw(RangeError, 'Distance cannot be negative');
  });

  it('uses emission factors consistent with TRANSIT_FACTORS table', () => {
    const result = calculateTransitCO2('bus', 50);
    expect(result).to.equal(Math.round(TRANSIT_FACTORS['bus'] * 50 * 1000) / 1000);
  });
});

// ─── Food Tests ───────────────────────────────────────────────────────────────

describe('calculateFoodCO2()', () => {
  it('calculates CO₂ for 200g of beef', () => {
    const result = calculateFoodCO2('beef', 200);
    // 27.0 kg/kg × 0.2 kg = 5.4 kg
    expect(result).to.equal(5.4);
  });

  it('calculates CO₂ for 150g of chicken', () => {
    const result = calculateFoodCO2('chicken', 150);
    // 6.9 × 0.15 = 1.035
    expect(result).to.equal(1.035);
  });

  it('calculates CO₂ for 500g of vegetables (low impact)', () => {
    const result = calculateFoodCO2('vegetables', 500);
    // 0.4 × 0.5 = 0.2 kg
    expect(result).to.equal(0.2);
  });

  it('calculates CO₂ for 100g of rice', () => {
    const result = calculateFoodCO2('rice', 100);
    // 2.7 × 0.1 = 0.27 kg
    expect(result).to.equal(0.27);
  });

  it('returns zero for zero weight', () => {
    expect(calculateFoodCO2('beef', 0)).to.equal(0);
  });

  it('throws RangeError for negative weight', () => {
    expect(() => calculateFoodCO2('beef', -100)).to.throw(RangeError, 'Weight cannot be negative');
  });

  it('beef has higher CO₂ than chicken (climate reality check)', () => {
    const beef = calculateFoodCO2('beef', 200);
    const chicken = calculateFoodCO2('chicken', 200);
    expect(beef).to.be.greaterThan(chicken);
  });

  it('uses emission factors consistent with FOOD_FACTORS table', () => {
    const result = calculateFoodCO2('pork', 300);
    expect(result).to.equal(Math.round(FOOD_FACTORS['pork'] * 0.3 * 1000) / 1000);
  });
});

// ─── Energy Tests ─────────────────────────────────────────────────────────────

describe('calculateEnergyCO2()', () => {
  it('calculates CO₂ for 10 kWh of grid electricity', () => {
    const result = calculateEnergyCO2('grid_electricity', 10);
    // 0.233 × 10 = 2.33 kg
    expect(result).to.equal(2.33);
  });

  it('calculates CO₂ for 5 kWh of natural gas', () => {
    const result = calculateEnergyCO2('natural_gas', 5);
    // 0.203 × 5 = 1.015 kg
    expect(result).to.equal(1.015);
  });

  it('calculates CO₂ for coal (highest impact energy source)', () => {
    const result = calculateEnergyCO2('coal', 10);
    // 0.341 × 10 = 3.41 kg
    expect(result).to.equal(3.41);
  });

  it('returns zero for zero energy consumption', () => {
    expect(calculateEnergyCO2('grid_electricity', 0)).to.equal(0);
  });

  it('throws RangeError for negative energy consumption', () => {
    expect(() => calculateEnergyCO2('grid_electricity', -5)).to.throw(
      RangeError,
      'Energy consumption cannot be negative',
    );
  });

  it('coal produces more CO₂ than electricity per kWh', () => {
    const coal = calculateEnergyCO2('coal', 1);
    const electricity = calculateEnergyCO2('grid_electricity', 1);
    expect(coal).to.be.greaterThan(electricity);
  });
});

// ─── Unified Dispatcher Tests ─────────────────────────────────────────────────

describe('calculateCO2() — unified dispatcher', () => {
  it('dispatches transit correctly using km unit', () => {
    const result = calculateCO2('transit', 'car', 15, 'km');
    expect(result).to.equal(2.88);
  });

  it('dispatches food correctly using grams unit', () => {
    const result = calculateCO2('food', 'beef', 200, 'grams');
    expect(result).to.equal(5.4);
  });

  it('dispatches energy correctly using kwh unit', () => {
    const result = calculateCO2('energy', 'grid_electricity', 10, 'kwh');
    expect(result).to.equal(2.33);
  });

  it('throws for an unknown activityType', () => {
    expect(() => calculateCO2('unknown' as any, 'car', 10, 'km')).to.throw(
      'Unknown activityType: unknown',
    );
  });
});

// ─── Aggregation Tests ────────────────────────────────────────────────────────

describe('aggregateByDay()', () => {
  const logs = [
    { loggedAt: new Date('2024-06-01T09:00:00Z'), co2Kg: 2.88 },
    { loggedAt: new Date('2024-06-01T18:00:00Z'), co2Kg: 5.4 },
    { loggedAt: new Date('2024-06-02T10:00:00Z'), co2Kg: 2.33 },
  ];

  it('groups logs from the same day into one entry', () => {
    const result = aggregateByDay(logs);
    expect(result).to.have.lengthOf(2);
  });

  it('sums CO₂ values within the same day', () => {
    const result = aggregateByDay(logs);
    const june1 = result.find((d) => d.date === '2024-06-01');
    expect(june1?.co2Kg).to.equal(8.28); // 2.88 + 5.4
  });

  it('returns results sorted ascending by date', () => {
    const result = aggregateByDay(logs);
    expect(result[0].date).to.equal('2024-06-01');
    expect(result[1].date).to.equal('2024-06-02');
  });

  it('returns empty array for empty input', () => {
    expect(aggregateByDay([])).to.deep.equal([]);
  });
});

describe('totalCO2()', () => {
  it('sums all co2Kg values', () => {
    const logs = [{ co2Kg: 2.88 }, { co2Kg: 5.4 }, { co2Kg: 2.33 }];
    expect(totalCO2(logs)).to.equal(10.61);
  });

  it('returns zero for empty array', () => {
    expect(totalCO2([])).to.equal(0);
  });
});

describe('percentageChange()', () => {
  it('returns positive % when current is higher (increased emissions)', () => {
    const result = percentageChange(10.61, 8.2);
    expect(result).to.be.greaterThan(0);
    expect(result).to.be.closeTo(29.39, 0.1);
  });

  it('returns negative % when current is lower (reduced emissions)', () => {
    const result = percentageChange(6.0, 8.2);
    expect(result).to.be.lessThan(0);
  });

  it('returns 0 when previous is zero (avoids division by zero)', () => {
    expect(percentageChange(10, 0)).to.equal(0);
  });

  it('returns 0 when current equals previous (no change)', () => {
    expect(percentageChange(8.2, 8.2)).to.equal(0);
  });
});
