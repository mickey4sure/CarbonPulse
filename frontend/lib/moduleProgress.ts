// Module IDs must match the keys in modules/page.tsx
const STORAGE_KEY = "chori_completed_modules";

export function getCompletedModules(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markModuleCompleted(moduleId: string): void {
  if (typeof window === "undefined") return;
  try {
    const completed = getCompletedModules();
    completed.add(moduleId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed)));
    // Dispatch a custom event so any listening page can react
    window.dispatchEvent(new CustomEvent("moduleCompleted", { detail: moduleId }));
  } catch {
    // silently fail
  }
}

export function isModuleCompleted(moduleId: string): boolean {
  return getCompletedModules().has(moduleId);
}
