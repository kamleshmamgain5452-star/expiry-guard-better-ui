import { ChangeEvent, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { ArrowLeft, Barcode, CheckCircle2, ImagePlus, ScanLine, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/Button";
import { useI18n } from "@/hooks/useI18n";
import { scanProductLabel } from "@/services/scanApi";
import type { ScanResult } from "@/types/product";
import { cn } from "@/utils/cn";

type ScannerScreenProps = {
  onBack: () => void;
  onComplete: (result: ScanResult, imageDataUrl?: string) => void;
};

type CameraState = "idle" | "loading" | "ready" | "error";
type ScanStep = "barcode" | "details";

export function ScannerScreen({ onBack, onComplete }: ScannerScreenProps) {
  const { t, locale } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewfinderRef = useRef<HTMLDivElement | null>(null);
  
  const [step, setStep] = useState<ScanStep>("barcode");
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [barcodeSuccess, setBarcodeSuccess] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | undefined>();

  // 1. Manage Camera Stream
  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    const videoElement = video;

    async function startCamera() {
      setCameraState("loading");
      setError(null);
      
      let stream: MediaStream | null = null;

      const idealConstraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
      } catch (err) {
        console.warn("ZXing/ideal constraints failed, trying basic video constraints fallback...", err);
        try {
          const fallbackConstraints: MediaStreamConstraints = {
            audio: false,
            video: true
          };
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } catch (fallbackErr) {
          console.error("All webcam stream requests failed.", fallbackErr);
          if (!cancelled) {
            setCameraState("error");
            setError(t("cameraError"));
          }
          return;
        }
      }

      if (cancelled || !stream) {
        if (stream) stopStream(stream);
        return;
      }

      try {
        streamRef.current = stream;
        videoElement.srcObject = stream;
        videoElement.setAttribute("playsinline", "true");
        videoElement.muted = true;
        
        await videoElement.play();
        setTorchAvailable(streamSupportsTorch(stream));
        setCameraState("ready");

      } catch (playErr) {
        console.error("Failed to play camera stream:", playErr);
        if (!cancelled) {
          setCameraState("error");
          setError(t("cameraError"));
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera initialises once on mount; depending on t() would restart the live stream on a language toggle
  }, []);

  // 1b. Barcode scanning loop using cropped canvas
  useEffect(() => {
    if (step !== "barcode" || cameraState !== "ready") return;

    let active = true;
    const codeReader = new BrowserMultiFormatReader();
    
    // Create hidden canvas for cropping barcode
    const cropCanvas = document.createElement("canvas");
    const cropContext = cropCanvas.getContext("2d");

    let lastScanTime = 0;
    const scanInterval = 200; // ~5fps (200ms)

    function scanFrame(time: number) {
      if (!active) return;

      const video = videoRef.current;
      const viewfinder = viewfinderRef.current;
      if (!video || !viewfinder) return;

      if (time - lastScanTime >= scanInterval) {
        lastScanTime = time;

        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth && video.videoHeight) {
            const crop = computeCropRegion(video, viewfinder);
            
            cropCanvas.width = crop.sw;
            cropCanvas.height = crop.sh;
            
            if (cropContext) {
              cropContext.drawImage(
                video,
                crop.sx,
                crop.sy,
                crop.sw,
                crop.sh,
                0,
                0,
                crop.sw,
                crop.sh
              );
              
              try {
                const result = codeReader.decodeFromCanvas(cropCanvas);
                if (result && active) {
                  const text = result.getText();
                  if (text) {
                    setBarcode(text);
                  }
                }
              } catch (err) {
                // ZXing throws NotFoundException if no barcode found, ignore it
              }
            }
          }
        } catch (err) {
          console.error("Error in barcode scan frame:", err);
        }
      }

      requestAnimationFrame(scanFrame);
    }

    const frameId = requestAnimationFrame(scanFrame);

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [step, cameraState]);

  // 2. Barcode Auto-detection success transition
  useEffect(() => {
    if (barcode && step === "barcode") {
      window.queueMicrotask(() => setBarcodeSuccess(true));
      const timer = setTimeout(() => {
        setStep("details");
        setBarcodeSuccess(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [barcode, step]);

  const selectedBarcode = barcode || manualBarcode || null;

  const handleManualBarcodeNext = () => {
    if (manualBarcode.trim()) {
      setBarcodeSuccess(true);
      setTimeout(() => {
        setStep("details");
        setBarcodeSuccess(false);
      }, 1000);
    }
  };

  const handleSkipBarcode = () => {
    setStep("details");
  };

  async function captureAndScan() {
    const video = videoRef.current;
    const viewfinder = viewfinderRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || !viewfinder) {
      setError(t("cameraError"));
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      const crop = computeCropRegion(video, viewfinder);
      
      canvas.width = crop.sw;
      canvas.height = crop.sh;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      
      context.drawImage(
        video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        crop.sw,
        crop.sh
      );

      // Support debug mode overlay
      const isDebug = typeof window !== "undefined" && (
        process.env.NEXT_PUBLIC_DEBUG_SCANNER === "true" ||
        window.location.search.includes("debug=true")
      );
      if (isDebug) {
        console.log("Scanner crop region:", crop);
        context.strokeStyle = "red";
        context.lineWidth = 4;
        context.strokeRect(0, 0, crop.sw, crop.sh);
      }

      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const blob = await canvasToBlob(canvas);
      const result = await scanProductLabel({
        image: blob,
        barcode: selectedBarcode,
        locale
      });
      onComplete(
        {
          ...result,
          barcode: result.barcode || selectedBarcode
        },
        imageDataUrl
      );
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t("scanFailed"));
    } finally {
      setIsProcessing(false);
    }
  }

  async function uploadAndScan() {
    if (!uploadedFile) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await scanProductLabel({
        image: uploadedFile,
        barcode: selectedBarcode,
        locale
      });
      onComplete(
        {
          ...result,
          barcode: result.barcode || selectedBarcode
        },
        uploadedPreview
      );
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t("scanFailed"));
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setUploadedPreview(URL.createObjectURL(file));
  }

  async function toggleTorch() {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const nextTorch = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet]
      });
      setTorchEnabled(nextTorch);
    } catch {
      setTorchAvailable(false);
    }
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-slate-950 text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Main scanner view */}
      <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto px-5 pb-6 pt-4 safe-top">
        
        {/* Header with Step Tracker */}
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={step === "details" ? () => setStep("barcode") : onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-white/12 backdrop-blur"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-guard-200">
              {step === "barcode" ? t("step1Title") : t("step2Title")}
            </span>
            <div className="mt-1 flex gap-1.5">
              <span className={cn("h-1.5 w-8 rounded-full transition-all duration-300", step === "barcode" ? "bg-guard-400" : "bg-white/30")} />
              <span className={cn("h-1.5 w-8 rounded-full transition-all duration-300", step === "details" ? "bg-guard-400" : "bg-white/30")} />
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTorch}
            disabled={!torchAvailable}
            className={cn(
              "grid h-12 w-12 place-items-center rounded-2xl backdrop-blur",
              torchEnabled ? "bg-amber-400 text-slate-950" : "bg-white/12",
              !torchAvailable && "opacity-50"
            )}
            aria-label={t("torch")}
          >
            <Zap className="h-5 w-5" />
          </button>
        </header>

        {/* Viewfinder Area */}
        <section className="grid flex-1 place-items-center py-6 min-h-0">
          <div ref={viewfinderRef} className="relative aspect-[3/4] w-full max-w-[310px] max-h-full min-h-[240px] rounded-[36px]">
            {/* Cutout Overlay */}
            <div className="absolute inset-0 rounded-[36px] pointer-events-none shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] ring-[1px] ring-white/10 animate-fade-in" />

            {/* Viewfinder Target Borders */}
            <div className={cn(
              "absolute left-0 top-0 h-10 w-10 rounded-tl-[36px] border-l-[6px] border-t-[6px] transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]",
              barcodeSuccess ? "border-guard-400 shadow-[0_0_15px_#4fc29e]" : "border-white"
            )} />
            <div className={cn(
              "absolute right-0 top-0 h-10 w-10 rounded-tr-[36px] border-r-[6px] border-t-[6px] transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]",
              barcodeSuccess ? "border-guard-400 shadow-[0_0_15px_#4fc29e]" : "border-white"
            )} />
            <div className={cn(
              "absolute left-0 bottom-0 h-10 w-10 rounded-bl-[36px] border-l-[6px] border-b-[6px] transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]",
              barcodeSuccess ? "border-guard-400 shadow-[0_0_15px_#4fc29e]" : "border-white"
            )} />
            <div className={cn(
              "absolute right-0 bottom-0 h-10 w-10 rounded-br-[36px] border-r-[6px] border-b-[6px] transition-all duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]",
              barcodeSuccess ? "border-guard-400 shadow-[0_0_15px_#4fc29e]" : "border-white"
            )} />

            <div className="absolute inset-3.5 rounded-[26px] border border-white/20" />

            {/* Scan animation line */}
            <motion.div
              className="absolute left-6 right-6 h-0.5 rounded-full bg-guard-400 shadow-[0_0_20px_#4fc29e]"
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            
            {/* Context instructions overlay */}
            <div className="absolute inset-x-6 bottom-6 rounded-3xl bg-black/60 px-4 py-3 text-center text-xs font-bold leading-5 backdrop-blur">
              {step === "barcode" ? t("moveBarcodeInside") : t("alignLabelInside")}
            </div>

            {/* Step 1 Success Card */}
            <AnimatePresence>
              {barcodeSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[36px] bg-slate-950/85 backdrop-blur-sm"
                >
                  <motion.div
                    initial={{ rotate: -15, scale: 0.6 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="grid h-16 w-16 place-items-center rounded-full bg-guard-400 text-slate-950 shadow-lg shadow-guard-400/30"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </motion.div>
                  <p className="mt-4 text-base font-black text-guard-200">
                    {t("barcodeDetected")}
                  </p>
                  <p className="mt-1.5 px-4 text-center text-xs font-bold text-white/70 truncate w-full">
                    {barcode || manualBarcode}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* OCR Processing Overlay — reassures during the 2-4s label read */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[36px] bg-slate-950/85 backdrop-blur-sm"
                >
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="block h-14 w-14 rounded-full border-[3px] border-guard-400/25 border-t-guard-400"
                  />
                  <p className="mt-4 text-base font-black text-guard-200">
                    {t("processing")}
                  </p>
                  <p className="mt-1.5 px-6 text-center text-xs font-semibold leading-5 text-white/65">
                    {t("readingLabelHint")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Loading / OCR status badges */}
        <AnimatePresence>
          {(cameraState === "loading" || isProcessing) && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="mb-4 rounded-[28px] bg-white/12 p-4 backdrop-blur"
            >
              <div className="flex items-center gap-3">
                <ScanLine className="h-5 w-5 animate-pulse text-guard-200" />
                <span className="text-sm font-bold">
                  {isProcessing ? t("processing") : t("cameraLoading")}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cameraState === "error" && (
          <div className="mb-4 rounded-[28px] bg-red-500/18 p-4 text-xs font-semibold leading-5 text-red-50 backdrop-blur">
            <p className="font-black">{t("cameraPermissionTitle")}</p>
            <p className="mt-1">{t("cameraPermissionBody")}</p>
            <p className="mt-1.5">{t("browserWarning")}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-3xl bg-red-500/18 p-4 text-xs font-bold text-red-50 backdrop-blur">
            {error}
          </div>
        )}

        {/* Dynamic Controls panel based on Step */}
        <div className="rounded-[32px] bg-white/12 p-4 backdrop-blur transition-all duration-300">
          {step === "barcode" ? (
            // --- STEP 1: Barcode Scanning UI ---
            <div className="flex flex-col">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold">
                {barcode ? (
                  <>
                    <CheckCircle2 className="h-4.5 w-4.5 text-guard-200" />
                    {t("barcodeDetected")}: {barcode}
                  </>
                ) : (
                  <>
                    <Barcode className="h-4.5 w-4.5 text-white/70" />
                    {t("noBarcodeYet")}
                  </>
                )}
              </div>
              <input
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
                inputMode="numeric"
                placeholder={t("manualBarcode")}
                className="mb-3 h-12 w-full rounded-2xl border border-white/15 bg-black/20 px-4 text-sm text-white placeholder:text-white/55 outline-none focus:border-guard-300"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="border-0 bg-white/10 text-white hover:bg-white/20"
                  onClick={handleSkipBarcode}
                >
                  {t("skipBarcode")}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="border-0 bg-white text-slate-950 hover:bg-guard-50"
                  onClick={handleManualBarcodeNext}
                  disabled={!manualBarcode.trim()}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          ) : (
            // --- STEP 2: Label OCR Scanning UI ---
            <div className="flex flex-col">
              <div className="mb-3 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4.5 w-4.5 text-guard-200" />
                  <span>{t("barcodeNumber")}: {selectedBarcode || t("skip")}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setStep("barcode")}
                  className="text-guard-200 underline"
                >
                  {t("edit")}
                </button>
              </div>
              
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="border-0 bg-white text-slate-950 hover:bg-guard-50"
                  onClick={captureAndScan}
                  loading={isProcessing}
                  disabled={cameraState !== "ready"}
                >
                  {t("capture")}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
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
                onChange={handleFileChange}
                className="hidden"
              />

              {uploadedFile && (
                <div className="mt-3 grid grid-cols-[56px_1fr] items-center gap-3">
                  {uploadedPreview && (
                    <img
                      src={uploadedPreview}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full bg-white/90 text-slate-950"
                    onClick={uploadAndScan}
                    loading={isProcessing}
                  >
                    {t("uploadAndScan")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function streamSupportsTorch(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.() as
    | (MediaTrackCapabilities & { torch?: boolean })
    | undefined;
  return Boolean(capabilities?.torch);
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image capture failed"));
      },
      "image/jpeg",
      0.9
    );
  });
}

interface CropRegion {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function computeCropRegion(
  video: HTMLVideoElement,
  viewfinder: HTMLDivElement
): CropRegion {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const vRect = video.getBoundingClientRect();
  const vfRect = viewfinder.getBoundingClientRect();

  const vdWidth = vRect.width;
  const vdHeight = vRect.height;

  // object-cover scale factor
  const s = Math.max(vdWidth / vw, vdHeight / vh);

  const rvWidth = vw * s;
  const rvHeight = vh * s;

  // Offsets due to centering
  const offsetX = (vdWidth - rvWidth) / 2;
  const offsetY = (vdHeight - rvHeight) / 2;

  // Viewfinder position relative to the video element
  const vfLeft = vfRect.left - vRect.left;
  const vfTop = vfRect.top - vRect.top;

  // Map to video source coordinates
  let sx = (vfLeft - offsetX) / s;
  let sy = (vfTop - offsetY) / s;
  let sw = vfRect.width / s;
  let sh = vfRect.height / s;

  // Clamp values to ensure they are inside video boundaries
  sx = Math.max(0, Math.min(vw - 1, sx));
  sy = Math.max(0, Math.min(vh - 1, sy));
  sw = Math.max(1, Math.min(vw - sx, sw));
  sh = Math.max(1, Math.min(vh - sy, sh));

  return { sx, sy, sw, sh };
}
