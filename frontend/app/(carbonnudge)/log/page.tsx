"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Category = "transit" | "food" | "energy";

const CATEGORIES: { key: Category; icon: string; label: string }[] = [
  { key: "transit", icon: "directions_car", label: "Transit" },
  { key: "food", icon: "restaurant", label: "Food" },
  { key: "energy", icon: "bolt", label: "Energy" },
];

const ACTIVITY_OPTIONS: Record<Category, string[]> = {
  transit: ["Car", "Bus", "Train", "Flight", "Bicycle"],
  food: ["Beef", "Chicken", "Fish", "Vegetables", "Rice", "Dairy"],
  energy: ["Grid Electricity", "Natural Gas", "Coal", "Solar"],
};

const UNIT_LABELS: Record<Category, string> = {
  transit: "Distance (km)",
  food: "Amount (grams)",
  energy: "Consumption (kWh)",
};

const UNIT_VALUES: Record<Category, string> = {
  transit: "km",
  food: "grams",
  energy: "kwh",
};

// Client-side CO₂ preview (mirrors backend carbon.ts logic)
const EMISSION_FACTORS: Record<string, Record<string, number>> = {
  transit: { Car: 0.192, Bus: 0.089, Train: 0.041, Flight: 0.255, Bicycle: 0 },
  food: { Beef: 0.027, Chicken: 0.0069, Fish: 0.0068, Vegetables: 0.002, Rice: 0.0028, Dairy: 0.0032 },
  energy: { "Grid Electricity": 0.233, "Natural Gas": 0.2, Coal: 0.34, Solar: 0 },
};

function calcPreview(category: Category, activityLabel: string, value: number): number {
  const factor = EMISSION_FACTORS[category]?.[activityLabel] ?? 0;
  if (category === "food") return Math.round((value / 1000) * factor * 1000 * 100) / 100;
  return Math.round(value * factor * 100) / 100;
}

function LogActivityForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialType = (searchParams.get("type") as Category) ?? "transit";
  const [category, setCategory] = useState<Category>(initialType);
  const [activityLabel, setActivityLabel] = useState(ACTIVITY_OPTIONS[initialType][0]);
  const [value, setValue] = useState<string>("");
  const [preview, setPreview] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePreview = useCallback(() => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setPreview(calcPreview(category, activityLabel, num));
    } else {
      setPreview(null);
    }
  }, [category, activityLabel, value]);

  useEffect(() => { updatePreview(); }, [updatePreview]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setActivityLabel(ACTIVITY_OPTIONS[cat][0]);
    setValue("");
    setPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError("Please enter a valid positive number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem("carbonnudge_token");
      const res = await fetch(`${API_BASE}/api/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          activityType: category,
          label: activityLabel.toLowerCase(),
          value: num,
          unit: UNIT_VALUES[category],
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to log activity");
      }
      setSuccess(true);
      setValue("");
      setPreview(null);
      setTimeout(() => { setSuccess(false); }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">Log an Activity</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Every action counts toward your environmental goal.
        </p>
      </div>

      <div className="max-w-xl">
        <form onSubmit={handleSubmit} noValidate>
          {/* Step 1 — Category */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white mb-4">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4">
              Step 1 — Select Category
            </p>
            <div className="flex gap-3 flex-wrap" role="group" aria-label="Activity category">
              {CATEGORIES.map(({ key, icon, label }) => (
                <button
                  key={key}
                  type="button"
                  id={`category-${key}`}
                  aria-pressed={category === key}
                  onClick={() => handleCategoryChange(key)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full font-label-sm text-label-sm transition-all border ${
                    category === key
                      ? "bg-primary-container text-on-primary border-primary-container"
                      : "bg-surface-container-low text-on-surface-variant border-outline/20 hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Activity Type */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white mb-4">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4">
              Step 2 — Activity Type
            </p>
            <label htmlFor="activity-type" className="font-body-md text-body-md text-text-heading mb-2 block">
              Activity Type
            </label>
            <select
              id="activity-type"
              aria-label="Select activity type"
              value={activityLabel}
              onChange={(e) => setActivityLabel(e.target.value)}
              className="w-full border border-outline/30 rounded-xl px-4 py-3 font-body-md text-body-md text-text-heading bg-surface-white focus:outline-none focus:ring-2 focus:ring-primary-container transition"
            >
              {ACTIVITY_OPTIONS[category].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Step 3 — Quantity */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white mb-4">
            <p className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4">
              Step 3 — Quantity
            </p>
            <label htmlFor="activity-value" className="font-body-md text-body-md text-text-heading mb-2 block">
              {UNIT_LABELS[category]}
            </label>
            <input
              id="activity-value"
              type="number"
              min="0"
              step="any"
              aria-label={`Enter ${UNIT_LABELS[category]}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full border border-outline/30 rounded-xl px-4 py-3 font-mono text-body-md text-text-heading bg-surface-white focus:outline-none focus:ring-2 focus:ring-primary-container transition"
            />
          </div>

          {/* CO₂ Preview */}
          {preview !== null && (
            <div className="bento-card p-5 shadow-ambient bg-surface-white mb-4 border-l-4 border-l-chart-growth">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-chart-growth" style={{ fontSize: 20 }}>eco</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                    Estimated CO₂ Impact
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-text-heading" style={{ fontSize: 36 }}>
                  {preview}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">kg CO₂e</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-error-container text-on-error-container rounded-xl font-body-md text-body-md">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-4 bg-secondary-fixed text-on-secondary-fixed rounded-xl font-body-md text-body-md flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
              Activity logged successfully!
            </div>
          )}

          {/* Actions */}
          <button
            type="submit"
            disabled={submitting}
            aria-label="Log daily activity"
            className="w-full bg-primary-container text-on-primary py-4 rounded-xl font-label-sm text-label-sm hover:opacity-90 transition-opacity disabled:opacity-50 mb-3"
          >
            {submitting ? "Logging..." : "Log Activity"}
          </button>
          <button
            type="button"
            onClick={() => { setValue(""); setPreview(null); setError(null); }}
            className="w-full border border-outline/20 text-on-surface-variant py-3 rounded-xl font-label-sm text-label-sm hover:bg-surface-container transition-colors"
          >
            Log Another
          </button>
        </form>
      </div>
    </>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <LogActivityForm />
    </Suspense>
  );
}
