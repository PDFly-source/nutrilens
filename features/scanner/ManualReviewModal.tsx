'use client';

import React, { useEffect, useRef, useState } from 'react';
import { NUTRITION_NUMERIC_FIELDS } from '@/features/ocr/merge';
import { FieldEvidenceMap } from '@/features/engine-v2/types';
import { NutritionData, ScanMode, ImageType, ProductAnalysis, ScanImageItem } from '@/types/food';
import { parseIngredientsText } from '@/features/ocr/parser';
import { compileProductAnalysis } from '@/features/scoring/engine';
import {
  Check,
  AlertCircle,
  Edit3,
  X,
  Plus,
  Trash2,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ManualReviewModalProps {
  initialNutrition: NutritionData;
  initialIngredientsText: string;
  initialProductName?: string;
  initialBrand?: string | null;
  initialClaims?: string[];
  scanMode: ScanMode;
  imageType?: ImageType;
  imagePreviewUrl?: string;
  images?: ScanImageItem[];
  detectionNotes?: string;
  /** Fields whose readings conflicted across photos — shown for manual review. */
  conflicts?: string[];
  /** v2: per-field provenance for evidence-aware status chips. */
  evidence?: FieldEvidenceMap;
  /**
   * Incremented when a new extraction is merged into the initial* props
   * (e.g. results from an additional photo). Non-dirty fields are refreshed;
   * fields the user manually edited are never overwritten.
   */
  extractionSeq?: number;
  onConfirm: (analyzedProduct: ProductAnalysis) => void;
  onCancel: () => void;
  onAddAnotherPhoto?: (file: File) => void;
}

export function ManualReviewModal({
  initialNutrition,
  initialIngredientsText,
  initialProductName = 'Packaged Food Product',
  initialBrand = null,
  initialClaims = [],
  scanMode,
  imageType = 'full_package',
  imagePreviewUrl,
  images = [],
  detectionNotes,
  conflicts = [],
  evidence,
  extractionSeq = 0,
  onConfirm,
  onCancel,
  onAddAnotherPhoto,
}: ManualReviewModalProps) {
  const [productName, setProductName] = useState(initialProductName);
  const [brand, setBrand] = useState<string | null>(initialBrand);
  const [nutrition, setNutrition] = useState<NutritionData>(initialNutrition);
  const [ingredientsText, setIngredientsText] = useState(initialIngredientsText);
  const [claims, setClaims] = useState<string[]>(initialClaims);
  const [newClaimInput, setNewClaimInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Fields the user manually edited — protected from later extractions.
  const dirtyNutritionRef = useRef<Set<string>>(new Set());
  const dirtyScalarRef = useRef<Set<string>>(new Set());

  // When a new extraction arrives (extractionSeq changed — e.g. the user added
  // another photo), refresh only fields the user has NOT manually edited.
  // User edits always survive; previously extracted evidence is kept.
  useEffect(() => {
    if (extractionSeq <= 0) return;
    setNutrition((prev) => {
      const next: NutritionData = { ...prev };
      for (const field of NUTRITION_NUMERIC_FIELDS) {
        if (!dirtyNutritionRef.current.has(field)) {
          (next as any)[field] = (initialNutrition as any)[field] ?? null;
        }
      }
      if (!dirtyNutritionRef.current.has('servingSize') && initialNutrition.servingSize) {
        next.servingSize = initialNutrition.servingSize;
      }
      if (!dirtyNutritionRef.current.has('servingsPerContainer')) {
        next.servingsPerContainer = initialNutrition.servingsPerContainer;
      }
      return next;
    });
    if (!dirtyScalarRef.current.has('productName')) setProductName(initialProductName);
    if (!dirtyScalarRef.current.has('brand')) setBrand(initialBrand);
    if (!dirtyScalarRef.current.has('ingredientsText')) setIngredientsText(initialIngredientsText);
    if (!dirtyScalarRef.current.has('claims')) setClaims(initialClaims);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractionSeq]);

  // Check if at least some verified data exists
  const hasSomeNutrition =
    nutrition.calories !== null ||
    nutrition.protein !== null ||
    nutrition.totalFat !== null ||
    nutrition.sodium !== null;

  const hasIngredients = ingredientsText.trim().length > 3;

  // Validation Warnings
  const validationWarnings: string[] = [];
  if (
    nutrition.addedSugars !== null &&
    nutrition.totalSugars !== null &&
    nutrition.addedSugars > nutrition.totalSugars &&
    nutrition.totalSugars > 0
  ) {
    validationWarnings.push('Added sugar is greater than total sugar. Verify values.');
  }
  if (
    nutrition.saturatedFat !== null &&
    nutrition.totalFat !== null &&
    nutrition.saturatedFat > nutrition.totalFat &&
    nutrition.totalFat > 0
  ) {
    validationWarnings.push('Saturated fat cannot exceed total fat.');
  }
  if (
    nutrition.calories === 0 &&
    ((nutrition.totalFat !== null && nutrition.totalFat > 1) ||
      (nutrition.totalCarbs !== null && nutrition.totalCarbs > 2))
  ) {
    validationWarnings.push('Calories are listed as 0 while macronutrients are present. Check label.');
  }

  // Handle number input with strict null preservation
  const handleNutrientNumberChange = (field: keyof NutritionData, rawVal: string) => {
    dirtyNutritionRef.current.add(String(field));
    const trimmed = rawVal.trim();
    if (trimmed === '') {
      setNutrition((prev) => ({ ...prev, [field]: null }));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed)) {
      setNutrition((prev) => ({ ...prev, [field]: parsed }));
    }
  };

  const handleAddClaim = () => {
    if (newClaimInput.trim() && !claims.includes(newClaimInput.trim())) {
      setClaims([...claims, newClaimInput.trim()]);
      setNewClaimInput('');
    }
  };

  const handleRemoveClaim = (claimToRemove: string) => {
    setClaims(claims.filter((c) => c !== claimToRemove));
  };

  const handleAddPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAddAnotherPhoto) {
      onAddAnotherPhoto(file);
    }
  };

  const handleSubmit = () => {
    const parsedIngrs = parseIngredientsText(ingredientsText);
    const analyzed = compileProductAnalysis({
      scanMode,
      imageType,
      productName: productName.trim() || 'Scanned Packaged Food',
      brand,
      nutrition,
      ingredients: parsedIngrs.items,
      rawIngredientsText: ingredientsText,
      detectedClaims: claims,
      imagePreviewUrl,
      images,
      detectionNotes,
    });
    onConfirm(analyzed);
  };

  // Human-readable image type banner
  const getImageTypeBadge = () => {
    switch (imageType) {
      case 'front_package':
        return {
          title: 'Front Package Detected',
          desc: 'Brand & product title detected. Nutrition facts panel not visible on this photo.',
          color: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300',
        };
      case 'nutrition_label':
      case 'back_package':
        return {
          title: 'Nutrition Label / Back Package Detected',
          desc: 'Nutrition table and packaging details inspected.',
          color: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300',
        };
      case 'multi_panel':
      case 'full_package':
        return {
          title: 'Combined / Multi-Panel Package',
          desc: 'Full packaging details & nutritional statement analyzed.',
          color: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300',
        };
      default:
        return {
          title: 'Packaged Food Label',
          desc: 'Review and confirm extracted details.',
          color: 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300',
        };
    }
  };

  const badgeInfo = getImageTypeBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#FFFFFF] dark:bg-[#1A211D] text-[#17201B] dark:text-[#EAEFEA] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#159A6A] flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Review Detected Information</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Values not detected in the image stay empty. Tap any field to verify or correct.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Image Type Status Banner */}
        <div className={`px-6 py-3 border-b flex items-start justify-between gap-3 text-xs ${badgeInfo.color}`}>
          <div>
            <div className="font-semibold">{badgeInfo.title}</div>
            <div>{badgeInfo.desc}</div>
          </div>
          {onAddAnotherPhoto && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleAddPhotoChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 font-medium text-xs hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#159A6A]" />
                <span>+ Add Back / Nutrition Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Honest detection notes from the OCR pipeline */}
        {detectionNotes && (
          <div className="px-6 py-2.5 bg-stone-50 dark:bg-stone-900/60 border-b border-stone-100 dark:border-stone-800 flex items-start gap-2 text-xs text-stone-600 dark:text-stone-400">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#159A6A]" />
            <span>{detectionNotes}</span>
          </div>
        )}

        {/* Cross-photo conflicting readings — flagged for manual review */}
        {conflicts.length > 0 && (
          <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
            <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Conflicting readings between photos for <strong>{conflicts.join(', ')}</strong>.
              The first detected value was kept — please verify it against the label.
            </span>
          </div>
        )}

        {/* Validation Warning Notice if any */}
        {validationWarnings.length > 0 && (
          <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              {validationWarnings.map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Photo Gallery Thumbnails */}
          {images.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Scan Session Photos ({images.length})
                </span>
                {onAddAnotherPhoto && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[#159A6A] hover:underline font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Photo
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 shrink-0 shadow-sm"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={img.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate text-center">
                      {img.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Name & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Product Name
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => {
                  dirtyScalarRef.current.add('productName');
                  setProductName(e.target.value);
                }}
                placeholder="Not detected — e.g. 2-Minute Noodles"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Brand
              </label>
              <input
                type="text"
                value={brand || ''}
                onChange={(e) => {
                  dirtyScalarRef.current.add('brand');
                  setBrand(e.target.value || null);
                }}
                placeholder="e.g. Bikaji"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
              />
            </div>
          </div>

          {/* Serving Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  Serving Size / Basis
                </label>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${nutrition.servingSize ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>
                  {nutrition.servingSize ? 'Detected' : 'Not detected'}
                </span>
              </div>
              <input
                type="text"
                value={nutrition.servingSize || ''}
                onChange={(e) => {
                    dirtyNutritionRef.current.add('servingSize');
                    setNutrition((prev) => ({ ...prev, servingSize: e.target.value || null }));
                  }}
                placeholder="Not detected (e.g. 100g or 30g)"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                  Servings Per Container
                </label>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${nutrition.servingsPerContainer !== null ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>
                  {nutrition.servingsPerContainer !== null ? 'Detected' : 'Not detected'}
                </span>
              </div>
              <input
                type="number"
                step="any"
                value={nutrition.servingsPerContainer !== null ? nutrition.servingsPerContainer : ''}
                onChange={(e) => handleNutrientNumberChange('servingsPerContainer', e.target.value)}
                placeholder="Not detected"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
              />
            </div>
          </div>

          {/* Nutrition Table Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Nutrition Facts Table
              </label>
              <span className="text-[11px] text-stone-500">
                Leave blank if not detected on label
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Calories', field: 'calories' as keyof NutritionData, unit: 'kcal' },
                { label: 'Protein', field: 'protein' as keyof NutritionData, unit: 'g' },
                { label: 'Total Fat', field: 'totalFat' as keyof NutritionData, unit: 'g' },
                { label: 'Saturated Fat', field: 'saturatedFat' as keyof NutritionData, unit: 'g' },
                { label: 'Trans Fat', field: 'transFat' as keyof NutritionData, unit: 'g' },
                { label: 'Cholesterol', field: 'cholesterol' as keyof NutritionData, unit: 'mg' },
                { label: 'Sodium', field: 'sodium' as keyof NutritionData, unit: 'mg' },
                { label: 'Total Carbs', field: 'totalCarbs' as keyof NutritionData, unit: 'g' },
                { label: 'Dietary Fiber', field: 'dietaryFiber' as keyof NutritionData, unit: 'g' },
                { label: 'Total Sugars', field: 'totalSugars' as keyof NutritionData, unit: 'g' },
                { label: 'Added Sugars', field: 'addedSugars' as keyof NutritionData, unit: 'g' },
                { label: 'Salt', field: 'salt' as keyof NutritionData, unit: 'g' },
              ].map(({ label, field, unit }) => {
                const val = nutrition[field] as number | null;
                const isDetected = val !== null;

                return (
                  <div key={field} className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-stone-700 dark:text-stone-300">{label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDetected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold' : 'bg-stone-200/60 dark:bg-stone-800 text-stone-500'}`}>
                        {(() => {
                          if (!isDetected) return 'Not detected';
                          const edited = dirtyNutritionRef.current.has(String(field));
                          const prov = evidence?.[String(field)]?.provenance;
                          const tag = edited ? 'Edited' : prov === 'visually_observed' ? 'OCR' : val !== null ? 'Detected' : '';
                          return tag ? `${tag}: ${val}${unit}` : `${val}${unit}`;
                        })()}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={val !== null ? val : ''}
                        onChange={(e) => handleNutrientNumberChange(field, e.target.value)}
                        placeholder="Not detected"
                        className="w-full pr-7 pl-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:outline-none focus:ring-1 focus:ring-[#159A6A] placeholder:text-stone-400 placeholder:text-xs"
                      />
                      <span className="absolute right-2 top-2 text-xs text-stone-400 font-mono pointer-events-none">
                        {unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ingredients Deck */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                Ingredients Statement
              </label>
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${ingredientsText.trim() ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>
                {ingredientsText.trim() ? 'Detected' : 'Not detected'}
              </span>
            </div>
            <textarea
              rows={3}
              value={ingredientsText}
              onChange={(e) => {
                dirtyScalarRef.current.add('ingredientsText');
                dirtyScalarRef.current.add('ingredientsText');
                setIngredientsText(e.target.value);
              }}
              placeholder="e.g. Moth Dal Flour, Besan, Edible Vegetable Oil, Iodised Salt, Spices & Condiments"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
            />
          </div>

          {/* Marketing Claims */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
              Marketing & Health Claims
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {claims.map((claim) => (
                <span
                  key={claim}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#08734E] dark:text-emerald-300 text-xs font-medium"
                >
                  {claim}
                  <button
                    type="button"
                    onClick={() => handleRemoveClaim(claim)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {claims.length === 0 && (
                <span className="text-xs text-stone-400 italic">No marketing claims tagged.</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newClaimInput}
                onChange={(e) => setNewClaimInput(e.target.value)}
                placeholder="e.g. Gluten Free, High Protein, Zero Added Sugar"
                className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-xs focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
              />
              <button
                type="button"
                onClick={handleAddClaim}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-xs font-medium text-stone-700 dark:text-stone-300 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-medium transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-sm font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Generate Intelligence Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
