import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Droplets, ImagePlus, Lightbulb, Milk, FlaskConical, Soup } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useI18n } from "@/hooks/useI18n";
import { analyzeIodineTest } from "@/services/iodineApi";
import { classifyIodineColor, sampleCenterColor } from "@/utils/iodineColor";
import type { IodineApiResult, IodineFood } from "@/types/product";

type PurityTestScreenProps = {
  presetFood?: IodineFood;
  productName?: string | null;
  onBack: () => void;
  onComplete: (
    result: IodineApiResult,
    food: IodineFood,
    imageDataUrl: string,
    source: "ai" | "device"
  ) => void;
};

type Step = "pick" | "capture";

const FOODS: { id: IodineFood; icon: typeof Milk }[] = [
  { id: "milk", icon: Milk },
  { id: "ghee", icon: Soup },
  { id: "other", icon: FlaskConical }
];

export function PurityTestScreen({
  presetFood,
  productName,
  onBack,
  onComplete
}: PurityTestScreenProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(presetFood ? "capture" : "pick");
  const [food, setFood] = useState<IodineFood>(presetFood || "milk");
  const [cameraReady, setCameraReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start / stop the camera when on the capture step.
  useEffect(() => {
    if (step !== "capture") return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } }
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          video.muted = true;
          await video.play();
          setCameraReady(true);
        }
      } catch {
        // No camera (or denied) — upload still works.
        setCameraReady(false);
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setCameraReady(false);
    };
  }, [step]);

  // Crop the centre square of a source (video/image) into a canvas so the
  // sample dominates the frame, then run the hybrid analysis.
  async function analyzeFromSource(
    source: HTMLVideoElement | HTMLImageElement,
    sw: number,
    sh: number
  ) {
    const side = Math.floor(Math.min(sw, sh) * 0.85);
    const sx = Math.floor((sw - side) / 2);
    const sy = Math.floor((sh - side) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setError(t("scanFailed"));
      return;
    }
    ctx.drawImage(source, sx, sy, side, side, 0, 0, side, side);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    setAnalyzing(true);
    setError(null);
    try {
      // 1. On-device colour read (instant).
      const rgb = sampleCenterColor(canvas);
      const device = rgb ? classifyIodineColor(rgb) : null;

      // 2. Hybrid: trust a clearly-amber / clearly-blue-black read; otherwise
      //    confirm with the vision API.
      if (device && device.clear) {
        const { clear, ...result } = device;
        onComplete(result, food, imageDataUrl, "device");
        return;
      }

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("capture failed"))),
          "image/jpeg",
          0.85
        )
      );
      const aiResult = await analyzeIodineTest({ image: blob, food });
      onComplete(aiResult, food, imageDataUrl, "ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scanFailed"));
    } finally {
      setAnalyzing(false);
    }
  }

  function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError(t("cameraError"));
      return;
    }
    analyzeFromSource(video, video.videoWidth, video.videoHeight);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      analyzeFromSource(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setError(t("scanFailed"));
    img.src = url;
  }

  // --- Step 1: pick the food ---
  if (step === "pick") {
    return (
      <main className="h-full w-full overflow-y-auto no-scrollbar px-4 pb-28 pt-4 safe-top">
        <header className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm dark:bg-white/10 dark:text-white"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">
              {t("purityTitle")}
            </h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">
              {t("purityPickTitle")}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {FOODS.map(({ id, icon: Icon }) => {
            const active = food === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFood(id)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-3xl border p-4 transition ${
                  active
                    ? "border-guard-500 bg-guard-50 dark:border-guard-500 dark:bg-guard-900/40"
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]"
                }`}
              >
                <span
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${
                    active
                      ? "bg-guard-500 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {t(`food_${id}` as "food_milk")}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="mt-5">
          <div className="mb-3 flex items-center gap-2">
            <Droplets className="h-5 w-5 text-guard-600 dark:text-guard-300" />
            <h2 className="text-base font-black text-slate-950 dark:text-white">
              {t("purityHowTo")}
            </h2>
          </div>
          <ol className="space-y-2.5">
            {(["purityStep1", "purityStep2", "purityStep3"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-guard-100 text-xs font-black text-guard-700 dark:bg-guard-900/60 dark:text-guard-200">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  {t(k)}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <p className="mt-4 px-1 text-xs font-semibold leading-5 text-slate-400 dark:text-slate-500">
          {t("purityDisclaimer")}
        </p>

        <Button className="mt-5 w-full" size="lg" onClick={() => setStep("capture")}>
          {t("next")}
        </Button>
      </main>
    );
  }

  // --- Step 2: capture ---
  return (
    <main className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="relative z-10 flex h-full w-full flex-col px-5 pb-6 pt-4 safe-top">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (presetFood ? onBack() : setStep("pick"))}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black backdrop-blur">
            {productName ? productName : t(`food_${food}` as "food_milk")}
          </span>
          <span className="h-11 w-11" />
        </header>

        {/* Circular viewfinder */}
        <section className="grid flex-1 place-items-center py-6">
          <div className="relative aspect-square w-full max-w-[280px]">
            <div className="absolute inset-0 rounded-full pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] ring-2 ring-white/70" />
            <div className="absolute inset-4 rounded-full border border-dashed border-white/40" />
            <div className="absolute inset-x-0 -bottom-12 text-center text-xs font-bold text-white/80">
              {t("purityAlignSample")}
            </div>
          </div>
        </section>

        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-2.5 text-xs font-semibold backdrop-blur">
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-300" />
          {t("purityLightingHint")}
        </div>

        {error && (
          <div className="mb-3 rounded-2xl bg-red-500/20 p-3 text-xs font-bold text-red-50 backdrop-blur">
            {error}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="border-0 bg-white text-slate-950 hover:bg-guard-50"
            onClick={captureFromCamera}
            loading={analyzing}
            disabled={!cameraReady || analyzing}
          >
            {t("capture")}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing}
            aria-label={t("galleryFallback")}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        {analyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm"
          >
            <span className="block h-14 w-14 animate-spin rounded-full border-[3px] border-guard-400/25 border-t-guard-400" />
            <p className="mt-4 text-base font-black text-guard-200">
              {t("purityAnalyzing")}
            </p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
