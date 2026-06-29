import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import CameraCapture from "@/components/shared/CameraCapture";

// ---------- Mocks ----------

const { mockDetectForVideo } = vi.hoisted(() => ({
  mockDetectForVideo: vi.fn(() => ({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] })),
}));

vi.mock("@/lib/audio", () => ({
  playClickSound: vi.fn(),
  playTickSound: vi.fn(),
  playShutterSound: vi.fn(),
  playSuccessSound: vi.fn(),
  playErrorSound: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FaceLandmarker: {
    createFromOptions: vi.fn(() => Promise.resolve({ close: vi.fn(), detectForVideo: mockDetectForVideo })),
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

  mockDetectForVideo.mockReturnValue({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------- Helpers ----------

function simulateCameraReady() {
  act(() => { onUserMediaCallback?.(); });
}

// ---------- Tests ----------

describe("CameraCapture", () => {
  it("renders the webcam view initially", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    expect(screen.getByTestId("webcam")).toBeInTheDocument();
  });

  it("shows a loading state before camera is ready", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    expect(screen.getByText("Initializing lens…")).toBeInTheDocument();
  });

  it("hides loading state once the camera is ready", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    simulateCameraReady();
    expect(screen.queryByText("Initializing lens…")).not.toBeInTheDocument();
  });

  it("disables capture button when camera is not ready", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    expect(captureBtn).toBeDisabled();
  });

  it("enables capture button when camera is ready", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    simulateCameraReady();
    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    expect(captureBtn).toBeEnabled();
  });

  it("renders all 6 photo style buttons", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Warm")).toBeInTheDocument();
    expect(screen.getByText("Cool")).toBeInTheDocument();
    expect(screen.getByText("Vintage")).toBeInTheDocument();
    expect(screen.getByText("Mono")).toBeInTheDocument();
    expect(screen.getByText("Bright")).toBeInTheDocument();
  });

  it("renders all 5 face effect buttons", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Shades")).toBeInTheDocument();
    expect(screen.getByText("Blush")).toBeInTheDocument();
    expect(screen.getByText("Sparkle")).toBeInTheDocument();
    expect(screen.getByText("Dog")).toBeInTheDocument();
  });

  it("selects a photo style on click", async () => {
    const user = userEvent.setup();
    render(<CameraCapture onCapture={vi.fn()} />);
    simulateCameraReady();

    const warmBtn = screen.getByText("Warm");
    await user.click(warmBtn);

    expect(warmBtn.closest("button")).toHaveClass("border-brand-blue-500");
  });

  it("selects a face effect on click", async () => {
    const user = userEvent.setup();
    render(<CameraCapture onCapture={vi.fn()} />);
    simulateCameraReady();

    const shadesBtn = screen.getByText("Shades");
    await user.click(shadesBtn);

    expect(shadesBtn.closest("button")).toHaveClass("border-brand-blue-500");
  });

  it("performs a countdown and fires onCapture when capture is clicked", async () => {
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} />);
    simulateCameraReady();

    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    // Countdown numbers should appear
    await waitFor(() => { expect(screen.getByText("3")).toBeInTheDocument(); }, { timeout: 2000 });

    // Wait for full countdown (3s) + flash (600ms)
    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledWith(expect.stringContaining("data:image/png"));
    }, { timeout: 10000 });
  }, 15000);

  it("shows retake button after capture", async () => {
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} />);
    simulateCameraReady();

    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    await waitFor(() => {
      expect(screen.getByText(/retake/i)).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it("retake clears the image and shows webcam again", async () => {
    const user = userEvent.setup();
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} />);
    simulateCameraReady();

    // Capture
    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    await waitFor(() => {
      expect(screen.getByText(/retake/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    // Retake
    const retakeBtn = screen.getByText(/retake/i);
    await user.click(retakeBtn);

    expect(screen.getByTestId("webcam")).toBeInTheDocument();
    expect(screen.queryByText(/retake/i)).not.toBeInTheDocument();
  }, 15000);

  it("shows camera access error when onUserMediaError fires", () => {
    render(<CameraCapture onCapture={vi.fn()} />);
    act(() => { onUserMediaErrorCallback?.(); });
    expect(screen.getByText(/could not access the camera/i)).toBeInTheDocument();
  });

  it("blocks capture and shows error when no face is detected", async () => {
    mockDetectForVideo.mockReturnValue({ faceLandmarks: [] });
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} />);
    simulateCameraReady();

    const captureBtn = screen.getByRole("button", { name: /capture photo/i });
    await act(async () => { captureBtn.click(); });

    await waitFor(() => {
      expect(screen.getByText(/no face detected/i)).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(onCapture).not.toHaveBeenCalled();
  }, 15000);
});
