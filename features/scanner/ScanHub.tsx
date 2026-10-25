'use client';

import React, { useState, useRef } from 'react';
import { ScanMode, NutritionData, ProductAnalysis, ImageType, ScanImageItem } from '@/types/food';
import { CameraModal } from '@/features/scanner/CameraModal';
import { ManualReviewModal } from '@/features/scanner/ManualReviewModal';
import { CookedReviewModal } from '@/features/scanner/CookedReviewModal';
import { FieldEvidenceMap } from '@/features/engine-v2/types';
import { capabilitySummary } from '@/features/engine-v2/vision-provider';
import { browserClassifyCooked, watchVisionStatus, ModelDownloadError, ImageDecodeError, InferenceError, EngineInitError } from '@/features/engine-v2/browser-vision';
import { decideVisionRoute, decidePackagedRoute } from '@/features/scanner/scan-routing';
import { scanHubNotice, buildLabel } from '@/lib/build-info';
import { runRecognitionSelfTest } from '@/features/engine-v2/recognition-diagnostics';
import { SelfTestPanel } from '@/features/engine-v2/SelfTestPanel';
import type { RecognitionDiagnosticReport } from '@/features/engine-v2/recognition-diagnostics';
import { DishCandidate } from '@/features/engine-v2/vision-mapping';
import { compileProductAnalysis } from '@/features/scoring/engine';
import { analyzeFoodImages } from '@/features/ocr/unified-analyzer';
import { mergeNutritionData, describeConflicts, mergeReviewFields } from '@/features/ocr/merge';
import {
  Barcode,
  FileText,
  ListFilter,
  Package,
  Camera,
  Upload,
  Sparkles,
  ShieldCheck,
  Edit,
  ArrowRight,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChefHat,
  Utensils,
  Wand2,
} from 'lucide-react';

interface ScanHubProps {
  onScanComplete: (analysis: ProductAnalysis) => void;
  onNavigateCompare?: () => void;
}

export function ScanHub({ onScanComplete, onNavigateCompare }: ScanHubProps) {
  const [activeCameraMode, setActiveCameraMode] = useState<ScanMode | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-photo queue in ScanHub
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Analysis progress
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('');
  const [analysisPercent, setAnalysisPercent] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Manual Review Data State
  const [reviewPayload, setReviewPayload] = useState<{
    nutrition: NutritionData;
    ingredientsText: string;
    productName: string;
    brand?: string | null;
    claims: string[];
    imagePreviewUrl?: string;
    images?: ScanImageItem[];
    imageType?: ImageType;
    detectionNotes?: string;
    conflicts?: string[];
    evidence?: FieldEvidenceMap;
    barcode?: string | null;
    qualityAdvice?: string | null;
    mode: ScanMode;
  } | null>(null);
  // Incremented whenever a new extraction (e.g. an added photo's results)
  // is merged into the review payload, so the review modal can apply the
  // merge without clobbering fields the user has manually edited.
  const [reviewSeq, setReviewSeq] = useState(0);

  // v2: scan routing — auto (default), forced packaged, or cooked dish
  const [routeMode, setRouteMode] = useState<'auto' | 'packaged' | 'cooked'>('auto');
  const [cookedFiles, setCookedFiles] = useState<File[] | null>(null);
  const [ambiguousFiles, setAmbiguousFiles] = useState<File[] | null>(null);
  // v2.1: automatic vision classification results (ranked candidates)
  const [visionCandidates, setVisionCandidates] = useState<DishCandidate[] | undefined>(undefined);
  const [visionVisible, setVisionVisible] = useState<string[] | undefined>(undefined);
  const [visionPortionG, setVisionPortionG] = useState<number | null | undefined>(undefined);
  // v2.4.1: honest model-failure state — retry or explicit user choice, never
  // a silent packaged-OCR fallback that misreads cooked food as a package.
  const [modelError, setModelError] = useState<{ message: string; files: File[] } | null>(null);
  const [selfTest, setSelfTest] = useState<RecognitionDiagnosticReport | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  // v2.4.1: what the model saw (shown on the ambiguity card as a hint).
  const [visionHint, setVisionHint] = useState<DishCandidate[] | null>(null);

  // Trigger analysis on an array of files
  const runFileAnalysis = async (files: File[], mode: ScanMode = 'nutrition') => {
    if (!files || files.length === 0) return;

    // v2: explicit cooked-food route skips the label pipeline entirely.
    if (routeMode === 'cooked') {
      setVisionHint(null);
      setVisionCandidates(undefined);
      setCookedFiles(files);
      return;
    }

    // v2.2: automatic recognition — ALWAYS available, no API key needed. The
    // on-device Food-101 model classifies BEFORE the heavy packaged OCR
    // pipeline and routes cooked food directly.
    //
    // v2.4.1 (forensic-audit fix): model load/inference failure is NO LONGER
    // a silent packaged-OCR fallback — that path misrouted cooked food into
    // the packaged form ("She", "Front Package Detected"). The user now sees
    // an honest error with retry and an explicit route choice. Weak/unknown
    // vision evidence continues into OCR, but the packaged form only opens
    // with REAL packaging evidence (see decidePackagedRoute below).
    if (routeMode === 'auto') {
      setIsAnalyzing(true);
      setModelError(null);
      setAnalysisStage('Identifying the food with the on-device model...');
      setAnalysisPercent(10);
      // Surface the one-time ~9.4 MB model download honestly.
      const unsubscribe = watchVisionStatus((st) => {
        if (st.state === 'downloading') {
          const pct = st.total ? Math.min(0.9, st.received / st.total) : 0.3;
          setAnalysisStage(
            st.total
              ? `Downloading the recognition model (${(st.received / 1024 / 1024).toFixed(1)} of ${(st.total / 1024 / 1024).toFixed(1)} MB — one time only)...`
              : 'Downloading the recognition model (one time only)...'
          );
          setAnalysisPercent(10 + Math.round(pct * 35));
        }
      });
      try {
        const res = await browserClassifyCooked(files[0]);
        const decision = decideVisionRoute({ candidates: res.candidates });
        if (decision.route === 'cooked') {
          unsubscribe();
          setIsAnalyzing(false);
          setVisionHint(null);
          setVisionCandidates(decision.candidates);
          setVisionVisible(res.visibleIngredients);
          setVisionPortionG(res.portionEstimateG);
          setCookedFiles(files);
          return;
        }
        // Weak/unknown vision evidence: keep the model's view as a HINT for
        // the ambiguity card, then let the packaged OCR try (it may find a
        // real label). The gate below decides whether that is enough.
        setVisionHint(res.candidates.length > 0 ? res.candidates : null);
      } catch (err) {
        unsubscribe();
        setIsAnalyzing(false);
        const message =
          err instanceof ModelDownloadError
            ? `The recognition model (~9.4 MB) could not be downloaded. Check your connection and retry. (${err.message})`
            : err instanceof EngineInitError
              ? `${err.message} Run the engine self-test below for details.`
              : err instanceof InferenceError || err instanceof ImageDecodeError
                ? err.message
                : `On-device recognition could not run. ${err instanceof Error ? err.message : ''}`;
        setModelError({ message, files });
        return;
      }
      unsubscribe();
      setIsAnalyzing(false);
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStage('Reading & decoding package photo(s)...');
    setAnalysisPercent(15);

    try {
      const inputs = files.map((file, idx) => ({
        file,
        name: file.name,
        label: idx === 0 ? 'Photo 1 (Front/Primary)' : `Photo ${idx + 1} (Back/Panel)`,
      }));

      const result = await analyzeFoodImages(inputs, mode, (stage, pct) => {
        setAnalysisStage(stage);
        setAnalysisPercent(pct);
      });

      // v2.4.1: routing decision is centralized + tested. Garbage OCR can no
      // longer open the packaged form ("She" once passed the old gate because
      // productName was truthy). The analyzer now hands us a validated
      // hasPackagingEvidence flag and an honest imageType.
      const decision = decidePackagedRoute({
        hasPackagingEvidence: result.hasPackagingEvidence,
        imageType: result.imageType,
        routeMode,
      });
      if (decision.route === 'ambiguous') {
        setStagedFiles([]);
        setAmbiguousFiles(files);
        return;
      }

      // Clear staged files and open review modal
      setStagedFiles([]);
      setReviewPayload({
        nutrition: result.extractedNutrition,
        ingredientsText: result.ingredientsText,
        productName: result.productName,
        brand: result.brand,
        claims: result.claims,
        imagePreviewUrl: result.imagesProcessed[0]?.dataUrl,
        images: result.imagesProcessed,
        imageType: result.imageType,
        detectionNotes: result.detectionNotes,
        evidence: result.evidence,
        barcode: result.barcode,
        qualityAdvice: result.qualityAdvice,
        mode,
      });
    } catch (err: any) {
      console.error('ScanHub analysis error:', err);
      setAnalysisError(err.message || 'Image analysis failed. Please try a clearer photo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const newFiles = Array.from(filesList).filter((f) => f.type.startsWith('image/'));
    if (newFiles.length === 0) return;

    if (newFiles.length === 1 && stagedFiles.length === 0) {
      // Analyze single file immediately
      runFileAnalysis(newFiles, 'nutrition');
    } else {
      // Add to multi-photo staging
      setStagedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleAddAnotherPhotoInReview = async (file: File) => {
    if (!reviewPayload) return;
    const existing = (reviewPayload.images || []).map((img) => ({
      dataUrl: img.dataUrl,
      name: img.name,
      label: img.label,
    }));
    const combinedInputs = [...existing, { file, name: file.name, label: `Photo ${existing.length + 1}` }];

    setIsAnalyzing(true);
    try {
      const result = await analyzeFoodImages(combinedInputs, reviewPayload.mode, (stage, pct) => {
        setAnalysisStage(stage);
        setAnalysisPercent(pct);
      });

      // Evidence-based merge: keep everything already extracted/entered and
      // fill ONLY unknown fields from the new photo's results. Conflicting
      // readings between photos are flagged for manual review, never
      // silently overwritten.
      const { merged, conflicts } = mergeNutritionData(
        reviewPayload.nutrition,
        result.extractedNutrition
      );
      const conflictLabels = describeConflicts(conflicts);

      setReviewPayload({
        nutrition: merged,
        ingredientsText: mergeReviewFields(reviewPayload.ingredientsText, result.ingredientsText),
        productName: mergeReviewFields(reviewPayload.productName, result.productName),
        brand: mergeReviewFields(reviewPayload.brand ?? '', result.brand ?? '') || null,
        claims: Array.from(new Set([...(reviewPayload.claims || []), ...(result.claims || [])])),
        imagePreviewUrl: result.imagesProcessed[0]?.dataUrl,
        images: result.imagesProcessed,
        imageType: result.imageType,
        detectionNotes: conflictLabels.length
          ? `${result.detectionNotes} Conflicting readings between photos for: ${conflictLabels.join(', ')} — please verify.`
          : result.detectionNotes,
        conflicts: conflictLabels,
        evidence: result.evidence,
        barcode: result.barcode ?? reviewPayload.barcode,
        qualityAdvice: result.qualityAdvice,
        mode: reviewPayload.mode,
      });
      setReviewSeq((seq) => seq + 1);
    } catch (err: any) {
      console.error('Adding photo error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Open clean blank manual editor
  const handleOpenBlankManual = () => {
    setReviewPayload({
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
      productName: '',
      brand: null,
      claims: [],
      imagePreviewUrl: undefined,
      images: [],
      imageType: 'full_package',
      detectionNotes: 'Manual label data entry.',
      mode: 'nutrition',
    });
  };

  const modes: {
    id: ScanMode;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ElementType;
    badge: string;
    primaryAction: string;
  }[] = [
    {
      id: 'nutrition',
      title: 'Nutrition Facts Label',
      subtitle: 'Calories, Macros & Micronutrients',
      description: 'Extracts exact serving size, sugars, sodium, protein, fiber, and saturated fats with live manual verification.',
      icon: FileText,
      badge: 'Recommended',
      primaryAction: 'Scan Nutrition Panel',
    },
    {
      id: 'ingredients',
      title: 'Ingredients Statement',
      subtitle: 'Additives, Sweeteners & Allergens',
      description: 'Decodes ultra-processed indicators, preservatives, cosmetic food dyes, and allergen traces using our scientific lexicon.',
      icon: ListFilter,
      badge: 'Deep Intelligence',
      primaryAction: 'Scan Ingredients',
    },
    {
      id: 'barcode',
      title: 'Product Barcode',
      subtitle: 'Quick Package Identifier',
      description: 'Detects retail barcodes. Guides you immediately to nutrition and ingredients capture.',
      icon: Barcode,
      badge: 'Point & Read',
      primaryAction: 'Scan Barcode',
    },
    {
      id: 'product',
      title: 'Full Package / Multi-Panel',
      subtitle: 'Front + Back Combined',
      description: 'Reads brand, product variant, front claims, and cross-references against nutrition table and ingredients.',
      icon: Package,
      badge: 'Complete Audit',
      primaryAction: 'Capture Packaging',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
            Capture Engine
          </span>
          <span className="text-stone-300 dark:text-stone-700">·</span>
          <span className="text-xs text-stone-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#159A6A]" />
            Local-First & Vision OCR
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17201B] dark:text-[#EAEFEA]">
          Scan Food Packaging
        </h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 max-w-xl leading-relaxed">
          Upload real food package photos or capture with your camera. Support for single or multi-photo sessions (Front + Back panels).
        </p>
      </div>

      {/* v2: Scan mode selector — Auto / Packaged / Cooked dish */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5" /> Scan type
        </span>
        {([
          { id: 'auto', label: 'Auto', icon: Wand2, desc: 'Detect from the photo' },
          { id: 'packaged', label: 'Packaged food', icon: Package, desc: 'Read the label' },
          { id: 'cooked', label: 'Cooked dish', icon: ChefHat, desc: 'Estimate a prepared dish' },
        ] as const).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setRouteMode(m.id)}
            title={m.desc}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              routeMode === m.id
                ? 'border-[#159A6A] bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#0F7B52] dark:text-emerald-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
            }`}
          >
            <m.icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-stone-400 dark:text-stone-500 pl-0.5">
        {scanHubNotice(capabilitySummary().cloudVision)}
      </p>

      {/* v2.4.1: model failure card — honest retry/choice, never silent OCR fallback */}
      {modelError && !isAnalyzing && (
        <div className="p-6 rounded-3xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                On-device recognition could not run
              </h3>
              <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-1">
                {modelError.message}
              </p>
              <p className="text-xs text-red-800/60 dark:text-red-400/60 mt-1.5">
                We did not guess what this photo shows. Retry, or tell us the scan type — you stay in control.
              </p>
              <p className="text-[11px] text-red-800/50 dark:text-red-400/50 mt-1 font-mono">
                {buildLabel()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={selfTestRunning}
              onClick={async () => {
                setSelfTestRunning(true);
                setSelfTest(null);
                try {
                  setSelfTest(await runRecognitionSelfTest());
                } finally {
                  setSelfTestRunning(false);
                }
              }}
              className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-sm font-medium text-red-900 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {selfTestRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Run engine self-test
            </button>
            <button
              type="button"
              onClick={() => {
                const f = modelError.files;
                setModelError(null);
                runFileAnalysis(f, 'nutrition');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#12855A] text-white text-sm font-semibold flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4" /> Retry recognition
            </button>
            <button
              type="button"
              onClick={() => {
                const f = modelError.files;
                setModelError(null);
                setRouteMode('cooked');
                setCookedFiles(f);
              }}
              className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-sm font-medium text-red-900 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/30 flex items-center gap-2"
            >
              <ChefHat className="w-4 h-4" /> It&#39;s a cooked dish — I&#39;ll pick it
            </button>
            <button
              type="button"
              onClick={() => {
                const f = modelError.files;
                setModelError(null);
                setRouteMode('packaged');
                runFileAnalysis(f, 'nutrition');
              }}
              className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-sm font-medium text-red-900 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-900/30 flex items-center gap-2"
            >
              <Package className="w-4 h-4" /> It&#39;s a package — scan the label
            </button>
          </div>
          {selfTest && <SelfTestPanel report={selfTest} />}
        </div>
      )}

      {/* v2: Ambiguity card — image type unknown, ask instead of guessing */}
      {ambiguousFiles && (
        <div className="p-6 rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                We could not tell what this photo shows
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
                No barcode, no readable package text and no nutrition table were found. Choose how to
                continue — we never guess a product or dish for you.
              </p>
              {visionHint && visionHint.length > 0 && (
                <p className="text-xs text-amber-800/70 dark:text-amber-400/70 mt-2">
                  The on-device model thought this might be{' '}
                  {visionHint
                    .slice(0, 3)
                    .map((c) => `${c.name} (${Math.round(c.confidence * 100)}%)`)
                    .join(', ')}
                  , but was not confident enough to decide for you.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCookedFiles(ambiguousFiles);
                setVisionCandidates(visionHint ?? undefined);
                setAmbiguousFiles(null);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#12855A] text-white text-sm font-semibold flex items-center gap-2"
            >
              <ChefHat className="w-4 h-4" /> It&#39;s a cooked dish
            </button>
            <button
              type="button"
              onClick={() => {
                setAmbiguousFiles(null);
                setRouteMode('packaged');
              }}
              className="px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 flex items-center gap-2"
            >
              <Package className="w-4 h-4" /> It&#39;s a package — I&#39;ll retake the label
            </button>
            <button
              type="button"
              onClick={() => {
                setAmbiguousFiles(null);
                setVisionHint(null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm text-stone-500 dark:text-stone-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Multi-Photo Staging Drawer (if user added multiple files) */}
      {stagedFiles.length > 0 && (
        <div className="p-5 rounded-3xl border border-[#159A6A]/40 bg-[#DDF5EA]/20 dark:bg-emerald-950/20 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#159A6A]" />
              <span className="text-sm font-semibold">Multi-Photo Scan Session ({stagedFiles.length})</span>
            </div>
            <button
              onClick={() => setStagedFiles([])}
              className="text-xs text-stone-500 hover:text-red-500"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {stagedFiles.map((f, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-medium flex items-center gap-2 shrink-0"
              >
                <span className="text-[#159A6A] font-bold">Photo {i + 1}:</span>
                <span className="truncate max-w-[120px]">{f.name}</span>
                <button
                  onClick={() => setStagedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-dashed border-stone-300 dark:border-stone-600 text-xs font-medium text-stone-600 dark:text-stone-300 hover:border-[#159A6A] flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" /> Add Another Photo
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={() => runFileAnalysis(stagedFiles, 'product')}
              className="w-full py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze Complete Product (Merge All Photos)</span>
            </button>
          </div>
        </div>
      )}

      {/* Analysis Progress Overlay / Inline Card */}
      {isAnalyzing && (
        <div className="p-6 rounded-3xl border border-[#159A6A]/30 bg-white dark:bg-[#1A211D] shadow-lg space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#159A6A] flex items-center justify-center animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#17201B] dark:text-[#EAEFEA]">
                  Analyzing Food Package Image
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                  {analysisStage}
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-[#159A6A] font-mono">
              {analysisPercent}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full bg-[#159A6A] transition-all duration-300 rounded-full"
              style={{ width: `${analysisPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Analysis Error Message */}
      {analysisError && !isAnalyzing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Notice:</span> {analysisError}
          </div>
          <button
            onClick={() => setAnalysisError(null)}
            className="text-stone-400 hover:text-stone-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag & Drop / Gallery Upload Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative p-8 rounded-3xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-4 ${
          isDragOver
            ? 'border-[#159A6A] bg-[#DDF5EA]/30 dark:bg-emerald-950/20 scale-[1.01]'
            : 'border-stone-200 dark:border-stone-800 hover:border-[#159A6A]/50 bg-stone-50/50 dark:bg-stone-900/30'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-stone-800 shadow-sm border border-stone-200 dark:border-stone-700 text-[#159A6A] flex items-center justify-center">
          <Upload className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[#17201B] dark:text-[#EAEFEA]">
            Upload Food Package Photos from Gallery
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md">
            Drag & drop or select photos (Photo 1: Front package, Photo 2: Back nutrition/ingredients).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Select Photos from Gallery</span>
          </button>

          <button
            onClick={handleOpenBlankManual}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Edit className="w-3.5 h-3.5 text-stone-500" />
            <span>Enter Manually</span>
          </button>
        </div>
      </div>

      {/* Mode Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className="p-5 rounded-3xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] flex flex-col justify-between hover:border-[#159A6A]/40 transition-all shadow-sm group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#159A6A] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                    {m.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#17201B] dark:text-[#EAEFEA]">
                    {m.title}
                  </h3>
                  <p className="text-xs font-medium text-[#159A6A] dark:text-[#B9D94C] mb-1.5">
                    {m.subtitle}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {m.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between">
                <button
                  onClick={() => setActiveCameraMode(m.id)}
                  className="px-4 py-2 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{m.primaryAction}</span>
                </button>

                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium flex items-center gap-1"
                >
                  <span>Upload Image</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Camera Live Modal */}
      {activeCameraMode && (
        <CameraModal
          initialMode={activeCameraMode}
          onClose={() => setActiveCameraMode(null)}
          onAnalysisReady={(analyzedProduct) => {
            setActiveCameraMode(null);
            onScanComplete(analyzedProduct);
          }}
        />
      )}

      {/* v2: Cooked-food review modal */}
      {cookedFiles && (
        <CookedReviewModal
          files={cookedFiles}
          initialCandidates={visionCandidates}
          initialVisible={visionVisible}
          initialPortionG={visionPortionG}
          onCancel={() => {
            setCookedFiles(null);
            setVisionCandidates(undefined);
            setVisionVisible(undefined);
            setVisionPortionG(undefined);
          }}
          onConfirm={(analysis) => {
            setCookedFiles(null);
            onScanComplete(analysis);
          }}
        />
      )}

      {/* Manual Review Modal */}
      {reviewPayload && (
        <ManualReviewModal
          initialNutrition={reviewPayload.nutrition}
          initialIngredientsText={reviewPayload.ingredientsText}
          initialProductName={reviewPayload.productName}
          initialBrand={reviewPayload.brand}
          initialClaims={reviewPayload.claims}
          scanMode={reviewPayload.mode}
          imageType={reviewPayload.imageType}
          imagePreviewUrl={reviewPayload.imagePreviewUrl}
          images={reviewPayload.images}
          detectionNotes={reviewPayload.detectionNotes}
          conflicts={reviewPayload.conflicts}
          evidence={reviewPayload.evidence}
          extractionSeq={reviewSeq}
          onAddAnotherPhoto={handleAddAnotherPhotoInReview}
          onConfirm={(analyzed) => {
            setReviewPayload(null);
            onScanComplete(analyzed);
          }}
          onCancel={() => setReviewPayload(null)}
        />
      )}
    </div>
  );
}
