"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const NAV_LINKS = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/log", icon: "add_circle", label: "Log Activity" },
  { href: "/insights", icon: "analytics", label: "Insights" },
  { href: "/habits", icon: "checklist", label: "Habits" },
  { href: "/community", icon: "group", label: "Community" },
];

const BOTTOM_NAV = [
  { href: "/dashboard", icon: "home", label: "Home" },
  { href: "/log", icon: "add_circle", label: "Log" },
  { href: "/insights", icon: "monitoring", label: "Insights" },
  { href: "/community", icon: "public", label: "Social" },
];

interface UserData {
  email: string;
  initials: string;
  name: string;
  level: number;
  tutorialCompleted: boolean;
}

export default function CarboNudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [user, setUser] = useState<UserData | null>(null);

  // Tutorial Modal State
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Sync theme
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  // Fetch dynamic user info (level and tutorial status)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("carbonnudge_token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const email = json.email || "";
          const namePart = email.split("@")[0] || "Eco Warrior";
          const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const initials = email.substring(0, 2).toUpperCase() || "EW";
          
          // Calculate level: 0 activities = Lv.1, 1-5 = Lv.2, 6-15 = Lv.3, 16+ = Lv.4
          const count = json.totalActivitiesCount || 0;
          let level = 1;
          if (count > 15) level = 4;
          else if (count > 5) level = 3;
          else if (count > 0) level = 2;

          setUser({
            email,
            initials,
            name,
            level,
            tutorialCompleted: !!json.tutorialCompleted,
          });

          // Open tutorial automatically if new user (tutorialCompleted === false)
          if (!json.tutorialCompleted) {
            setTutorialOpen(true);
            setTutorialStep(0);
          }
        }
      } catch (err) {
        console.error("Error fetching user in layout:", err);
      }
    };
    fetchUser();
  }, [pathname]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleCompleteTutorial = async () => {
    try {
      const token = localStorage.getItem("carbonnudge_token");
      if (token) {
        await fetch(`${API_BASE}/api/users/tutorial`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
      setTutorialOpen(false);
      if (user) {
        setUser({ ...user, tutorialCompleted: true });
      }
    } catch (err) {
      console.error("Error completing tutorial:", err);
      setTutorialOpen(false);
    }
  };

  const TUTORIAL_SLIDES = [
    {
      icon: "eco",
      title: "Welcome to CarboNudge!",
      text: "Your journey to track and reduce your carbon footprint starts here. Let's take a quick 3-step tour of the application.",
    },
    {
      icon: "add_circle",
      title: "Log Your Activities",
      text: "Quickly log transit distances, meals, and home utilities. We calculate carbon values server-side instantly using scientific impact metrics.",
    },
    {
      icon: "analytics",
      title: "Smart Insights & Habits",
      text: "View AI-driven summaries and personalized recommendations on your Insights tab. Complete daily challenges to grow your Level!",
    },
    {
      icon: "lock",
      title: "Privacy and Community",
      text: "Connect with the community leaderboard. All profile data is shared pseudo-anonymously (hiding emails/identities) to ensure security and compliance.",
    },
  ];

  return (
    <div className="bg-background-subtle text-on-background min-h-screen flex flex-col md:flex-row">
      {/* ── Mobile Top Header ──────────────────────────────────────── */}
      <header className="md:hidden w-full h-16 flex justify-between items-center px-4 bg-surface-white border-b border-outline/10 sticky top-0 z-40">
        <span className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary">
          CarboNudge
        </span>
        <div className="flex items-center gap-3 text-primary">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container-high transition-colors text-primary"
            aria-label="Toggle dark mode"
          >
            <span className="material-symbols-outlined">
              {mounted && theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <span className="material-symbols-outlined">notifications</span>
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
            <span className="font-label-sm text-label-sm text-on-primary font-bold text-[10px]">
              {user?.initials || "EW"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <nav className="hidden md:flex flex-col h-full p-6 space-y-4 bg-surface-container-low border-r border-outline/10 fixed inset-y-0 left-0 w-64 z-30">
        {/* Brand */}
        <div className="mb-6">
          <div className="font-headline-md text-headline-md font-extrabold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>
              eco
            </span>
            CarboNudge
          </div>
        </div>

        {/* User profile */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
            <span className="font-label-sm text-label-sm text-on-primary font-bold text-[11px]">
              {user?.initials || "EW"}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-md text-body-md font-medium text-text-heading truncate">
              {user?.name || "Eco Warrior"}
            </span>
            <span className="font-label-sm text-label-sm text-primary">
              Eco Warrior Lv.{user?.level || 1}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex-1 w-full space-y-1">
          {NAV_LINKS.map(({ href, icon, label }) => {
            const isActive = mounted && (pathname === href || pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "text-primary font-bold bg-surface-container-high"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                <span className="font-label-sm text-label-sm">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Bottom links */}
        <div className="w-full mt-auto pt-4 border-t border-outline/10 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all w-full text-left"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {mounted && theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            <span className="font-label-sm text-label-sm">
              {mounted && theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
          <Link
            href="/profile"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              person
            </span>
            <span className="font-label-sm text-label-sm">Profile</span>
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem("carbonnudge_token");
              window.location.href = "/login";
            }}
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all w-full text-left"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              logout
            </span>
            <span className="font-label-sm text-label-sm">Logout</span>
          </button>
        </div>
      </nav>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 w-full md:ml-64 px-4 md:px-16 py-8 max-w-[1280px] pb-24 md:pb-8">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────── */}
      <nav className="fixed md:hidden bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 h-16 bg-surface-white border-t border-outline/10 shadow-ambient">
        {BOTTOM_NAV.map(({ href, icon, label }) => {
          const isActive = mounted && pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded-full transition-all ${
                isActive
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {icon}
              </span>
              <span className="font-label-xs text-label-xs">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Onboarding Tutorial Modal ───────────────────────────────── */}
      {mounted && tutorialOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-outline-variant/60 dark:border-white/10 rounded-2xl shadow-xl p-8 relative flex flex-col justify-between min-h-[380px] transition-all">
            
            {/* Step indicator */}
            <div className="flex justify-between items-center mb-6">
              <span className="font-label-xs text-xs text-[#154212] dark:text-[#A2D149] bg-[#154212]/10 px-3 py-1 rounded-full font-bold">
                Tour {tutorialStep + 1} of {TUTORIAL_SLIDES.length}
              </span>
            </div>

            {/* Slide details */}
            <div className="flex-1 flex flex-col items-center text-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl text-primary mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
                {TUTORIAL_SLIDES[tutorialStep].icon}
              </span>
              <h3 className="font-headline-md text-xl font-bold text-text-heading mb-3">
                {TUTORIAL_SLIDES[tutorialStep].title}
              </h3>
              <p className="font-body-md text-sm text-on-surface-variant dark:text-on-surface-variant/80 px-2 leading-relaxed">
                {TUTORIAL_SLIDES[tutorialStep].text}
              </p>
            </div>

            {/* Carousel navigation actions */}
            <div className="flex justify-between gap-4 pt-4 border-t border-outline/10">
              <button
                disabled={tutorialStep === 0}
                onClick={() => setTutorialStep(tutorialStep - 1)}
                className="px-4 py-2 border border-outline/20 text-on-surface-variant rounded-xl font-label-sm text-xs hover:bg-surface-container transition-colors disabled:opacity-30"
              >
                Previous
              </button>
              
              {tutorialStep < TUTORIAL_SLIDES.length - 1 ? (
                <button
                  onClick={() => setTutorialStep(tutorialStep + 1)}
                  className="px-5 py-2 bg-primary text-on-primary rounded-xl font-label-sm text-xs hover:opacity-95 transition-opacity"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleCompleteTutorial}
                  className="px-5 py-2 bg-[#A2D149] text-[#131f00] font-bold rounded-xl font-label-sm text-xs hover:opacity-95 transition-opacity"
                >
                  Got it!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
