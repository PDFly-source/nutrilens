'use client';

/**
 * Cooked-food review modal (v2).
 *
 * Flow: quality check → dish identification (on-device Food-101 model,
 * otherwise user selection — never guessed silently) → portion input →
 * live estimate with explicit uncertainty → confirm → cooked report.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
  Loader2,
  Flame,
  Scale,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { ProductAnalysis, ScanImageItem, NutritionData, ScanMode } from '@/types/food';
import { DISH_DATABASE, findDishes, getDishById } from '@/features/engine-v2/cooked/dishes';
import {
  estimateNutrition,
  midpointMacros,
  EstimatorInput,
} from '@/features/engine-v2/cooked/estimator';
import { assessImageQualityBrowser } from '@/features/engine-v2/image-quality';
import { visionAnalyzeCooked, isVisionConfigured } from '@/features/engine-v2/vision-provider';
import {
  browserClassifyCooked,
  watchVisionStatus,
  ImageDecodeError,
  ModelDownloadError,
  InferenceError,
  type VisionStatus,
} from '@/features/engine-v2/browser-vision';
import { compileProductAnalysis } from '@/features/scoring/engine';
import { CookedFoodReport } from '@/features/engine-v2/types';
import { DishCandidate, isAmbiguous } from '@/features/engine-v2/vision-mapping';

interface CookedReviewModalProps {
  files: File[];
  /** v2.1: ranked candidates from an automatic vision classification, if any. */
  initialCandidates?: DishCandidate[];
  initialVisible?: string[];
  initialPortionG?: number | null;
  onConfirm: (analysis: ProductAnalysis) => void;
  onCancel: () => void;
}

function emptyNutrition(): NutritionData {
  return {
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
  };
}

export function CookedReviewModal({
  files,
  initialCandidates,
  initialVisible,
  initialPortionG,
  onConfirm,
  onCancel,
}: CookedReviewModalProps) {
  const [query, setQuery] = useState('');
  const [weightInput, setWeightInput] = useState(() =>
    initialPortionG ? String(initialPortionG) : ''
  );
  const [piecesInput, setPiecesInput] = useState('');
  const [visibleIngredients, setVisibleIngredients] = useState<string[]>(() =>
    initialVisible && initialVisible.length > 0 ? initialVisible : []
  );
  const [qualityNote, setQualityNote] = useState<string | null>(null);
  const [visionNote, setVisionNote] = useState<string | null>(() => {
    const first = initialCandidates?.find((c) => findDishes(c.name).length > 0);
    if (!initialCandidates || initialCandidates.length === 0) return null;
    if (!first) {
      return 'The recognition model could not match this photo to a known dish in our database — pick the closest option below.';
    }
    const pct = Math.round(first.confidence * 100);
    return isAmbiguous(initialCandidates)
      ? `Recognition ranked this as "${first.name}" (${pct}% confidence) but it is ambiguous — please confirm the dish below.`
      : `Recognition identified "${first.name}" (${pct}%) — pre-selected for you, correct it if wrong.`;
  });
  const [visionBusy, setVisionBusy] = useState(() => !initialCandidates?.length);
  const [visionStatus, setVisionStatus] = useState<VisionStatus>({ state: 'idle' });
  // v2.1: follow-up answers (user-provided evidence)
  const [fillingInput, setFillingInput] = useState('');
  const [sauceInput, setSauceInput] = useState('');


  const previewUrl = useMemo(() => (files[0] ? URL.createObjectURL(files[0]) : null), [files]);

  // Quality check on the first photo (advisory).
  useEffect(() => {
    if (!previewUrl) return;
    const img = new Image();
    img.onload = async () => {
      const q = await assessImageQualityBrowser(img);
      setQualityNote(q.verdict === 'poor' ? q.advice : null);
    };
    img.src = previewUrl;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // v2.1: automatic classification results are applied ONCE during the
  // first render via lazy initial state (no effect → no cascading renders).
  const [dishId, setDishId] = useState<string | null>(() => {
    const first = initialCandidates?.find((c) => findDishes(c.name).length > 0);
    return first ? findDishes(first.name)[0].id : null;
  });
  const dish = dishId ? getDishById(dishId) : null;


  // In-modal classification when ScanHub did not pre-classify (e.g. the
  // user picked Cooked mode directly). v2.2: the ON-DEVICE Food-101 model
  // runs by default — no API key, no cloud. If an optional cloud endpoint
  // is configured, it refines candidates on top (still never auto-submits).
  useEffect(() => {
    if (!previewUrl || initialCandidates?.length) return;
    let cancelled = false;
    const unsubscribe = watchVisionStatus((st: VisionStatus) => {
      if (!cancelled) setVisionStatus(st);
    });
    (async () => {
      try {
        // 1) On-device classification (no credentials required).
        const blob = await (await fetch(previewUrl)).blob();
        const res = await browserClassifyCooked(blob);
        let candidates = res.candidates;
        let notes: string[] = [];
        if (res.note) notes.push(res.note);
        // 2) Optional cloud refinement — only when genuinely configured.
        if (isVisionConfigured()) {
          try {
            const cloud = await visionAnalyzeCooked({
              images: [{ dataUrl: previewUrl }],
              mode: 'cooked',
            });
            if (cloud && cloud.candidates.length > 0) {
              candidates = cloud.candidates;
              notes = cloud.note ? [cloud.note] : [];
            }
          } catch {
            notes.push('Optional cloud adapter unreachable — using on-device recognition.');
          }
        }
        if (cancelled) return;
        const ranked = candidates
          .map((c) => ({
            c,
            dishes: c.dishId
              ? [getDishById(c.dishId)].filter((d): d is NonNullable<typeof d> => d !== null)
              : findDishes(c.name),
          }))
          .filter((r) => r.dishes.length > 0);
        if (ranked.length > 0) {
          setDishId(ranked[0].dishes[0].id);
          const pct = Math.round(ranked[0].c.confidence * 100);
          const near = ranked[0].c.kind === 'near' ? ranked[0].c.note ?? '' : '';
          setVisionNote(
            [
              ...notes,
              near,
              isAmbiguous(candidates)
                ? `Ranked "${ranked[0].c.name}" first (${pct}%) but ambiguous — please confirm.`
                : `Identified as "${ranked[0].c.name}" (${pct}%) — correct it if wrong.`,
            ]
              .filter(Boolean)
              .join(' ')
          );
        } else if (candidates.length === 0 && res.note) {
          setVisionNote(res.note);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ModelDownloadError) {
          setVisionNote(
            'On-device recognition needs a one-time ~9.4 MB model download. Identify the dish below, or retry when back online.'
          );
        } else if (err instanceof ImageDecodeError) {
          setVisionNote(err.message);
        } else if (err instanceof InferenceError) {
          setVisionNote('On-device recognition failed on this photo — identify the dish below instead.');
        } else {
          setVisionNote('Recognition is unavailable right now — identify the dish below instead.');
        }
      } finally {
        if (!cancelled) {
          setVisionBusy(false);
          unsubscribe();
        }
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [previewUrl, initialCandidates]);

  const matches = useMemo(() => {
    const byQuery = findDishes(query);
    return byQuery.length > 0 ? byQuery : query.trim() ? [] : DISH_DATABASE;
  }, [query]);

  const estimate = useMemo(() => {
    if (!dish) return null;
    const input: EstimatorInput = {
      dish,
      userWeightG: weightInput ? parseFloat(weightInput) : null,
      userPieces: piecesInput ? parseInt(piecesInput, 10) : null,
    };
    if (input.userWeightG !== null && (isNaN(input.userWeightG as number) || (input.userWeightG as number) <= 0)) input.userWeightG = null;
    if (input.userPieces !== null && (isNaN(input.userPieces as number) || (input.userPieces as number) <= 0)) input.userPieces = null;
    return estimateNutrition(input);
  }, [dish, weightInput, piecesInput]);

  const handleToggleVisible = (name: string) => {
    setVisibleIngredients((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const handleConfirm = () => {
    if (!dish || !estimate) return;
    const mid = midpointMacros(estimate);
    const nutrition: NutritionData = { ...emptyNutrition(), basis: 'per_serving' };
    nutrition.calories = mid.calories;
    nutrition.protein = mid.protein;
    nutrition.totalCarbs = mid.totalCarbs;
    nutrition.totalFat = mid.totalFat;
    nutrition.dietaryFiber = mid.dietaryFiber;
    nutrition.sodium = mid.sodium;
    nutrition.servingSize = `${estimate.portion.grams} g (estimated portion)`;

    const cookedReport: CookedFoodReport = {
      dishId: dish.id,
      dishName: dish.name,
      alternatives: matches.filter((m) => m.id !== dish.id).slice(0, 3).map((m) => m.name),
      classificationProvenance: visionNote?.includes('Recognition')
        ? 'vision_estimate'
        : 'user_provided',
      classificationConfidence: visionNote?.includes('Recognition') ? 0.6 : 0.9,
      portion: estimate.portion,
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      fiber: estimate.fiber ?? undefined,
      sodium: estimate.sodium ?? undefined,
      visibleIngredients: [
        ...visibleIngredients,
        ...[fillingInput.trim(), sauceInput.trim()].filter(Boolean).map((t) => `${t} (you told us)`),
      ],
      inferredIngredients: dish.typicalVisible.filter((v) => !visibleIngredients.includes(v)),
      cookingMethod: dish.cookingMethod.replace('_', ' '),
      assumptions: estimate.assumptions,
      unknowns: estimate.unknowns,
      nutritionSource: dish.nutrition.source,
    };

    const images: ScanImageItem[] = files.map((f, i) => ({
      id: `cooked-${i}`,
      dataUrl: previewUrl || '',
      name: f.name,
      label: `Cooked dish photo ${i + 1}`,
    }));

    const analysis = compileProductAnalysis({
      scanMode: 'product' as ScanMode,
      imageType: undefined,
      productName: dish.name,
      brand: null,
      productVariant: null,
      packageSize: `${estimate.portion.grams} g (estimated portion)`,
      nutrition,
      ingredients: [],
      rawIngredientsText: visibleIngredients.join(', '),
      detectedClaims: [],
      imagePreviewUrl: previewUrl || undefined,
      images,
      nutritionConfidence: 'low',
      detectionNotes:
        'Estimated values for a cooked dish — ranges reflect typical preparations, not measurements.',
    });
    analysis.analysisKind = 'cooked';
    analysis.cookedReport = cookedReport;
    onConfirm(analysis);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#FFFFFF] dark:bg-[#1A211D] text-[#17201B] dark:text-[#EAEFEA] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
              Cooked Food Analysis
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Estimates from a curated dish database — not label measurements.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5">
          {/* Quality / vision notes */}
          {qualityNote && (
            <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{qualityNote}</span>
            </div>
          )}
          {visionBusy && (
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />{' '}
              {visionStatus.state === 'downloading'
                ? `Downloading on-device recognition model… ${Math.round(
                    visionStatus.total
                      ? (visionStatus.received / visionStatus.total) * 100
                      : (visionStatus.received / (9.4 * 1024 * 1024)) * 100
                  )}%`
                : 'Analyzing your photo on this device…'}
            </div>
          )}
          {visionNote && (
            <div className="flex items-start gap-2 text-xs bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 rounded-xl px-3 py-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#159A6A]" />
              <span>{visionNote}</span>
            </div>
          )}

          {/* Dish identification */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
              Which dish is this?
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. momo, samosa, chowmein, rajma…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {matches.slice(0, 9).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setDishId(d.id);
                    setVisibleIngredients([]);
                    setPiecesInput('');
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                    dishId === d.id
                      ? 'border-[#159A6A] bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#0F7B52] dark:text-emerald-300'
                      : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  {d.name}
                </button>
              ))}
              {matches.length === 0 && query.trim() && (
                <p className="col-span-full text-xs text-stone-500">
                  No dish in the database matches “{query}”. Try a simpler term (e.g. “noodles”),
                  or use packaged-food mode if this is a packaged product.
                </p>
              )}
            </div>
          </div>

          {/* Portion */}
          {dish && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Portion weight (g) — most accurate
                </label>
                <input
                  type="number"
                  min="1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder={dish ? `${dish.typicalServeMinG}–${dish.typicalServeMaxG} g typical` : ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
                />
              </div>
              {dish.pieceWeightMinG && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    …or number of pieces
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={piecesInput}
                    onChange={(e) => setPiecesInput(e.target.value)}
                    placeholder={`e.g. 6 (${dish.pieceWeightMinG}–${dish.pieceWeightMaxG} g each)`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
                  />
                </div>
              )}
            </div>
          )}

          {/* v2.1: follow-up questions — answers are user-provided evidence */}
          {dish && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Filling / main component? (optional)
                </label>
                <input
                  type="text"
                  value={fillingInput}
                  onChange={(e) => setFillingInput(e.target.value)}
                  placeholder="e.g. veg momo, potato samosa, paneer…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                  Sauce / chutney on the side? (optional)
                </label>
                <input
                  type="text"
                  value={sauceInput}
                  onChange={(e) => setSauceInput(e.target.value)}
                  placeholder="e.g. tomato chutney, mayo-dip…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#159A6A]"
                />
              </div>
              {DISH_DATABASE.filter(
                (d) => d.id !== dish.id && d.category === dish.category && d.cookingMethod !== dish.cookingMethod
              ).length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Cooking method — does a variant below fit better?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DISH_DATABASE.filter(
                      (d) => d.id !== dish.id && d.category === dish.category && d.cookingMethod !== dish.cookingMethod
                    ).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setDishId(v.id)}
                        className="px-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                      >
                        {v.name} ({v.cookingMethod.replace('_', ' ')})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visible ingredients */}
          {dish && dish.typicalVisible.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                What can you actually see? (optional, honest only)
              </label>
              <div className="flex flex-wrap gap-2">
                {dish.typicalVisible.map((v) => (
                  <button
                    key={v}
                    onClick={() => handleToggleVisible(v)}
                    className={`px-3 py-1.5 rounded-full border text-xs transition-colors flex items-center gap-1.5 ${
                      visibleIngredients.includes(v)
                        ? 'border-[#159A6A] bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#0F7B52] dark:text-emerald-300'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {visibleIngredients.includes(v) ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live estimate */}
          {estimate && (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" /> Estimated portion
                </span>
                <span className="text-xs text-stone-500">
                  {estimate.portion.grams} g — {estimate.portion.method.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mb-3 flex items-start gap-1">
                <HelpCircle className="w-3 h-3 mt-0.5 shrink-0" /> {estimate.portion.uncertainty}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                  <div className="text-[10px] font-semibold text-stone-500 uppercase flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-500" /> Calories
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    {estimate.calories.min}–{estimate.calories.max} kcal
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                  <div className="text-[10px] font-semibold text-stone-500 uppercase">Protein</div>
                  <div className="text-sm font-semibold mt-1">
                    {estimate.protein.min}–{estimate.protein.max} g
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                  <div className="text-[10px] font-semibold text-stone-500 uppercase">Carbs</div>
                  <div className="text-sm font-semibold mt-1">
                    {estimate.carbs.min}–{estimate.carbs.max} g
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                  <div className="text-[10px] font-semibold text-stone-500 uppercase">Fat</div>
                  <div className="text-sm font-semibold mt-1">
                    {estimate.fat.min}–{estimate.fat.max} g
                  </div>
                </div>
                {estimate.fiber && (
                  <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                    <div className="text-[10px] font-semibold text-stone-500 uppercase">Fibre</div>
                    <div className="text-sm font-semibold mt-1">
                      {estimate.fiber.min}–{estimate.fiber.max} g
                    </div>
                  </div>
                )}
                {estimate.sodium && (
                  <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-3">
                    <div className="text-[10px] font-semibold text-stone-500 uppercase">Sodium</div>
                    <div className="text-sm font-semibold mt-1">
                      {estimate.sodium.min}–{estimate.sodium.max} mg
                    </div>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-stone-500 mt-3">
                Source: {dish?.nutrition.source}. These are plausible ranges — the app cannot
                measure what is actually in your specific dish.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 shrink-0 flex items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500 flex items-start gap-1">
            <Eye className="w-3 h-3 mt-0.5 shrink-0" />
            Hidden ingredients, oil and salt stay unknown — they are never invented.
          </p>
          <button
            onClick={handleConfirm}
            disabled={!dish}
            className="px-5 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#12855A] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Generate cooked-food report
          </button>
        </div>
      </div>
    </div>
  );
}
