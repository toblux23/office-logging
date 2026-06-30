import { describe, expect, it, vi, beforeEach } from "vitest";

describe("IS_MOCK detection", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects mock mode when env vars are placeholders", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon-key");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(true);
  });

  it("detects mock mode when env vars are missing", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(true);
  });

  it("detects mock mode when only URL is placeholder", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "real-key");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(true);
  });

  it("detects mock mode when only anon key is placeholder", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://real-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon-key");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(true);
  });

  it("detects production mode when real env vars are set", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://real-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-key");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(false);
  });

  it("handles missing NEXT_PUBLIC_SUPABASE_URL", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "some-key");
    const { IS_MOCK } = await import("@/lib/supabase");
    expect(IS_MOCK).toBe(true);
  });

  it("exports all expected types", async () => {
    vi.resetModules();
    const supabaseModule = await import("@/lib/supabase");
    expect(supabaseModule.supabase).toBeDefined();
    expect(typeof supabaseModule.IS_MOCK).toBe("boolean");
  });
});
