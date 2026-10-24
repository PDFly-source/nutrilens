'use client';

import React, { useState, useRef } from 'react';
import { ScanMode, NutritionData, ProductAnalysis, ImageType, ScanImageItem } from '@/types/food';
import { CameraModal } from '@/features/scanner/CameraModal';
import { ManualReviewModal } from '@/features/scanner/ManualReviewModal';
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
    mode: ScanMode;
  } | null>(null);
  // Incremented whenever a new extraction (e.g. an added photo's results)
  // is merged into the review payload, so the review modal can apply the
  // merge without clobbering fields the user has manually edited.
  const [reviewSeq, setReviewSeq] = useState(0);

  // Trigger analysis on an array of files
  const runFileAnalysis = async (files: File[], mode: ScanMode = 'nutrition') => {
    if (!files || files.length === 0) return;

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
