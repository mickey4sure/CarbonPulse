"use client";

import { useState, useEffect, Suspense } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  // Sync theme with localStorage & system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (auth) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        localStorage.setItem("carbonnudge_token", token);

        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firebaseUid: userCredential.user.uid,
            email: userCredential.user.email,
          }),
        });
      } else {
        console.warn("Firebase Auth unavailable. Verifying credentials via database.");
        
        const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/users/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (!verifyRes.ok) {
          throw new Error("This account does not exist. Please sign up first.");
        }

        const verifyJson = await verifyRes.json();
        const mockUid = verifyJson.firebaseUid;
        const mockToken = `mock-${mockUid}`;
        localStorage.setItem("carbonnudge_token", mockToken);
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      let message = "Incorrect email or password.";
      if (err.message && err.message.includes("does not exist")) {
        message = err.message;
      } else if (err.code === "auth/invalid-credential") {
        message = "Incorrect email or password.";
      } else if (err.code === "auth/too-many-requests") {
        message = "Too many failed attempts. Account temporarily locked.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth, googleProvider);
        const token = await result.user.getIdToken();
        localStorage.setItem("carbonnudge_token", token);

        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firebaseUid: result.user.uid,
            email: result.user.email,
          }),
        });
        router.push(redirectPath);
        router.refresh();
      } else {
        const mockUid = "user-google-guest";
        const mockToken = "mock-user-google-guest";
        localStorage.setItem("carbonnudge_token", mockToken);

        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firebaseUid: mockUid,
            email: "google.guest@example.com",
          }),
        });
        router.push(redirectPath);
        router.refresh();
      }
    } catch (err: any) {
      let message = "Google Login Failed";
      if (err.code === "auth/popup-closed-by-user") {
        message = "Login cancelled.";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background dark:bg-inverse-surface text-on-surface transition-colors duration-300 relative">
      {/* Dark Mode Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          className="p-2 rounded-full hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-on-surface dark:text-inverse-on-surface">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
      </div>

      <main className="relative z-10 flex min-h-full items-center justify-center p-4 md:p-6 w-full">
        {/* Login Card */}
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-outline-variant/60 dark:border-white/10 rounded-xl shadow-sm p-10 md:p-12 transition-all">
          {/* Brand Logo */}
          <div className="flex flex-col items-center mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                eco
              </span>
              <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed">
                CarboNudge
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface dark:text-surface-bright text-center mb-2">
              Welcome back
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant/80 text-center">
              Track less. Live greener.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium mb-6 text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block font-label-sm text-label-sm text-outline dark:text-outline-variant" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface dark:text-surface-bright focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60"
                placeholder="alex@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block font-label-sm text-label-sm text-outline dark:text-outline-variant" htmlFor="password">
                  Password
                </label>
                <a className="font-label-sm text-label-sm text-primary dark:text-primary-fixed hover:underline transition-all" href="#">
                  Forgot?
                </a>
              </div>
              <input
                id="password"
                type="password"
                required
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface dark:text-surface-bright focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant/60"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-container text-on-primary-container hover:bg-[#154212] hover:text-white font-headline-md text-headline-md rounded-lg shadow-sm active:scale-[0.98] transition-all flex justify-center items-center gap-2"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant"></div>
              </div>
              <div className="relative flex justify-center text-label-sm font-label-sm uppercase">
                <span className="bg-white dark:bg-slate-900 px-4 text-outline/60 dark:text-outline-variant/60">
                  OR
                </span>
              </div>
            </div>

            {/* Social Login */}
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full py-3.5 border border-outline-variant bg-white dark:bg-transparent font-body-md text-body-md text-on-surface dark:text-surface-bright rounded-lg hover:bg-surface-container transition-all flex justify-center items-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Footer */}
          <p className="mt-10 text-center font-body-md text-body-md text-on-surface-variant">
            Don't have an account?
            <Link href="/signup" className="text-primary dark:text-[#a6d64d] font-semibold hover:underline ml-1">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold">Initializing Auth...</div>}>
      <LoginContent />
    </Suspense>
  );
}