"use client";

import { useState, useEffect } from "react";

interface Habit {
  id: string;
  icon: string;
  title: string;
  description: string;
  co2SavedKg: number;
  category: "transit" | "food" | "energy" | "lifestyle";
}

const DEFAULT_HABITS: Habit[] = [
  { id: "h1", icon: "directions_bike", title: "Cycle or walk to work", description: "Replace one car trip per week with cycling or walking.", co2SavedKg: 2.5, category: "transit" },
  { id: "h2", icon: "train", title: "Take public transport", description: "Use bus or train instead of driving for city journeys.", co2SavedKg: 1.8, category: "transit" },
  { id: "h3", icon: "eco", title: "Eat plant-based twice a week", description: "Replace meat meals with vegetables or legumes.", co2SavedKg: 3.6, category: "food" },
  { id: "h4", icon: "shopping_bag", title: "Buy local produce", description: "Shop at farmers markets to cut food miles.", co2SavedKg: 0.9, category: "food" },
  { id: "h5", icon: "lightbulb", title: "Switch to LED bulbs", description: "Replace all incandescent bulbs in your home.", co2SavedKg: 1.2, category: "energy" },
  { id: "h6", icon: "thermostat", title: "Lower thermostat by 1°C", description: "Reduces heating energy use by up to 10%.", co2SavedKg: 0.8, category: "energy" },
  { id: "h7", icon: "local_laundry_service", title: "Wash laundry in cold water", description: "90% of washing machine energy goes to heating water.", co2SavedKg: 0.5, category: "energy" },
  { id: "h8", icon: "flight_takeoff", title: "Skip one flight this year", description: "Choose train or video call instead of flying.", co2SavedKg: 500, category: "transit" },
];

const CATEGORY_COLORS: Record<string, string> = {
  transit: "bg-chart-atmospheric/15 text-tertiary",
  food: "bg-chart-growth/15 text-secondary",
  energy: "bg-primary-fixed/30 text-primary",
  lifestyle: "bg-secondary-container/30 text-on-secondary-container",
};

const ICONS = [
  "eco", "directions_bike", "train", "shopping_bag", "lightbulb",
  "thermostat", "local_laundry_service", "flight_takeoff",
  "recycling", "forest", "water_drop", "bolt"
];

const COMPLETED_KEY = "carbonnudge_habits_completed";
const CUSTOM_HABITS_KEY = "carbonnudge_custom_habits";

export default function HabitsPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [customHabits, setCustomHabits] = useState<Habit[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    co2SavedKg: string;
    category: "transit" | "food" | "energy" | "lifestyle";
    icon: string;
  }>({
    title: "",
    description: "",
    co2SavedKg: "",
    category: "lifestyle",
    icon: "eco",
  });

  useEffect(() => {
    try {
      const savedCompleted = JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? "[]") as string[];
      setCompleted(new Set(savedCompleted));
      
      const savedCustom = JSON.parse(localStorage.getItem(CUSTOM_HABITS_KEY) ?? "[]") as Habit[];
      setCustomHabits(savedCustom);
    } catch { /* ignore */ }
  }, []);

  const allHabits = [...DEFAULT_HABITS, ...customHabits];

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(COMPLETED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const handleAddCustomHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const newHabit: Habit = {
      id: `custom_${Date.now()}`,
      icon: form.icon,
      title: form.title.trim(),
      description: form.description.trim() || "User defined eco habit.",
      co2SavedKg: parseFloat(form.co2SavedKg) || 1.0,
      category: form.category,
    };

    const updatedCustom = [...customHabits, newHabit];
    setCustomHabits(updatedCustom);
    localStorage.setItem(CUSTOM_HABITS_KEY, JSON.stringify(updatedCustom));

    // Reset Form
    setForm({
      title: "",
      description: "",
      co2SavedKg: "",
      category: "lifestyle",
      icon: "eco",
    });
    setModalOpen(false);
  };

  const handleDeleteCustomHabit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent toggling complete when clicking delete
    const updatedCustom = customHabits.filter((h) => h.id !== id);
    setCustomHabits(updatedCustom);
    localStorage.setItem(CUSTOM_HABITS_KEY, JSON.stringify(updatedCustom));

    // Also remove from completed if it was checked
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        localStorage.setItem(COMPLETED_KEY, JSON.stringify([...next]));
      }
      return next;
    });
  };

  const totalSaved = allHabits
    .filter((h) => completed.has(h.id))
    .reduce((s, h) => s + h.co2SavedKg, 0);

  return (
    <>
      <div className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-text-heading mb-2">Habits &amp; Actions</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Track less. Live greener — log and build custom habits.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="bg-primary text-on-primary px-4 py-2.5 rounded-full font-label-sm text-label-sm hover:opacity-90 transition-opacity font-bold shadow-md flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Add Custom Habit
          </button>
          
          {completed.size > 0 && (
            <div className="bento-card px-5 py-2.5 text-center bg-surface-white shadow-ambient border border-outline/5">
              <span className="font-label-xs text-[10px] text-on-surface-variant uppercase block">CO₂ Saved</span>
              <p className="font-headline-md text-headline-md text-primary font-bold">
                {totalSaved >= 1 ? `${Math.round(totalSaved * 10) / 10} kg` : `${Math.round(totalSaved * 1000)} g`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="bento-card p-6 shadow-ambient bg-surface-white mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-bold">Progress Dashboard</span>
          <span className="font-label-sm text-label-sm text-text-heading font-bold">
            {completed.size} / {allHabits.length} habits completed
          </span>
        </div>
        <div className="h-2.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className="h-full bg-chart-growth rounded-full transition-all duration-500"
            style={{ width: `${(completed.size / Math.max(1, allHabits.length)) * 100}%` }}
          />
        </div>
      </div>

      {/* Habits grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allHabits.map((habit) => {
          const done = completed.has(habit.id);
          const isCustom = habit.id.startsWith("custom_");
          
          return (
            <div
              key={habit.id}
              onClick={() => toggle(habit.id)}
              className={`bento-card p-5 text-left transition-all shadow-ambient hover:shadow-md cursor-pointer group flex flex-col justify-between min-h-[175px] border ${
                done ? "bg-[#154212]/5 dark:bg-[#A2D149]/10 border-chart-growth/20" : "bg-surface-white border-outline/5"
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`material-symbols-outlined text-3xl ${done ? "text-primary" : "text-on-surface-variant"}`}
                    style={{ fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {habit.icon}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <button
                        onClick={(e) => handleDeleteCustomHabit(e, habit.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity p-1 flex items-center justify-center rounded-full hover:bg-red-50/50"
                        title="Delete custom habit"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        done
                          ? "bg-primary border-primary"
                          : "border-outline/30 group-hover:border-primary"
                      }`}
                    >
                      {done && (
                        <span className="material-symbols-outlined text-white" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
                          check
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <h3 className={`font-body-md text-base font-bold mb-1.5 ${done ? "text-primary line-through" : "text-text-heading"}`}>
                  {habit.title}
                </h3>
                <p className="font-label-sm text-xs text-on-surface-variant mb-4 leading-relaxed">{habit.description}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-outline/5">
                <span className={`font-label-xs text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${CATEGORY_COLORS[habit.category]}`}>
                  {habit.category}
                </span>
                <span className="font-label-xs text-[10px] text-on-surface-variant font-bold">
                  ~{habit.co2SavedKg >= 1 ? `${habit.co2SavedKg} kg` : `${Math.round(habit.co2SavedKg * 1000)} g`} CO₂
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add custom habit dialog modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-surface-white border border-outline/10 rounded-2xl shadow-xl p-6 relative">
            <h3 className="font-headline-md text-lg font-bold text-text-heading mb-4">Add Custom Habit</h3>
            
            <form onSubmit={handleAddCustomHabit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Habit Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Use a reusable coffee cup"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Cut waste from single-use paper cups."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Estimated CO₂ Saved (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 0.3"
                    value={form.co2SavedKg}
                    onChange={(e) => setForm({ ...form, co2SavedKg: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-outline/20 bg-background-subtle text-text-heading text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="transit">Transit</option>
                    <option value="food">Food</option>
                    <option value="energy">Energy</option>
                    <option value="lifestyle">Lifestyle</option>
                  </select>
                </div>
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">Select Icon</label>
                <div className="flex flex-wrap gap-2.5 p-3 rounded-xl border border-outline/10 bg-background-subtle">
                  {ICONS.map((icon) => (
                    <button
                      type="button"
                      key={icon}
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        form.icon === icon
                          ? "bg-primary text-on-primary scale-110 shadow-sm"
                          : "text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-label-sm text-xs hover:opacity-90 transition-opacity font-bold"
                >
                  Create Habit
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 border border-outline/20 text-on-surface-variant py-2.5 rounded-xl font-label-sm text-xs hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
