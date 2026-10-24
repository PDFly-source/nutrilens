'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ScanMode, ProductAnalysis, ImageType, NutritionData, ScanImageItem } from '@/types/food';
import { analyzeCanvasQuality, QualityAnalysisResult } from '@/features/ocr/smart-capture-coach';
import { detectBarcodeFromImage } from '@/features/ocr/ocr-service';
import { analyzeFoodImages } from '@/features/ocr/unified-analyzer';
import { ManualReviewModal } from '@/features/scanner/ManualReviewModal';
import {
  RotateCcw,
  Zap,
  ZapOff,
  SwitchCamera,
  Upload,
  AlertTriangle,
  X,
  Sparkles,
  Barcode,
  FileText,
  ListFilter,
  Package,
  CheckCircle2,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface CameraModalProps {
  initialMode: ScanMode;
  onClose: () => void;
  onAnalysisReady: (analyzedProduct: ProductAnalysis) => void;
}

export function CameraModal({ initialMode, onClose, onAnalysisReady }: CameraModalProps) {
  const [mode, setMode] = useState<ScanMode>(initialMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);

  // Live coaching
  const [coachResult, setCoachResult] = useState<QualityAnalysisResult | null>(null);

  // Analysis state
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');

  // Multi-photo in-session collection
  const [sessionPhotos, setSessionPhotos] = useState<ScanImageItem[]>([]);

  // Manual Review Data State
  const [pendingReview, setPendingReview] = useState<{
    nutrition: NutritionData;
    ingredientsText: string;
    productName: string;
    brand?: string | null;
    claims: string[];
    imagePreviewUrl?: string;
    images?: ScanImageItem[];
    imageType?: ImageType;
    detectionNotes?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const coachTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stop media tracks helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  // Initialize Camera Stream
  useEffect(() => {
    let isCancelled = false;

    async function startCamera() {
      stopStream();
      setCameraError(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access not supported on this device/browser');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }

        setIsCameraActive(true);

        // Check torch capability
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
          const caps = (videoTrack as any).getCapabilities();
          if (caps && caps.torch) {
            setTorchAvailable(true);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Camera initiation failed:', err);
          let msg = 'Could not access camera. Please allow camera permissions or upload an image.';
          if (err.name === 'NotAllowedError') {
            msg = 'Camera permission was denied. Tap Upload to choose a photo from your gallery.';
          } else if (err.name === 'NotFoundError') {
            msg = 'No camera hardware found. Please upload a photo from your files.';
          }
          setCameraError(msg);
          setIsCameraActive(false);
        }
      }
    }

    startCamera();

    return () => {
      isCancelled = true;
      stopStream();
    };
  }, [facingMode, cameraRetryCount, stopStream]);

  // Real-time Smart Capture Coach Loop
  useEffect(() => {
    if (!isCameraActive || isProcessing) return;

    coachTimerRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState < video.HAVE_CURRENT_DATA) return;

      const w = 320;
      const h = Math.round((w * (video.videoHeight || 480)) / (video.videoWidth || 640));
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      // Run coach analysis
      const quality = analyzeCanvasQuality(canvas);
      setCoachResult(quality);

      // In Barcode mode, scan for barcode automatically
      if (mode === 'barcode' && !detectedBarcode) {
        detectBarcodeFromImage(canvas).then((res) => {
          if (res) {
            setDetectedBarcode(res.rawValue);
          }
        });
      }
    }, 1800);

    return () => {
      if (coachTimerRef.current) clearInterval(coachTimerRef.current);
    };
  }, [isCameraActive, isProcessing, mode, detectedBarcode]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !torchAvailable) return;
    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const newTorchState = !torchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: newTorchState }],
      });
      setTorchOn(newTorchState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Flip Camera between Environment and User
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Unified Process Image Handler
  const executeImageAnalysis = async (
    imagesToAnalyze: Array<{ file?: File; dataUrl?: string; name?: string }>
  ) => {
    setIsProcessing(true);
    setOcrStatus('Starting image inspection...');

    try {
      const result = await analyzeFoodImages(
        imagesToAnalyze,
        mode,
        (stage, percent) => {
          setOcrStatus(`${stage} (${percent}%)`);
        }
      );

      setSessionPhotos(result.imagesProcessed);

      // Open the manual review modal with REAL extracted data
      setPendingReview({
        nutrition: result.extractedNutrition,
        ingredientsText: result.ingredientsText,
        productName: result.productName,
        brand: result.brand,
        claims: result.claims,
        imagePreviewUrl: result.imagesProcessed[0]?.dataUrl,
        images: result.imagesProcessed,
        imageType: result.imageType,
        detectionNotes: result.detectionNotes,
      });
    } catch (err: any) {
      console.error('Processing error:', err);
      setOcrStatus('Analysis failed');
      alert(`Could not analyze image: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setOcrStatus('');
    }
  };

  // Trigger Snap from Video Feed
  const handleCaptureSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    stopStream();
    executeImageAnalysis([{ dataUrl, name: `snap-${Date.now()}.jpg` }]);
  };

  // Handle Gallery Image Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopStream();
    executeImageAnalysis([{ file, name: file.name }]);
  };

  // Multi-photo: add second photo (e.g. back package) into active session
  const handleAddAnotherPhotoToSession = async (file: File) => {
    const existing = sessionPhotos.map((p) => ({
      dataUrl: p.dataUrl,
      name: p.name,
      label: p.label,
    }));
    await executeImageAnalysis([...existing, { file, name: file.name }]);
  };

  // Handle Manual Barcode Search or Override
  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcodeInput.trim()) {
      setDetectedBarcode(manualBarcodeInput.trim());
    }
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111613] text-white">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3.5 bg-black/60 backdrop-blur-md border-b border-white/10 z-20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-wide uppercase text-white/95">
            {mode === 'barcode' && 'Barcode Scanner'}
            {mode === 'nutrition' && 'Nutrition Label Scanner'}
            {mode === 'ingredients' && 'Ingredients Scanner'}
            {mode === 'product' && 'Product Photo Scanner'}
          </span>
          <span className="text-[11px] text-white/50">· Vision Pipeline</span>
        </div>

        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors"
          aria-label="Close scanner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black/70 border-b border-white/5 z-20 overflow-x-auto">
        <button
          onClick={() => { setMode('nutrition'); setDetectedBarcode(null); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            mode === 'nutrition' ? 'bg-[#159A6A] text-white shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Nutrition Panel</span>
        </button>

        <button
          onClick={() => { setMode('ingredients'); setDetectedBarcode(null); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            mode === 'ingredients' ? 'bg-[#159A6A] text-white shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Ingredients</span>
        </button>

        <button
          onClick={() => { setMode('product'); setDetectedBarcode(null); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            mode === 'product' ? 'bg-[#159A6A] text-white shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Full Package</span>
        </button>

        <button
          onClick={() => { setMode('barcode'); }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            mode === 'barcode' ? 'bg-[#159A6A] text-white shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          <Barcode className="w-3.5 h-3.5" />
          <span>Barcode</span>
        </button>
      </div>

      {/* Live Video Viewport Container */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Hidden coaching canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder Target Reticle */}
        <div className="relative w-72 h-80 sm:w-80 sm:h-96 pointer-events-none z-10 flex flex-col items-center justify-center">
          <div className="absolute inset-0 border-2 border-white/30 rounded-3xl" />
          {/* Glowing Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#159A6A] rounded-tl-3xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#159A6A] rounded-tr-3xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#159A6A] rounded-bl-3xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#159A6A] rounded-br-3xl" />

          {/* Center Scan Reticle line */}
          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#159A6A] to-transparent animate-pulse" />
        </div>

        {/* Real-time Guidance Feedback Pill */}
        {coachResult && !isProcessing && (
          <div className="absolute top-4 inset-x-4 flex justify-center z-20 pointer-events-none">
            <div
              className={`px-3.5 py-1.5 rounded-full backdrop-blur-md text-xs font-medium border flex items-center gap-1.5 shadow-lg transition-all ${
                coachResult.passed
                  ? 'bg-black/70 border-emerald-500/50 text-emerald-300'
                  : 'bg-black/80 border-amber-500/60 text-amber-300'
              }`}
            >
              {coachResult.passed ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Optimal Clarity — Tap Shutter</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{coachResult.tips[0] || 'Hold steady for best focus'}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Detected Barcode Banner */}
        {detectedBarcode && mode === 'barcode' && (
          <div className="absolute bottom-4 inset-x-4 flex justify-center z-20">
            <div className="px-4 py-2 rounded-2xl bg-[#159A6A] text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95">
              <Barcode className="w-4 h-4" />
              <span>Barcode Detected: {detectedBarcode}</span>
              <button
                onClick={() => {
                  setPendingReview({
                    nutrition: {
                      servingSize: null,
                      servingsPerContainer: null,
                      calories: null,
                      totalFat: null,
                      saturatedFat: null,
                      transFat: null,
                      cholesterol: null,
                      sodium: null,
                      totalCarbs: null,
                      dietaryFiber: null,
                      totalSugars: null,
                      addedSugars: null,
                      protein: null,
                    },
                    ingredientsText: '',
                    productName: `Product ${detectedBarcode}`,
                    claims: [],
                  });
                }}
                className="ml-2 px-2.5 py-1 bg-white text-black text-[11px] font-bold rounded-lg hover:bg-white/90 transition-colors"
              >
                Proceed
              </button>
            </div>
          </div>
        )}

        {/* Error Fallback Overlay */}
        {cameraError && !isProcessing && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Camera Notice</h3>
            <p className="text-xs text-white/70 max-w-sm mb-6 leading-relaxed">{cameraError}</p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setCameraRetryCount((c) => c + 1)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </button>

              <label className="px-5 py-2 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Food Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Live Processing Spinner Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center z-40 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#159A6A]/20 border border-[#159A6A]/40 flex items-center justify-center text-[#159A6A] animate-pulse mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Analyzing Food Image</h3>
            <p className="text-xs text-white/70 font-mono tracking-tight max-w-sm mb-3">
              {ocrStatus || 'Extracting packaging visual data...'}
            </p>
            <p className="text-[11px] text-white/40">
              Inspecting product identity, nutrition table, and ingredients statements.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Shutter & Controls Dock */}
      <div className="px-6 py-5 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center justify-between z-20 pb-safe">
        {/* Gallery Upload Option */}
        <label className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 cursor-pointer transition-colors" title="Upload from Gallery">
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Shutter Button */}
        <button
          onClick={handleCaptureSnap}
          disabled={isProcessing || !isCameraActive}
          className="relative w-18 h-18 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform disabled:opacity-40"
          aria-label="Capture photo"
        >
          <div className="w-14 h-14 rounded-full bg-white shadow-inner flex items-center justify-center text-[#159A6A]">
            <Sparkles className="w-6 h-6" />
          </div>
        </button>

        {/* Flashlight & Camera Flip Controls */}
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              onClick={toggleTorch}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                torchOn ? 'bg-[#B9D94C] text-black font-semibold' : 'bg-white/10 text-white/90 hover:bg-white/20'
              }`}
              aria-label="Toggle flashlight"
            >
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={flipCamera}
            className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Manual Barcode Input Fallback Drawer for Barcode Mode */}
      {mode === 'barcode' && !detectedBarcode && (
        <form
          onSubmit={handleManualBarcodeSubmit}
          className="px-6 py-2.5 bg-black/95 border-t border-white/5 flex items-center gap-2 z-20"
        >
          <input
            type="text"
            value={manualBarcodeInput}
            onChange={(e) => setManualBarcodeInput(e.target.value)}
            placeholder="Or enter barcode numbers manually (e.g. 012345678905)"
            className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-semibold text-white transition-colors"
          >
            Check
          </button>
        </form>
      )}

      {/* Manual Review & Correction Modal */}
      {pendingReview && (
        <ManualReviewModal
          initialNutrition={pendingReview.nutrition}
          initialIngredientsText={pendingReview.ingredientsText}
          initialProductName={pendingReview.productName}
          initialBrand={pendingReview.brand}
          initialClaims={pendingReview.claims}
          scanMode={mode}
          imageType={pendingReview.imageType}
          imagePreviewUrl={pendingReview.imagePreviewUrl}
          images={pendingReview.images}
          detectionNotes={pendingReview.detectionNotes}
          onAddAnotherPhoto={handleAddAnotherPhotoToSession}
          onConfirm={(analyzed) => {
            setPendingReview(null);
            onAnalysisReady(analyzed);
          }}
          onCancel={() => {
            setPendingReview(null);
            setCameraRetryCount((c) => c + 1);
          }}
        />
      )}
    </div>
  );
}
