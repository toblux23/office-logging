"use client";

import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { playTickSound, playShutterSound } from "@/lib/audio";

interface CameraCaptureProps {
  /** Called with the captured base64 data URL, or null when retaken/cleared. */
  onCapture: (image: string | null) => void;
}

const videoConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 960 },
  facingMode: "user",
};

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [image, setImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

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
        setCountdown(0); // Show "Smile! 📸"
        playShutterSound();
        setFlash(true);
        
        // Take screenshot
        const shot = webcamRef.current?.getScreenshot();
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
  }, [countdown, onCapture]);

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
          />
        )}

        {/* Camera Flash Overlay */}
        {flash && (
          <div className="absolute inset-0 bg-white z-30 animate-flash pointer-events-none" />
        )}

        {/* Countdown Overlay */}
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
