"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { playTickSound, playShutterSound } from "@/lib/audio";

interface CameraCaptureProps {
  onCapture: (image: string | null) => void;
}

const videoConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 960 },
  facingMode: "user",
};

type PhotoStyle = "normal" | "warm" | "cool" | "vintage" | "mono" | "bright";
type FaceEffect = "none" | "sunglasses" | "blush" | "sparkle" | "mask";

interface FaceAnchor {
  centerX: number;
  eyeY: number;
  cheekY: number;
  width: number;
  height: number;
}

const PHOTO_STYLES: Array<{ id: PhotoStyle; label: string; filter: string; swatch: string }> = [
  { id: "normal", label: "Normal", filter: "none", swatch: "bg-surface-100" },
  { id: "warm", label: "Warm", filter: "sepia(0.18) saturate(1.35) contrast(1.05) brightness(1.05)", swatch: "bg-amber-200" },
  { id: "cool", label: "Cool", filter: "saturate(1.15) hue-rotate(188deg) brightness(1.03)", swatch: "bg-sky-200" },
  { id: "vintage", label: "Vintage", filter: "sepia(0.42) contrast(0.98) saturate(1.25) brightness(1.03)", swatch: "bg-orange-200" },
  { id: "mono", label: "Mono", filter: "grayscale(1) contrast(1.12) brightness(1.05)", swatch: "bg-zinc-300" },
  { id: "bright", label: "Bright", filter: "brightness(1.16) contrast(1.04) saturate(1.18)", swatch: "bg-emerald-200" },
];

const FACE_EFFECTS: Array<{ id: FaceEffect; label: string }> = [
  { id: "none", label: "None" },
  { id: "sunglasses", label: "Shades" },
  { id: "blush", label: "Blush" },
  { id: "sparkle", label: "Sparkle" },
  { id: "mask", label: "Face Frame" },
];

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const VISION_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  context.moveTo(x, y - radius);
  context.lineTo(x + radius * 0.22, y - radius * 0.22);
  context.lineTo(x + radius, y);
  context.lineTo(x + radius * 0.22, y + radius * 0.22);
  context.lineTo(x, y + radius);
  context.lineTo(x - radius * 0.22, y + radius * 0.22);
  context.lineTo(x - radius, y);
  context.lineTo(x - radius * 0.22, y - radius * 0.22);
  context.closePath();
}

function drawFaceEffect(context: CanvasRenderingContext2D, effect: FaceEffect, face: FaceAnchor | null, width: number, height: number) {
  if (effect === "none") return;

  const anchor =
    face ??
    ({
      centerX: 0.5,
      eyeY: 0.42,
      cheekY: 0.58,
      width: 0.34,
      height: 0.44,
    } satisfies FaceAnchor);

  const faceWidth = anchor.width * width;
  const faceHeight = anchor.height * height;
  const centerX = anchor.centerX * width;
  const eyeY = anchor.eyeY * height;
  const cheekY = anchor.cheekY * height;

  context.save();

  if (effect === "sunglasses") {
    const lensWidth = faceWidth * 0.31;
    const lensHeight = faceHeight * 0.13;
    const bridgeWidth = faceWidth * 0.14;
    const leftX = centerX - lensWidth - bridgeWidth * 0.5;
    const rightX = centerX + bridgeWidth * 0.5;
    const y = eyeY - lensHeight * 0.5;

    context.fillStyle = "rgba(15, 23, 42, 0.92)";
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.lineWidth = Math.max(3, width * 0.004);
    drawRoundedRect(context, leftX, y, lensWidth, lensHeight, lensHeight * 0.45);
    context.fill();
    context.stroke();
    drawRoundedRect(context, rightX, y, lensWidth, lensHeight, lensHeight * 0.45);
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(15, 23, 42, 0.92)";
    context.lineWidth = Math.max(5, width * 0.006);
    context.beginPath();
    context.moveTo(leftX + lensWidth, eyeY);
    context.lineTo(rightX, eyeY);
    context.stroke();
  }

  if (effect === "blush") {
    const cheekRadius = faceWidth * 0.12;
    context.fillStyle = "rgba(244, 114, 182, 0.34)";
    context.beginPath();
    context.ellipse(centerX - faceWidth * 0.24, cheekY, cheekRadius, cheekRadius * 0.62, -0.12, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(centerX + faceWidth * 0.24, cheekY, cheekRadius, cheekRadius * 0.62, 0.12, 0, Math.PI * 2);
    context.fill();
  }

  if (effect === "sparkle") {
    const sparkleColor = "rgba(255, 255, 255, 0.92)";
    const glowColor = "rgba(74, 114, 241, 0.28)";
    const points = [
      [centerX - faceWidth * 0.43, eyeY - faceHeight * 0.28, faceWidth * 0.08],
      [centerX + faceWidth * 0.42, eyeY - faceHeight * 0.22, faceWidth * 0.06],
      [centerX - faceWidth * 0.35, cheekY + faceHeight * 0.13, faceWidth * 0.05],
      [centerX + faceWidth * 0.32, cheekY + faceHeight * 0.1, faceWidth * 0.075],
    ];

    for (const [x, y, radius] of points) {
      context.fillStyle = glowColor;
      context.beginPath();
      context.arc(x, y, radius * 1.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = sparkleColor;
      drawStar(context, x, y, radius);
      context.fill();
    }
  }

  if (effect === "mask") {
    const frameWidth = faceWidth * 0.82;
    const frameHeight = faceHeight * 0.96;
    const y = eyeY - frameHeight * 0.37;

    context.strokeStyle = "rgba(255, 255, 255, 0.86)";
    context.lineWidth = Math.max(5, width * 0.006);
    context.shadowColor = "rgba(49, 94, 239, 0.42)";
    context.shadowBlur = Math.max(12, width * 0.015);
    context.beginPath();
    context.ellipse(centerX, y + frameHeight * 0.5, frameWidth * 0.5, frameHeight * 0.5, 0, 0, Math.PI * 2);
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(49, 94, 239, 0.16)";
    context.beginPath();
    context.ellipse(centerX, y + frameHeight * 0.5, frameWidth * 0.5, frameHeight * 0.5, 0, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const trackingFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const [image, setImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<PhotoStyle>("normal");
  const [selectedFaceEffect, setSelectedFaceEffect] = useState<FaceEffect>("none");
  const [faceAnchor, setFaceAnchor] = useState<FaceAnchor | null>(null);
  const [trackingReady, setTrackingReady] = useState(false);

  const selectedPhotoStyle = PHOTO_STYLES.find((style) => style.id === selectedStyle) ?? PHOTO_STYLES[0];

  useEffect(() => {
    let cancelled = false;

    if (selectedFaceEffect === "none" || landmarkerRef.current) {
      return () => {
        cancelled = true;
      };
    }

    async function loadFaceTracking() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH);
        const landmarkerOptions = {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL,
            delegate: "GPU" as const,
          },
          runningMode: "VIDEO" as const,
          numFaces: 1,
        };
        const landmarker = await FaceLandmarker.createFromOptions(vision, landmarkerOptions).catch(() =>
          FaceLandmarker.createFromOptions(vision, {
            ...landmarkerOptions,
            baseOptions: {
              modelAssetPath: FACE_LANDMARKER_MODEL,
              delegate: "CPU",
            },
          }),
        );

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setTrackingReady(true);
      } catch (trackingError) {
        console.warn("Face tracking could not be initialized:", trackingError);
        setTrackingReady(false);
      }
    }

    loadFaceTracking();

    return () => {
      cancelled = true;
      if (trackingFrameRef.current !== null) {
        cancelAnimationFrame(trackingFrameRef.current);
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [selectedFaceEffect]);

  useEffect(() => {
    if (!cameraReady || !trackingReady || image) return;

    const trackFace = () => {
      const video = webcamRef.current?.video;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;

        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result.faceLandmarks[0];

          if (landmarks?.length) {
            const mirroredX = landmarks.map((landmark) => 1 - landmark.x);
            const yValues = landmarks.map((landmark) => landmark.y);
            const minX = Math.min(...mirroredX);
            const maxX = Math.max(...mirroredX);
            const minY = Math.min(...yValues);
            const maxY = Math.max(...yValues);
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];

            setFaceAnchor({
              centerX: clamp((minX + maxX) / 2, 0, 1),
              eyeY: clamp(leftEye && rightEye ? (leftEye.y + rightEye.y) / 2 : minY + (maxY - minY) * 0.35, 0, 1),
              cheekY: clamp(minY + (maxY - minY) * 0.58, 0, 1),
              width: clamp((maxX - minX) * 1.08, 0.16, 0.8),
              height: clamp((maxY - minY) * 1.08, 0.18, 0.9),
            });
          } else {
            setFaceAnchor(null);
          }
        } catch (trackingError) {
          console.warn("Face tracking frame failed:", trackingError);
        }
      }

      trackingFrameRef.current = requestAnimationFrame(trackFace);
    };

    trackingFrameRef.current = requestAnimationFrame(trackFace);

    return () => {
      if (trackingFrameRef.current !== null) {
        cancelAnimationFrame(trackingFrameRef.current);
      }
    };
  }, [cameraReady, image, trackingReady]);

  const captureFilteredImage = useCallback(() => {
    const video = webcamRef.current?.video;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.filter = selectedPhotoStyle.filter;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    drawFaceEffect(context, selectedFaceEffect, faceAnchor, canvas.width, canvas.height);

    return canvas.toDataURL("image/png", 1);
  }, [faceAnchor, selectedFaceEffect, selectedPhotoStyle.filter]);

  const startCountdown = useCallback(() => {
    if (countdown !== null) return;

    setCountdown(3);
    playTickSound();

    let current = 3;
    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        playTickSound();
      } else {
        clearInterval(interval);
        setCountdown(0);
        playShutterSound();
        setFlash(true);

        const shot = captureFilteredImage();
        setTimeout(() => {
          setFlash(false);
          setCountdown(null);
          if (shot) {
            setImage(shot);
            onCapture(shot);
          }
        }, 600);
      }
    }, 1000);
  }, [captureFilteredImage, countdown, onCapture]);

  const retake = useCallback(() => {
    setImage(null);
    onCapture(null);
  }, [onCapture]);

  return (
    <div className="flex flex-col items-center gap-4 w-full animate-fadeIn">
      <div className="relative w-full max-w-[480px] aspect-[4/3] overflow-hidden rounded-[18px] border border-surface-200 bg-surface-100 shadow-inner">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt="Captured"
            className="h-full w-full object-cover"
          />
        ) : (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/png"
            screenshotQuality={1}
            mirrored
            videoConstraints={videoConstraints}
            onUserMedia={() => {
              setCameraReady(true);
              setError(null);
            }}
            onUserMediaError={() =>
              setError("Could not access the camera. Check browser permissions.")
            }
            className="h-full w-full object-cover"
            style={{ filter: selectedPhotoStyle.filter }}
          />
        )}

        {!image && selectedFaceEffect !== "none" && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <LiveFaceEffect effect={selectedFaceEffect} face={faceAnchor} trackingReady={trackingReady} />
          </div>
        )}

        {flash && (
          <div className="absolute inset-0 bg-white z-30 animate-flash pointer-events-none" />
        )}

        {countdown !== null && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-blue-950/35 animate-fadeIn">
            <span className="rounded-2xl bg-brand-blue-950/80 px-8 py-5 text-5xl font-display font-extrabold text-white tracking-widest shadow-lg animate-bounceScale">
              {countdown === 0 ? "SMILE! 📸" : countdown}
            </span>
          </div>
        )}

        {!image && !cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-ink-500 bg-surface-50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-brand-blue-600" />
            Initializing lens…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-brand-blue-700 bg-brand-blue-50 border border-brand-blue-100">
            ⚠️ {error}
          </div>
        )}
      </div>

      {!image && (
        <div className="flex w-full max-w-[480px] flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Photo Style</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PHOTO_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-bold transition ${
                    selectedStyle === style.id
                      ? "border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700 shadow-sm"
                      : "border-surface-200 bg-white text-ink-500 hover:border-brand-blue-200"
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full border border-white shadow-sm ${style.swatch}`} />
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Face Filter</span>
              {selectedFaceEffect !== "none" && (
                <span className="text-[10px] font-semibold text-ink-400">
                  {trackingReady ? (faceAnchor ? "Tracking face" : "Find a face") : "Loading tracker"}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {FACE_EFFECTS.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => setSelectedFaceEffect(effect.id)}
                  className={`min-h-10 cursor-pointer rounded-xl border px-2 py-2 text-[10px] font-bold transition ${
                    selectedFaceEffect === effect.id
                      ? "border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700 shadow-sm"
                      : "border-surface-200 bg-white text-ink-500 hover:border-brand-blue-200"
                  }`}
                >
                  {effect.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {image ? (
        <button
          type="button"
          onClick={retake}
          className="w-full max-w-[200px] rounded-xl border border-surface-200 bg-white py-2.5 text-xs font-bold text-ink-700 transition hover:bg-surface-50 hover:text-brand-blue-600 shadow-sm cursor-pointer"
        >
          🔄 Retake photo
        </button>
      ) : (
        <button
          type="button"
          onClick={startCountdown}
          disabled={!cameraReady || countdown !== null}
          className="w-full max-w-[280px] rounded-xl bg-brand-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-brand-blue-100 hover:bg-brand-blue-500 active:scale-98 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {countdown !== null ? "Preparing Shutter…" : "📷 Capture Photo"}
        </button>
      )}
    </div>
  );
}

function LiveFaceEffect({ effect, face, trackingReady }: { effect: FaceEffect; face: FaceAnchor | null; trackingReady: boolean }) {
  const anchor =
    face ??
    ({
      centerX: 0.5,
      eyeY: 0.42,
      cheekY: 0.58,
      width: 0.34,
      height: 0.44,
    } satisfies FaceAnchor);

  const faceWidth = anchor.width * 100;
  const faceHeight = anchor.height * 100;
  const centerX = anchor.centerX * 100;
  const eyeY = anchor.eyeY * 100;
  const cheekY = anchor.cheekY * 100;
  const opacityClass = trackingReady && !face ? "opacity-45" : "opacity-100";

  if (effect === "sunglasses") {
    return (
      <div className={`absolute ${opacityClass}`} style={{ left: `${centerX}%`, top: `${eyeY}%`, width: `${faceWidth * 0.76}%`, height: `${faceHeight * 0.16}%`, transform: "translate(-50%, -50%)" }}>
        <div className="absolute left-0 top-0 h-full w-[42%] rounded-[40%] border-2 border-white/70 bg-ink-900/90 shadow-md" />
        <div className="absolute right-0 top-0 h-full w-[42%] rounded-[40%] border-2 border-white/70 bg-ink-900/90 shadow-md" />
        <div className="absolute left-[40%] top-1/2 h-[18%] w-[20%] -translate-y-1/2 rounded-full bg-ink-900/90" />
      </div>
    );
  }

  if (effect === "blush") {
    return (
      <div className={`absolute inset-0 ${opacityClass}`}>
        <span className="absolute rounded-full bg-pink-400/35 blur-[1px]" style={{ left: `${centerX - faceWidth * 0.24}%`, top: `${cheekY}%`, width: `${faceWidth * 0.22}%`, height: `${faceHeight * 0.13}%`, transform: "translate(-50%, -50%) rotate(-8deg)" }} />
        <span className="absolute rounded-full bg-pink-400/35 blur-[1px]" style={{ left: `${centerX + faceWidth * 0.24}%`, top: `${cheekY}%`, width: `${faceWidth * 0.22}%`, height: `${faceHeight * 0.13}%`, transform: "translate(-50%, -50%) rotate(8deg)" }} />
      </div>
    );
  }

  if (effect === "sparkle") {
    const points = [
      [centerX - faceWidth * 0.43, eyeY - faceHeight * 0.28, faceWidth * 0.08],
      [centerX + faceWidth * 0.42, eyeY - faceHeight * 0.22, faceWidth * 0.06],
      [centerX - faceWidth * 0.35, cheekY + faceHeight * 0.13, faceWidth * 0.05],
      [centerX + faceWidth * 0.32, cheekY + faceHeight * 0.1, faceWidth * 0.075],
    ];

    return (
      <div className={`absolute inset-0 ${opacityClass}`}>
        {points.map(([left, top, size], index) => (
          <span
            key={`${left}-${top}-${index}`}
            className="absolute block rotate-45 bg-white shadow-[0_0_14px_rgba(74,114,241,0.7)]"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}%`,
              height: `${size}%`,
              clipPath: "polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)",
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
        ))}
      </div>
    );
  }

  if (effect === "mask") {
    return (
      <div
        className={`absolute rounded-[50%] border-[3px] border-white/85 bg-brand-blue-500/15 shadow-[0_0_22px_rgba(49,94,239,0.42)] ${opacityClass}`}
        style={{
          left: `${centerX}%`,
          top: `${eyeY + faceHeight * 0.13}%`,
          width: `${faceWidth * 0.82}%`,
          height: `${faceHeight * 0.96}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
    );
  }

  return null;
}
