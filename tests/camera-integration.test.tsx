import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LogForm from "@/components/kiosk/LogForm";
import type { LogEntry } from "@/lib/supabase";

// ---------- Mocks ----------

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
  playTickSound: vi.fn(),
  playShutterSound: vi.fn(),
  playSuccessSound: vi.fn(),
  playErrorSound: vi.fn(),
}));

const { mockDetectForVideo } = vi.hoisted(() => ({
  mockDetectForVideo: vi.fn(() => ({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] })),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: {
    createFromOptions: vi.fn(() => Promise.resolve({
      close: vi.fn(),
      detectForVideo: mockDetectForVideo,
    })),
  },
  FilesetResolver: {
    forVisionTasks: vi.fn(() => Promise.resolve({})),
  },
}));

// Polyfill requestAnimationFrame for jsdom so MediaPipe tracking callbacks fire
const rAFStub = vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(cb, 16));
const cAFStub = vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

function createMockVideo() {
  let currentTime = 0;
  return {
    videoWidth: 1280,
    videoHeight: 960,
    readyState: 4,
    get currentTime() { return currentTime; },
    set currentTime(v: number) { currentTime = v; },
  };
}

const mockVideo = createMockVideo();
let onUserMediaCallback: (() => void) | null = null;
let onUserMediaErrorCallback: (() => void) | null = null;

vi.mock("react-webcam", () => ({
  default: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    React.useImperativeHandle(ref, () => ({ video: mockVideo }), []);
    const { onUserMedia, onUserMediaError, ...rest } = props as Record<string, unknown>;
    onUserMediaCallback = onUserMedia as () => void;
    onUserMediaErrorCallback = onUserMediaError as () => void;
    return <video data-testid="webcam" {...rest} />;
  }),
}));

// Hoisted mock variables — needed because vi.mock factory is hoisted above imports
const { mockCreateLogs, mockCalculateStreak, mockGetLogs, mockGetNameSuggestions } = vi.hoisted(() => ({
  mockCreateLogs: vi.fn(),
  mockCalculateStreak: vi.fn(),
  mockGetLogs: vi.fn<(limit: number) => Promise<LogEntry[]>>().mockResolvedValue([]),
  mockGetNameSuggestions: vi.fn<() => Promise<Array<{ name: string; role: string }>>>().mockResolvedValue([]),
}));

vi.mock("@/lib/logs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/logs")>("@/lib/logs");
  return {
    ...actual,
    getNameSuggestions: mockGetNameSuggestions,
    getLogs: mockGetLogs,
    calculateStreak: mockCalculateStreak,
    createMultipleLogs: mockCreateLogs,
  };
});

const mockContext: Record<string, unknown> = {};
function setupCanvasMock() {
  Object.assign(mockContext, {
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    filter: "",
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==");
}

beforeEach(() => {
  vi.clearAllMocks();
  setupCanvasMock();
  onUserMediaCallback = null;
  onUserMediaErrorCallback = null;
  mockVideo.videoWidth = 1280;
  mockVideo.videoHeight = 960;
  mockVideo.readyState = 4;

  mockGetLogs.mockResolvedValue([]);
  mockGetNameSuggestions.mockResolvedValue([]);
  mockCalculateStreak.mockReturnValue(0);

  mockDetectForVideo.mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] });
});

afterEach(() => {
  vi.useRealTimers();
});

function simulateCameraReady() {
  act(() => { onUserMediaCallback?.(); });
}

// ---------- Tests ----------

describe("Camera + LogForm Integration", () => {
  it("renders initial action selection state", () => {
    render(<LogForm />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Take Break")).toBeInTheDocument();
    expect(screen.getByText("Log Out")).toBeInTheDocument();
    expect(screen.getByText(/choose session action/i)).toBeInTheDocument();
  });

  it("shows CameraCapture after selecting an action", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await user.click(screen.getByText("Log In"));

    expect(screen.getByText(/webcam verification/i)).toBeInTheDocument();
    expect(screen.getByTestId("webcam")).toBeInTheDocument();
  });

  it("shows photo style and face filter controls after action selection", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await user.click(screen.getByText("Log In"));

    expect(screen.getByText("Photo Style")).toBeInTheDocument();
    expect(screen.getByText("Face Filter")).toBeInTheDocument();
  });

  it("disables save button until camera captures a photo", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await user.click(screen.getByText("Log In"));
    simulateCameraReady();

    const saveBtn = screen.getByRole("button", { name: /save & complete log in/i });
    expect(saveBtn).toBeDisabled();

    // Type a name to fulfill the person requirement
    const nameInput = screen.getByPlaceholderText("e.g. Alex");
    await user.type(nameInput, "Test User");

    // Still disabled because no photo
    expect(saveBtn).toBeDisabled();
  });

  it("capturing photo enables save button and submits logs", async () => {
    const user = userEvent.setup();

    mockGetNameSuggestions.mockResolvedValue([{ name: "Test User", role: "intern" }]);
    mockCreateLogs.mockResolvedValue([
      { id: "1", name: "Test User", type: "login", role: "intern", state: "in_office", image_url: "data:image/png,...", created_at: new Date().toISOString() },
    ] as LogEntry[]);

    render(<LogForm />);
    await user.click(screen.getByText("Log In"));
    simulateCameraReady();

    // Fill in name
    const nameInput = screen.getByPlaceholderText("e.g. Alex");
    await user.type(nameInput, "Test User");

    // Click capture
    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    // Wait for countdown + capture to complete
    await waitFor(() => {
      expect(screen.getByText(/retake/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Save button should now be enabled
    const saveBtn = screen.getByRole("button", { name: /save & complete log in/i });
    expect(saveBtn).toBeEnabled();

    // Submit
    await act(async () => { saveBtn.click(); });

    await waitFor(() => {
      expect(mockCreateLogs).toHaveBeenCalled();
    });
  }, 15000);

  it("captures photo with face effect selected and still submits successfully", async () => {
    const user = userEvent.setup();

    mockGetNameSuggestions.mockResolvedValue([{ name: "Face Test User", role: "intern" }]);
    mockCreateLogs.mockResolvedValue([
      { id: "2", name: "Face Test User", type: "login", role: "intern", state: "in_office", image_url: "data:image/png,...", created_at: new Date().toISOString() },
    ] as LogEntry[]);

    render(<LogForm />);
    await user.click(screen.getByText("Log In"));
    simulateCameraReady();

    // Select a face effect
    const shadesBtn = screen.getByText("Shades");
    await user.click(shadesBtn);

    // Fill in name
    const nameInput = screen.getByPlaceholderText("e.g. Alex");
    await user.type(nameInput, "Face Test User");

    // Capture photo
    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    await waitFor(() => {
      expect(screen.getByText(/retake/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Submit
    const saveBtn = screen.getByRole("button", { name: /save & complete log in/i });
    await act(async () => { saveBtn.click(); });

    await waitFor(() => {
      expect(mockCreateLogs).toHaveBeenCalled();
    });
  }, 15000);

  it("switching photo style updates the webcam filter", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await user.click(screen.getByText("Log In"));
    simulateCameraReady();

    const webcam = screen.getByTestId("webcam");

    // Default style is "Normal" - filter should be "none"
    expect(webcam).toHaveStyle({ filter: "none" });

    // Click "Warm"
    await user.click(screen.getByText("Warm"));
    expect(webcam).toHaveStyle({ filter: "sepia(0.18) saturate(1.35) contrast(1.05) brightness(1.05)" });
  });

  it("shows error state when camera access is denied within LogForm", async () => {
    const user = userEvent.setup();
    render(<LogForm />);

    await user.click(screen.getByText("Log In"));

    act(() => { onUserMediaErrorCallback?.(); });

    expect(screen.getByText(/could not access the camera/i)).toBeInTheDocument();
  });
});
