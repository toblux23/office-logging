import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import AdminLoginPage from "@/components/admin/AdminLoginPage";

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
  playSuccessSound: vi.fn(),
  playErrorSound: vi.fn(),
}));

const mockCreateActivityLog = vi.fn();
const mockGetAdminConfig = vi.fn();

vi.mock("@/lib/logs", () => ({
  createActivityLog: (...args: unknown[]) => mockCreateActivityLog(...args),
  getAdminConfig: (...args: unknown[]) => mockGetAdminConfig(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
  },
  IS_MOCK: true,
}));

describe("AdminLoginPage (Mock Mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetAdminConfig.mockResolvedValue({ email: "admin@startuplab.com", created_at: new Date().toISOString() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the login form", () => {
    render(<AdminLoginPage />);
    expect(screen.getByText("Admin Portal")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("admin@startuplab.com")).toBeInTheDocument();
  });

  it("shows demo mode hint", () => {
    render(<AdminLoginPage />);
    expect(screen.getByText(/Local demo/i)).toBeInTheDocument();
  });

  it("shows back to kiosk link", () => {
    render(<AdminLoginPage />);
    expect(screen.getByText(/Back to Kiosk Logins/i)).toBeInTheDocument();
  });

  it("shows forgot password link", () => {
    render(<AdminLoginPage />);
    expect(screen.getByText("Forgot Password?")).toBeInTheDocument();
  });

  it("shows error for empty email and short password", async () => {
    render(<AdminLoginPage />);
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);
    expect(await screen.findByText(/Email is required/i)).toBeInTheDocument();
  });

  it("accepts valid credentials in mock mode", async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@startuplab.com");
    await user.type(screen.getByLabelText("Password"), "admin123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/logs");
    }, { timeout: 2000 });
  });

  it("shows error for invalid credentials in mock mode", async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.type(screen.getByLabelText("Email"), "wrong@test.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("shows CAPTCHA after 3 failed attempts", async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    for (let i = 0; i < 3; i++) {
      await user.clear(emailInput);
      await user.clear(passwordInput);
      await user.type(emailInput, `wrong${i}@test.com`);
      await user.type(passwordInput, "wrongpass");
      await user.click(screen.getByText("Sign In"));
      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    }

    expect(screen.getByText(/Prove you are human/i)).toBeInTheDocument();
  });

  it("rejects incorrect CAPTCHA answer", async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    for (let i = 0; i < 3; i++) {
      await user.clear(emailInput);
      await user.clear(passwordInput);
      await user.type(emailInput, `wrong${i}@test.com`);
      await user.type(passwordInput, "wrongpass");
      await user.click(screen.getByText("Sign In"));
      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    }

    await user.clear(emailInput);
    await user.clear(passwordInput);
    await user.type(emailInput, "admin@startuplab.com");
    await user.type(passwordInput, "admin123");

    const captchaInput = screen.getByRole("spinbutton");
    await user.type(captchaInput, "999");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText(/Incorrect CAPTCHA/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("shows error when admin not configured", async () => {
    mockGetAdminConfig.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.type(screen.getByLabelText("Email"), "admin@startuplab.com");
    await user.type(screen.getByLabelText("Password"), "admin123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText(/Admin account not configured/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
