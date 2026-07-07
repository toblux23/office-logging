"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, IS_MOCK } from "@/lib/supabase";
import { createActivityLog } from "@/lib/logs";
import { playClickSound, playSuccessSound, playErrorSound } from "@/lib/audio";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 500));
        setVerified(true);
        setChecking(false);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getUser();

      if (sessionError || !data.user?.email) {
        setError("Invalid or expired reset link.");
        setChecking(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      let isAdmin = false;
      if (accessToken) {
        try {
          const res = await fetch("/api/admin/verify", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const verifyData = await res.json();
            isAdmin = verifyData.isAdmin;
          }
        } catch (err) {
          console.error("Admin verification error:", err);
        }
      }

      if (!isAdmin) {
        setError("Invalid or expired reset link.");
        setChecking(false);
        return;
      }

      setVerified(true);
      setChecking(false);
    }

    verify();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    playClickSound();

    if (password.length < 6) {
      playErrorSound();
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      playErrorSound();
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    if (IS_MOCK) {
      await new Promise((r) => setTimeout(r, 800));
      setLoading(false);
      playSuccessSound();
      await createActivityLog("PASSWORD_RESET_COMPLETED", "Password reset completed (Local Mock)");
      router.push("/login");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      playErrorSound();
      setError(updateError.message);
      return;
    }

    setLoading(false);
    playSuccessSound();
    await createActivityLog("PASSWORD_RESET_COMPLETED", "Password reset completed");
    router.push("/login");
  }

  if (checking) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12 text-ink-700">
        <div className="z-10 text-center animate-fadeIn">
          <p className="text-sm font-semibold text-ink-500">Verifying your reset link…</p>
        </div>
      </main>
    );
  }

  if (error && !verified) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12 text-ink-700">
        <div className="z-10 flex w-full max-w-sm flex-col gap-4 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn">
          <div className="text-center">
            <p className="text-sm font-semibold text-ink-800">{error}</p>
          </div>
          <Link
            href="/login/forgot-password"
            onClick={playClickSound}
            className="w-full rounded-xl bg-brand-blue-600 py-3.5 text-center font-bold text-white shadow-md shadow-brand-blue-100 transition duration-200 hover:bg-brand-blue-500 active:scale-98 cursor-pointer"
          >
            Request New Link
          </Link>
          <Link
            href="/login"
            onClick={playClickSound}
            className="text-center text-xs font-bold text-ink-500 hover:text-brand-blue-600 transition"
          >
            ← Back to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-hero-grad-a to-hero-grad-b px-4 py-12 text-ink-700">
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-brand-blue-200/25 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-brand-blue-300/20 blur-[100px] pointer-events-none" />

      <div className="z-10 text-center mb-6 animate-fadeIn">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
          Set New Password
        </h1>
        <p className="mt-2 text-sm text-ink-500 max-w-sm mx-auto font-medium">
          Choose a new password for your admin account.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="z-10 flex w-full max-w-sm flex-col gap-4 rounded-[18px] border border-surface-200 bg-white p-6 shadow-[0_12px_30px_-10px_rgba(49,94,239,0.08)] animate-scaleIn"
      >
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-[10px] font-bold text-ink-500 uppercase tracking-wider"
          >
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
            placeholder="••••••••"
            className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="mb-1.5 block text-[10px] font-bold text-ink-500 uppercase tracking-wider"
          >
            Confirm Password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={loading}
            placeholder="••••••••"
            className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2.5 text-sm text-ink-950 outline-none transition focus:border-brand-blue-500 focus:ring-1 focus:ring-brand-blue-500/20"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-brand-blue-50 border border-brand-blue-200 px-4 py-3 text-center text-xs font-bold text-brand-blue-700 animate-fadeIn">
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-blue-600 py-3.5 font-bold text-white shadow-md shadow-brand-blue-100 transition duration-200 hover:bg-brand-blue-500 active:scale-98 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
        >
          {loading ? "Updating…" : "Update Password"}
        </button>

        <Link
          href="/login"
          onClick={playClickSound}
          className="text-center text-xs font-bold text-ink-500 hover:text-brand-blue-600 transition"
        >
          ← Back to Sign In
        </Link>
      </form>
    </main>
  );
}
