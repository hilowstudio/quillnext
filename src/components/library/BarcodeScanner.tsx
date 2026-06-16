"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Barcode } from "@phosphor-icons/react";

interface BarcodeScannerProps {
  /** Called once a valid EAN-13 / UPC-A (ISBN) barcode has been decoded. */
  onIsbn: (isbn: string) => void;
}

// Minimal typings for the experimental BarcodeDetector API (not in lib.dom yet).
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/** Normalise a scanned code down to ISBN digits (with trailing X allowed). */
function cleanIsbn(raw: string): string {
  return raw.replace(/[^0-9X]/gi, "").toUpperCase();
}

/** A scanned 13-digit code is a book ISBN only when it is a Bookland EAN (978/979). */
function isLikelyIsbn(code: string): boolean {
  const c = cleanIsbn(code);
  if (c.length === 10) return true;
  if (c.length === 13) return c.startsWith("978") || c.startsWith("979");
  return false;
}

export function BarcodeScanner({ onIsbn }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fallbackScannerRef = useRef<{ stop: () => Promise<void>; clear?: () => void } | null>(null);
  const fallbackContainerRef = useRef<HTMLDivElement | null>(null);
  const handledRef = useRef(false);

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const stopCamera = useCallback(async () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (fallbackScannerRef.current) {
      try {
        await fallbackScannerRef.current.stop();
        fallbackScannerRef.current.clear?.();
      } catch {
        // ignore — scanner may already be stopped
      }
      fallbackScannerRef.current = null;
    }
    setActive(false);
  }, []);

  const handleDecoded = useCallback(
    (raw: string) => {
      if (handledRef.current) return;
      if (!isLikelyIsbn(raw)) return;
      handledRef.current = true;
      void stopCamera();
      onIsbn(cleanIsbn(raw));
    },
    [onIsbn, stopCamera]
  );

  // Native BarcodeDetector path.
  const startNative = useCallback(
    async (Detector: BarcodeDetectorCtor) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = new Detector({ formats: ["ean_13", "upc_a"] });

      const tick = async () => {
        if (handledRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            handleDecoded(codes[0].rawValue);
            return;
          }
        } catch {
          // transient detect failure — keep scanning
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      rafRef.current = requestAnimationFrame(() => void tick());
    },
    [handleDecoded]
  );

  // html5-qrcode fallback path (dynamically imported so it never runs at SSR).
  const startFallback = useCallback(async () => {
    setUsingFallback(true);
    const mod = await import("html5-qrcode");
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = mod;

    const container = fallbackContainerRef.current;
    if (!container) return;
    // Ensure the container has an id the library can target.
    if (!container.id) container.id = "qc-barcode-fallback";

    const scanner = new Html5Qrcode(container.id, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A,
      ],
      verbose: false,
    });
    fallbackScannerRef.current = scanner;

    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText: string) => handleDecoded(decodedText),
      () => {
        // per-frame decode failure — ignore
      }
    );
  }, [handleDecoded]);

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;
    setError(null);
    handledRef.current = false;
    setActive(true);

    const hasUserMedia =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";

    if (!hasUserMedia) {
      setError("Camera access is not available in this browser. Enter the ISBN manually below.");
      setActive(false);
      return;
    }

    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
        .BarcodeDetector;
      if (Detector) {
        await startNative(Detector);
      } else {
        await startFallback();
      }
    } catch (err) {
      console.error("Barcode scanner failed to start:", err);
      // If the native path failed unexpectedly, try the fallback before giving up.
      if (!usingFallback && !fallbackScannerRef.current) {
        try {
          await stopCamera();
          handledRef.current = false;
          setActive(true);
          await startFallback();
          return;
        } catch (fallbackErr) {
          console.error("Fallback barcode scanner failed:", fallbackErr);
        }
      }
      setError("Could not start the camera. Check permissions or enter the ISBN manually below.");
      setActive(false);
    }
  }, [startNative, startFallback, stopCamera, usingFallback]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-qc-border-subtle bg-black/90 aspect-video flex items-center justify-center">
        {/* Native preview */}
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${active && !usingFallback ? "block" : "hidden"}`}
          playsInline
          muted
        />
        {/* Fallback library renders its own <video> into this container */}
        <div
          ref={fallbackContainerRef}
          className={`h-full w-full ${active && usingFallback ? "block" : "hidden"}`}
        />
        {!active && (
          <div className="flex flex-col items-center text-center text-white/80 p-6">
            <Barcode className="w-12 h-12 mb-2" />
            <span className="text-sm">Point your camera at the book&apos;s barcode</span>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80" />
        )}
      </div>

      {error && (
        <p className="text-xs text-qc-warning-text bg-qc-warning-bg border border-qc-warning-border rounded-md p-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {!active ? (
          <Button type="button" className="flex-1" onClick={() => void start()}>
            Start Scanning
          </Button>
        ) : (
          <Button type="button" variant="outline" className="flex-1" onClick={() => void stopCamera()}>
            Stop Camera
          </Button>
        )}
      </div>

      <p className="text-xs text-qc-text-muted">
        Reads EAN-13 / UPC-A book barcodes. If scanning is not supported, use manual entry below.
      </p>
    </div>
  );
}
