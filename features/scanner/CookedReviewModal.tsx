'use client';

/**
 * Cooked-food review modal (v2).
 *
 * Flow: quality check → dish identification (vision model when configured,
 * otherwise user selection — never guessed silently) → portion input →
 * live estimate with explicit uncertainty → confirm → cooked report.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { isVisionConfigured, visionAnalyzeCooked } from '@/features/engine-v2/vision-provider';
import { compileProductAnalysis } from '@/features/scoring/engine';
import { CookedFoodReport } from '@/features/engine-v2/types';

interface CookedReviewModalProps {
  files: File[];
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

export function CookedReviewModal({ files, onConfirm, onCancel }: CookedReviewModalProps) {
  const [query, setQuery] = useState('');
  const [dishId, setDishId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [piecesInput, setPiecesInput] = useState('');
  const [visibleIngredients, setVisibleIngredients] = useState<string[]>([]);
  const [qualityNote, setQualityNote] = useState<string | null>(null);
  const [visionNote, setVisionNote] = useState<string | null>(null);
  const [visionBusy, setVisionBusy] = useState(false);

  const dish = dishId ? getDishById(dishId) : null;

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

  // Vision model classification — only when an endpoint is configured.
  useEffect(() => {
    if (!isVisionConfigured() || !previewUrl) return;
    let cancelled = false;
    (async () => {
      setVisionBusy(true);
      try {
        const res = await visionAnalyzeCooked({
          images: [{ dataUrl: previewUrl }],
          mode: 'cooked',
        });
        if (cancelled || !res?.dish) return;
        const matches = findDishes(res.dish);
        if (matches.length > 0) {
          setDishId(matches[0].id);
          setVisionNote(
            `Vision model suggests "${res.dish}" (${Math.round((res.confidence ?? 0.5) * 100)}% confidence) — please confirm or correct.`
          );
        }
      } catch {
        setVisionNote(
          'Cloud vision is configured but currently unreachable — identify the dish below instead.'
        );
      } finally {
        if (!cancelled) setVisionBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

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
      classificationProvenance: visionNote?.includes('Vision model')
        ? 'vision_estimate'
        : 'user_provided',
      classificationConfidence: visionNote?.includes('Vision model') ? 0.6 : 0.9,
      portion: estimate.portion,
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      fiber: estimate.fiber ?? undefined,
      sodium: estimate.sodium ?? undefined,
      visibleIngredients,
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
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Asking the configured vision model…
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
