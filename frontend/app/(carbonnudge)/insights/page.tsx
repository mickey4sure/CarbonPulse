"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Insight {
  id: number;
  content: string;
  createdAt: string;
}

interface Activity {
  id: number;
  activityType: string;
  label: string;
  value: number;
  unit: string;
  co2Kg: number;
  loggedAt: string;
}

const TIPS = [
  { id: "qw1", icon: "directions_bike", title: "Cycle or Walk Short Trips", impact: "Reduce Transit emissions by 2.4 kg CO₂ per 10km", type: "transit", label: "Bicycle", value: 10, unit: "km", color: "text-chart-growth" },
  { id: "qw2", icon: "restaurant", title: "Eat a Plant-Based Meal", impact: "Reduce Food emissions by 3.6 kg CO₂ per meal", type: "food", label: "Vegetables", value: 500, unit: "grams", color: "text-chart-atmospheric" },
  { id: "qw3", icon: "bolt", title: "Log Energy Conservation", impact: "Log 5 kWh of solar/saving to cut 1.2 kg CO₂", type: "energy", label: "Natural Gas", value: 5, unit: "kwh", color: "text-primary" },
];

export default function InsightsPage() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load insights and activity logs to compute streaks/reductions
  const fetchInsightAndLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("carbonnudge_token") : null;
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch latest insight
      const res = await fetch(`${API_BASE}/api/insights/latest`, { headers });
      if (res.ok) {
        const json = await res.json();
        setInsight(json.insight);
      } else if (res.status === 404) {
        setInsight(null); // No insight generated yet
      }

      // 2. Fetch user's activity logs to calculate streak and weekly emissions
      const logsRes = await fetch(`${API_BASE}/api/activities?days=30`, { headers });
      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        setActivities(logsJson.activities ?? []);
      }
    } catch (err) {
      console.error("Error loading insights:", err);
      setError("Unable to load latest insights. Please check server connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsightAndLogs();
  }, [fetchInsightAndLogs]);

  // Generate new Gemini AI coach insight
  const handleGenerateInsight = async () => {
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/insights/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setInsight(data.insight);
        setSuccessMsg("AI Coach finished generating fresh advice!");
      } else {
        setError(data.error || "Log at least one activity this week before generating AI insights.");
      }
    } catch (err) {
      setError("Unable to reach Gemini AI coach right now. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Click Quick Win to log that eco activity instantly
  const handleQuickWinLog = async (tip: typeof TIPS[0]) => {
    setError(null);
    setSuccessMsg(null);
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (!token) {
        setError("Sign in required to log activities.");
        return;
      }

      const res = await fetch(`${API_BASE}/api/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activityType: tip.type,
          label: tip.label,
          value: tip.value,
          unit: tip.unit,
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Successfully logged a quick win: "${tip.title}"!`);
        // Refresh logs
        fetchInsightAndLogs();
      } else {
        setError("Failed to register Quick Win log.");
      }
    } catch (err) {
      setError("Network error logging Quick Win.");
    }
  };

  // Streak calculation helper: consecutive days of logged activity
  const calculateStreak = () => {
    if (activities.length === 0) return 0;
    
    // Extract calendar dates of all logs
    const loggedDates = Array.from(
      new Set(activities.map((a) => new Date(a.loggedAt).toDateString()))
    ).map((d) => new Date(d));

    // Sort descending (most recent first)
    loggedDates.sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If the latest logged activity is older than yesterday, streak is broken
    const diffTime = today.getTime() - loggedDates[0].getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return 0;

    let streak = 0;
    let checkDate = new Date(loggedDates[0]);

    for (let i = 0; i < loggedDates.length; i++) {
      const diff = Math.round((checkDate.getTime() - loggedDates[i].getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 0) {
        streak++;
        // Prepare expected date for next iteration (yesterday relative to current index)
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const streakDays = calculateStreak();

  // Weekly reduction: emissions logged in the last 7 days compared to previous 7 days
  const getWeeklyProgress = () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekLogs = activities.filter((a) => new Date(a.loggedAt) >= sevenDaysAgo);
    const lastWeekLogs = activities.filter((a) => {
      const d = new Date(a.loggedAt);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    });

    const thisWeekTotal = thisWeekLogs.reduce((sum, a) => sum + a.co2Kg, 0);
    const lastWeekTotal = lastWeekLogs.reduce((sum, a) => sum + a.co2Kg, 0);

    let reductionPct = 0;
    if (lastWeekTotal > 0) {
      const diff = lastWeekTotal - thisWeekTotal;
      reductionPct = Math.round((diff / lastWeekTotal) * 100);
    }

    // Goal calculation (target: stay under 50kg CO₂ weekly)
    const goalLimit = 50;
    const progressPct = Math.min(100, Math.round((thisWeekTotal / goalLimit) * 100));

    return {
      reductionPct,
      progressPct,
      thisWeekTotal: Math.round(thisWeekTotal * 10) / 10,
    };
  };

  const weeklyStats = getWeeklyProgress();

  return (
    <>
      <div className="mb-8">
        <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">Personalized Insights</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Track less. Live greener.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl font-body-md text-body-md">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-[#154212]/10 text-primary rounded-xl font-body-md text-body-md border border-[#154212]/20">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* AI Gemini Insight */}
        <div className="col-span-1 md:col-span-8">
          <div className="bento-card p-6 md:p-8 shadow-ambient bg-surface-white h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                </div>
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Gemini AI Coach</span>
                  <p className="font-label-xs text-label-xs text-on-surface-variant">Powered by Google Gemini</p>
                </div>
              </div>

              {loading && (
                <div className="space-y-3">
                  <div className="h-4 bg-surface-container animate-pulse rounded w-3/4" />
                  <div className="h-4 bg-surface-container animate-pulse rounded w-full" />
                  <div className="h-4 bg-surface-container animate-pulse rounded w-5/6" />
                  <div className="h-4 bg-surface-container animate-pulse rounded w-2/3 mt-4" />
                </div>
              )}

              {!loading && !generating && insight && (
                <div className="prose font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-line border-l-2 border-primary/20 pl-4">
                  {insight.content}
                </div>
              )}

              {!loading && !generating && !insight && (
                <div className="flex flex-col items-center text-center py-8">
                  <span className="material-symbols-outlined text-primary/40 mb-4 animate-bounce" style={{ fontSize: 48 }}>
                    psychology
                  </span>
                  <h3 className="font-headline-md text-lg font-bold text-text-heading mb-2">No active insights generated yet</h3>
                  <p className="font-body-md text-sm text-on-surface-variant max-w-[80%] leading-relaxed">
                    Make sure you have logged at least one carbon activity this week. Click the button below to generate AI recommendations!
                  </p>
                </div>
              )}

              {generating && (
                <div className="flex flex-col items-center text-center py-8">
                  <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
                  <p className="font-body-md text-sm text-on-surface-variant">
                    Gemini is reviewing your carbon logs and drafting custom coach insights...
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline/10">
              <span className="font-label-xs text-xs text-on-surface-variant">
                {insight
                  ? `Updated ${new Date(insight.createdAt).toLocaleDateString()}`
                  : "Updates instantly on request"}
              </span>
              <button
                onClick={handleGenerateInsight}
                disabled={generating}
                className="w-full sm:w-auto bg-primary text-on-primary px-5 py-2.5 rounded-xl font-label-sm text-xs hover:opacity-90 transition-opacity font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Generate AI Insights
              </button>
            </div>
          </div>
        </div>

        {/* Stats sidebar */}
        <div className="col-span-1 md:col-span-4 flex flex-col gap-6">
          {/* Active stats */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">This Week's Emissions</span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display-lg text-3xl font-bold text-text-heading">{weeklyStats.thisWeekTotal}</span>
              <span className="font-body-md text-xs text-on-surface-variant font-bold">kg CO₂</span>
            </div>
            
            <div className="mt-4 h-2.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-chart-growth rounded-full transition-all duration-500"
                style={{ width: `${weeklyStats.progressPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <p className="font-label-xs text-[10px] text-on-surface-variant">
                {weeklyStats.progressPct}% of target goal limit (50kg)
              </p>
              {weeklyStats.reductionPct > 0 && (
                <span className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                  -{weeklyStats.reductionPct}% change
                </span>
              )}
            </div>
          </div>

          {/* Active streak */}
          <div className="bento-card p-6 shadow-ambient bg-surface-white">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Active Logging Streak</span>
            <div className="mt-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-orange-500" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>
                local_fire_department
              </span>
              <div>
                <span className="font-headline-md text-xl font-bold text-text-heading">
                  {streakDays} {streakDays === 1 ? "day" : "days"}
                </span>
                <p className="font-label-xs text-xs text-on-surface-variant">
                  {streakDays > 0 ? "Keep logging daily to protect your streak!" : "Log an activity today to start a streak!"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Wins details and description */}
        <div className="col-span-1 md:col-span-12">
          <div className="mb-4">
            <h2 className="font-headline-md text-headline-md text-text-heading mb-1">Quick Wins</h2>
            <p className="font-body-md text-sm text-on-surface-variant">
              Quick Wins are simple, actionable offsets you can complete immediately to instantly log carbon savings and boost your streak. Click any card below to log it directly!
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TIPS.map((tip) => (
              <button
                key={tip.id}
                onClick={() => handleQuickWinLog(tip)}
                className="bento-card p-6 shadow-ambient bg-surface-white hover:border-chart-growth/45 hover:scale-[1.01] transition-all border border-outline/5 text-left flex flex-col justify-between"
              >
                <div>
                  <span className={`material-symbols-outlined ${tip.color} mb-3`} style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>
                    {tip.icon}
                  </span>
                  <h3 className="font-body-md text-base font-bold text-text-heading mb-1.5">{tip.title}</h3>
                  <p className="font-label-sm text-xs text-on-surface-variant leading-relaxed">{tip.impact}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-outline/5 w-full flex items-center justify-between text-xs text-primary font-bold">
                  <span>Log instant saving</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
