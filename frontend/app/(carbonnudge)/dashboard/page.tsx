"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Activity {
  id: number;
  activityType: string;
  label: string;
  value: number;
  unit: string;
  co2Kg: number;
  loggedAt: string;
}

interface UserProfile {
  region?: string;
  country?: string;
}

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"days" | "weeks" | "months" | "years">("months");

  const fetchData = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("carbonnudge_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Fetch user profile to get region/country
      const profileRes = await fetch(`${API_BASE}/api/users/me`, { headers });
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        setProfile(profileJson);
      }

      // Fetch activities up to 365 days
      const res = await fetch(`${API_BASE}/api/activities?days=365`, { headers });
      if (!res.ok) throw new Error("Failed to fetch activities");
      const json = await res.json();
      setActivities(json.activities ?? []);
    } catch (err) {
      console.error("Dashboard load error, showing fallback mock data:", err);
      // Fallback fallback mock data
      setActivities([
        { id: 1, activityType: "transit", label: "Car", value: 50, unit: "km", co2Kg: 9.6, loggedAt: new Date().toISOString() },
        { id: 2, activityType: "food", label: "Beef", value: 500, unit: "grams", co2Kg: 13.5, loggedAt: new Date().toISOString() },
        { id: 3, activityType: "energy", label: "Grid Electricity", value: 100, unit: "kwh", co2Kg: 23.3, loggedAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamic filter limits
  const now = new Date();
  const getFilterLimit = () => {
    const limit = new Date();
    if (timeFilter === "days") limit.setHours(now.getHours() - 24);
    else if (timeFilter === "weeks") limit.setDate(now.getDate() - 7);
    else if (timeFilter === "months") limit.setDate(now.getDate() - 30);
    else if (timeFilter === "years") limit.setDate(now.getDate() - 365);
    return limit;
  };

  const filterLimit = getFilterLimit();

  // Current period activities
  const filteredActivities = activities.filter(
    (act) => new Date(act.loggedAt) >= filterLimit
  );

  // Compute stats for current period
  const totalCo2Kg = Math.round(filteredActivities.reduce((s, a) => s + a.co2Kg, 0) * 10) / 10;
  const breakdown = { transit: 0, food: 0, energy: 0 };
  filteredActivities.forEach((a) => {
    if (a.activityType === "transit") breakdown.transit += a.co2Kg;
    else if (a.activityType === "food") breakdown.food += a.co2Kg;
    else if (a.activityType === "energy") breakdown.energy += a.co2Kg;
  });

  const totalBreakdown = (breakdown.transit + breakdown.food + breakdown.energy) || 1;
  const transitPct = Math.round((breakdown.transit / totalBreakdown) * 100);
  const foodPct = Math.round((breakdown.food / totalBreakdown) * 100);
  const energyPct = Math.round((breakdown.energy / totalBreakdown) * 100);

  // Calculate comparison/weekly trend percentage
  const getPreviousPeriodLimit = () => {
    const start = new Date(filterLimit);
    const end = new Date(filterLimit);
    if (timeFilter === "days") start.setHours(start.getHours() - 24);
    else if (timeFilter === "weeks") start.setDate(start.getDate() - 7);
    else if (timeFilter === "months") start.setDate(start.getDate() - 30);
    else if (timeFilter === "years") start.setDate(start.getDate() - 365);
    return { start, end };
  };

  const prevPeriod = getPreviousPeriodLimit();
  const prevActivities = activities.filter(
    (act) => {
      const d = new Date(act.loggedAt);
      return d >= prevPeriod.start && d < prevPeriod.end;
    }
  );
  const prevTotalCo2 = prevActivities.reduce((s, a) => s + a.co2Kg, 0);

  let changePercent = 0;
  if (prevTotalCo2 > 0) {
    changePercent = Math.round(((totalCo2Kg - prevTotalCo2) / prevTotalCo2) * 100);
  }

  // Carbon Score: lower is better, capped 0 to 100
  // Reference target: 10kg/day (300kg/month, 3650kg/year, 70kg/week)
  const getReferenceTarget = () => {
    if (timeFilter === "days") return 10;
    if (timeFilter === "weeks") return 70;
    if (timeFilter === "months") return 300;
    return 3650;
  };
  const target = getReferenceTarget();
  const carbonScore = Math.max(0, Math.min(100, Math.round(100 - (totalCo2Kg / target) * 100)));
  const gaugeOffset = Math.round(251.2 * (1 - carbonScore / 100));

  // Regional text
  const regionalText = profile?.region && profile?.country
    ? `Top 15% in ${profile.region}, ${profile.country}.`
    : "Top 15% in your region.";

  // Conic-gradient breakdown
  const conicGradient = `conic-gradient(
    #38BDF8 0% ${transitPct}%,
    #A2D149 ${transitPct}% ${transitPct + foodPct}%,
    #3b6934 ${transitPct + foodPct}% 100%
  )`;

  const downloadReport = () => {
    if (filteredActivities.length === 0) {
      alert("No activities logged to generate a report for this period.");
      return;
    }

    // CSV format contents
    const headers = ["Activity ID", "Activity Type", "Label", "Value", "Unit", "CO2 (kg)", "Logged At"];
    const rows = filteredActivities.map((act) => [
      act.id,
      act.activityType,
      `"${act.label}"`,
      act.value,
      act.unit,
      act.co2Kg,
      `"${new Date(act.loggedAt).toLocaleString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CarboNudge_Carbon_Report_${timeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const QUICK_LOG = [
    { href: "/log?type=transit", icon: "directions_car", label: "Travel" },
    { href: "/log?type=food", icon: "restaurant", label: "Meal" },
    { href: "/log?type=energy", icon: "bolt", label: "Energy" },
  ];

  return (
    <>
      {/* Page header */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between lg:items-end gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">Overview</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Track less. Live greener — here is your carbon overview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Selector */}
          <div className="flex bg-surface-container-low border border-outline/10 p-1 rounded-xl shadow-sm">
            {(["days", "weeks", "months", "years"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  timeFilter === filter
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {filter === "days" ? "24h" : filter === "weeks" ? "7d" : filter === "months" ? "30d" : "12m"}
              </button>
            ))}
          </div>

          {/* Download Report Button */}
          <button
            onClick={downloadReport}
            className="bg-surface-white border border-outline/20 text-text-heading px-4 py-2 rounded-full font-label-sm text-label-sm hover:bg-surface-container transition-colors shadow-ambient flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download Report
          </button>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        {/* Hero summary card */}
        <div className="bento-card col-span-1 md:col-span-8 p-6 md:p-8 flex flex-col justify-between shadow-ambient relative overflow-hidden bg-surface-white">
          <div className="z-10 relative">
            <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
              Your Carbon Summary ({timeFilter === "days" ? "Past 24h" : timeFilter === "weeks" ? "Past 7 Days" : timeFilter === "months" ? "Past 30 Days" : "Past Year"})
            </span>
            <div className="mt-6">
              {loading ? (
                <div className="h-12 w-32 bg-surface-container animate-pulse rounded-lg" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="font-display-lg text-display-lg text-text-heading">
                    {totalCo2Kg}
                  </span>
                  <span className="font-body-lg text-body-lg text-on-surface-variant font-bold">kg CO₂</span>
                </div>
              )}
              {prevTotalCo2 > 0 ? (
                <p className={`font-body-md text-body-md mt-2 flex items-center gap-1 font-semibold ${changePercent <= 0 ? "text-primary" : "text-red-500"}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {changePercent <= 0 ? "trending_down" : "trending_up"}
                  </span>
                  {Math.abs(changePercent)}% {changePercent <= 0 ? "lower" : "higher"} than previous period
                </p>
              ) : (
                <p className="font-body-md text-body-md text-primary mt-2 flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
                  Baseline period (First logs recorded)
                </p>
              )}
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-10 bg-gradient-to-tr from-chart-growth to-transparent transform translate-x-1/4 translate-y-1/4 rounded-tl-full pointer-events-none" />
        </div>

        {/* Carbon Score widget */}
        <div className="bento-card col-span-1 md:col-span-4 p-6 flex flex-col justify-between shadow-ambient items-center text-center bg-surface-white">
          <div className="w-full flex justify-between items-center mb-4">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Carbon Score</span>
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }}>info</span>
          </div>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="transparent" r="40" stroke="#f8f9ff" strokeWidth="12" />
              <circle
                cx="50" cy="50" fill="transparent" r="40"
                stroke="#A2D149" strokeDasharray="251.2"
                strokeDashoffset={gaugeOffset} strokeWidth="12"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-headline-md text-headline-md text-text-heading">{carbonScore}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">/ 100</span>
            </div>
          </div>
          <p className="font-body-md text-body-md mt-4 text-on-surface font-semibold">{regionalText}</p>
        </div>

        {/* Footprint Breakdown */}
        <div className="bento-card col-span-1 md:col-span-6 p-6 shadow-ambient bg-surface-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-headline-md text-text-heading">Breakdown</h3>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-2 text-primary/45">energy_savings_leaf</span>
              <p className="font-body-md text-sm">No activity logged for this time range.</p>
              <Link href="/log" className="mt-2 text-xs font-bold text-[#154212] dark:text-[#A2D149] hover:underline">
                Log your first activity now →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Conic-gradient Donut Chart */}
              <div
                className="w-40 h-40 rounded-full relative flex items-center justify-center flex-shrink-0 shadow-inner"
                style={{ background: conicGradient }}
              >
                {/* Inner hole of the donut chart */}
                <div className="w-28 h-28 rounded-full bg-surface-white dark:bg-slate-900 absolute flex flex-col items-center justify-center">
                  <span className="font-headline-sm text-lg font-bold text-text-heading">{totalCo2Kg}</span>
                  <span className="font-label-xs text-[10px] text-on-surface-variant uppercase">kg CO₂</span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-3">
                {[
                  { color: "bg-chart-atmospheric", label: "Transportation", pct: transitPct, val: breakdown.transit },
                  { color: "bg-chart-growth", label: "Food", pct: foodPct, val: breakdown.food },
                  { color: "bg-surface-tint", label: "Energy", pct: energyPct, val: breakdown.energy },
                ].map(({ color, label, pct, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color}`} />
                      <span className="font-body-md text-body-md text-sm">{label}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-label-sm text-label-sm text-text-heading block">{pct}%</span>
                      <span className="text-[10px] text-on-surface-variant block">{Math.round(val * 10) / 10} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="col-span-1 md:col-span-6 flex flex-col gap-6">
          {/* Action of the Day */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white border-l-4 border-l-chart-growth">
            <div className="flex items-start justify-between mb-2">
              <span className="font-label-sm text-label-sm text-chart-growth uppercase tracking-wider">Action of the Day</span>
              <span className="material-symbols-outlined text-chart-growth" style={{ fontSize: 20 }}>lightbulb</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-text-heading mb-2">Switch to LED bulbs</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Replacing 5 most-used incandescent bulbs can save 120kg CO₂ per year.
            </p>
            <div className="flex gap-3">
              <Link
                href="/log?type=energy"
                className="bg-secondary-fixed text-on-secondary-fixed px-4 py-2 rounded-lg font-label-sm text-label-sm hover:opacity-90 transition-opacity font-semibold"
              >
                Log Action
              </Link>
              <button className="border border-outline/20 text-on-surface-variant px-4 py-2 rounded-lg font-label-sm text-label-sm hover:bg-surface-container transition-colors">
                Dismiss
              </button>
            </div>
          </div>

          {/* Quick Log */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white">
            <h4 className="font-label-sm text-label-sm text-on-surface-variant mb-4 uppercase">Quick Log</h4>
            <div className="grid grid-cols-3 gap-4">
              {QUICK_LOG.map(({ href, icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center justify-center p-4 bg-surface-container-low hover:bg-surface-container-high rounded-xl transition-colors border border-outline/10 group"
                >
                  <span className="material-symbols-outlined text-primary mb-2 group-hover:scale-110 transition-transform" style={{ fontSize: 24 }}>
                    {icon}
                  </span>
                  <span className="font-label-xs text-label-xs text-on-surface font-semibold">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
