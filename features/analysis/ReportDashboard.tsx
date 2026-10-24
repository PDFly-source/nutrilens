'use client';

import React, { useState } from 'react';
import { ProductAnalysis, IngredientItem } from '@/types/food';
import { useSession } from '@/features/session/SessionContext';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Info,
  Scale,
  Sparkles,
  Download,
  Share2,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Check,
  Eye,
  Sliders,
  X,
  Layers,
  ArrowRight,
  Camera,
  Plus,
} from 'lucide-react';

interface ReportDashboardProps {
  analysis: ProductAnalysis;
  onScanAnother: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
}

export function ReportDashboard({
  analysis,
  onScanAnother,
  onCompare,
  onExport,
  onShare,
}: ReportDashboardProps) {
  const { preferenceResults } = useSession();

  // Serving multiplier calculator state
  const [servingsMultiplier, setServingsMultiplier] = useState<number>(1);

  // Score transparency drawer open state
  const [showScoreTransparency, setShowScoreTransparency] = useState(false);

  // Ingredient search & selected ingredient for smart explainer
  const [ingredientFilter, setIngredientFilter] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientItem | null>(null);

  const n = analysis.nutrition;

  // Format helper: Never output "0" for null!
  const formatScaled = (val: number | null | undefined, unit: string) => {
    if (val === null || val === undefined) {
      return { text: 'Not detected', isNull: true };
    }
    const scaled = Math.round(val * servingsMultiplier * 10) / 10;
    return { text: `${scaled} ${unit}`.trim(), isNull: false };
  };

  const filteredIngredients = analysis.ingredients.filter(
    (i) =>
      i.name.toLowerCase().includes(ingredientFilter.toLowerCase()) ||
      i.role.toLowerCase().includes(ingredientFilter.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-[#159A6A] border-[#159A6A] bg-[#DDF5EA]/30';
    if (score >= 50) return 'text-[#E7A23B] border-[#E7A23B] bg-amber-50 dark:bg-amber-950/20';
    return 'text-[#D95757] border-[#D95757] bg-red-50 dark:bg-red-950/20';
  };

  const isScoreAvailable = analysis.scores.isScoreAvailable !== false;
  const isFrontPackageOnly =
    analysis.imageType === 'front_package' && !analysis.hasVerifiedNutritionData;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-[#159A6A] dark:text-[#B9D94C] uppercase tracking-wider">
            Food Intelligence Report
          </span>
          <span className="text-stone-300 dark:text-stone-700">·</span>
          <span className="text-stone-500">In-Memory Session Only</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1A211D] text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1A211D] text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Local Report
          </button>
        </div>
      </div>

      {/* Front Package Callout if Nutrition Facts are Missing */}
      {isFrontPackageOnly && (
        <div className="p-5 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200 text-sm">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Front Package Detected — Nutrition Panel Missing</span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300 max-w-xl leading-relaxed">
              We identified <strong>{analysis.productName}</strong> from the front packaging. To evaluate macronutrients and generate a verified health score, add the back panel photo.
            </p>
          </div>
          <button
            onClick={onScanAnother}
            className="px-4 py-2 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Scan Nutrition Panel</span>
          </button>
        </div>
      )}

      {/* Hero Product Header & Overall Score */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Identified Product
              </span>
              {analysis.brand && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 font-semibold text-[#159A6A]">
                  {analysis.brand}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {analysis.productName}
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Serving: {analysis.nutrition.servingSize || 'Not detected'} ·{' '}
              {analysis.nutrition.servingsPerContainer !== null
                ? `${analysis.nutrition.servingsPerContainer} servings/container`
                : 'Servings per container: Not detected'}
            </p>
          </div>

          {/* Primary Score Ring or Unavailable State */}
          <div className="flex items-center gap-4">
            {isScoreAvailable ? (
              <div
                className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center text-center shadow-inner ${getScoreColor(
                  analysis.scores.overall
                )}`}
              >
                <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight">
                  {analysis.scores.overall}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  / 100 Score
                </span>
              </div>
            ) : (
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-stone-300 dark:border-stone-700 flex flex-col items-center justify-center text-center bg-stone-50 dark:bg-stone-900">
                <span className="text-xs font-bold text-stone-400 uppercase">Pending</span>
                <span className="text-[9px] text-stone-500 px-1">Scan Label</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {isScoreAvailable
                  ? analysis.scores.overall >= 75
                    ? 'Nutritionally Favorable'
                    : analysis.scores.overall >= 50
                    ? 'Moderate Balance'
                    : 'High Scrutiny Profile'
                  : 'Score Pending'}
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs">
                {analysis.scores.unavailableReason ||
                  'Scientific composite score based on nutrition table density and additive scrutiny.'}
              </p>
              {isScoreAvailable && (
                <button
                  onClick={() => setShowScoreTransparency(!showScoreTransparency)}
                  className="text-xs text-[#159A6A] hover:underline flex items-center gap-1 font-medium pt-1"
                >
                  <span>{showScoreTransparency ? 'Hide calculation details' : 'How this was calculated'}</span>
                  {showScoreTransparency ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Score Breakdown Transparency Drawer */}
        {showScoreTransparency && isScoreAvailable && (
          <div className="mt-6 pt-6 border-t border-stone-100 dark:border-stone-800 animate-in fade-in space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800">
                <span className="text-xs text-stone-500">Nutrition Density (45%)</span>
                <div className="text-lg font-bold tabular-nums text-stone-800 dark:text-stone-200">
                  {analysis.scores.nutrition} / 100
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800">
                <span className="text-xs text-stone-500">Ingredient Deck (35%)</span>
                <div className="text-lg font-bold tabular-nums text-stone-800 dark:text-stone-200">
                  {analysis.scores.ingredients} / 100
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800">
                <span className="text-xs text-stone-500">Processing Level (20%)</span>
                <div className="text-lg font-bold tabular-nums text-stone-800 dark:text-stone-200">
                  {analysis.scores.processing} / 100
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Formula Factor Deductions & Bonuses
              </span>
              <div className="space-y-1.5">
                {analysis.scores.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded-xl bg-stone-50 dark:bg-stone-900/40"
                  >
                    <div>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {item.factor}:
                      </span>{' '}
                      <span className="text-stone-500 dark:text-stone-400">{item.rationale}</span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ml-3 ${
                        item.points > 0 ? 'text-[#159A6A]' : item.points < 0 ? 'text-[#D95757]' : 'text-stone-400'
                      }`}
                    >
                      {item.points > 0 ? `+${item.points}` : item.points} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Allergens Banner if detected */}
      {analysis.allergens.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                Allergen Detected
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Ingredients or label statements indicate: <strong>{analysis.allergens.join(', ')}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Marketing Claim Checker */}
      {analysis.marketingClaims.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Claim Integrity Check
            </span>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Packaging Claims vs Verified Nutrition
            </h3>
          </div>

          <div className="space-y-3">
            {analysis.marketingClaims.map((claim, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 flex items-start gap-3"
              >
                {claim.status === 'verified' && (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                {claim.status === 'caution' && (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                {claim.status === 'unsupported' && (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      &quot;{claim.claim}&quot;
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                        claim.status === 'verified'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700'
                          : claim.status === 'caution'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700'
                          : 'bg-red-100 dark:bg-red-950 text-red-700'
                      }`}
                    >
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
                    {claim.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Serving Calculator & Nutrition Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Interactive Nutrition Dashboard
            </span>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Nutrition Facts Table
            </h3>
          </div>

          {/* Quick Serving Steppers */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
            {[1, 2, 3].map((val) => (
              <button
                key={val}
                onClick={() => setServingsMultiplier(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  servingsMultiplier === val
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {val}x Serving
              </button>
            ))}
          </div>
        </div>

        {/* Scaled Macro Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Calories', val: n.calories, unit: 'kcal' },
            { label: 'Protein', val: n.protein, unit: 'g' },
            { label: 'Added Sugar', val: n.addedSugars, unit: 'g' },
            { label: 'Sodium', val: n.sodium, unit: 'mg' },
          ].map(({ label, val, unit }) => {
            const formatted = formatScaled(val, unit);
            return (
              <div
                key={label}
                className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-100 dark:border-stone-800"
              >
                <span className="text-[11px] text-stone-500">{label}</span>
                <div
                  className={`text-lg sm:text-xl font-bold tabular-nums ${
                    formatted.isNull
                      ? 'text-stone-400 text-xs font-normal pt-1'
                      : 'text-stone-900 dark:text-stone-100'
                  }`}
                >
                  {formatted.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {[
                { label: 'Total Carbohydrate', val: n.totalCarbs, unit: 'g', indent: false },
                { label: 'Dietary Fiber', val: n.dietaryFiber, unit: 'g', indent: true },
                { label: 'Total Sugars', val: n.totalSugars, unit: 'g', indent: true },
                { label: 'Total Fat', val: n.totalFat, unit: 'g', indent: false },
                { label: 'Saturated Fat', val: n.saturatedFat, unit: 'g', indent: true },
                { label: 'Trans Fat', val: n.transFat, unit: 'g', indent: true },
                { label: 'Cholesterol', val: n.cholesterol, unit: 'mg', indent: false },
                { label: 'Salt', val: n.salt, unit: 'g', indent: false },
              ].map(({ label, val, unit, indent }) => {
                const formatted = formatScaled(val, unit);
                return (
                  <tr key={label} className="py-2">
                    <td
                      className={`py-2 ${
                        indent
                          ? 'pl-4 text-stone-500'
                          : 'text-stone-600 dark:text-stone-400 font-medium'
                      }`}
                    >
                      {label}
                    </td>
                    <td
                      className={`py-2 text-right font-bold tabular-nums ${
                        formatted.isNull ? 'text-stone-400 font-normal italic' : ''
                      }`}
                    >
                      {formatted.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Ingredient List */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Deconstructed Ingredient Deck ({analysis.ingredients.length} items)
            </span>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Tap Any Ingredient to Decode
            </h3>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={ingredientFilter}
              onChange={(e) => setIngredientFilter(e.target.value)}
              placeholder="Search ingredient..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
            />
          </div>
        </div>

        {analysis.ingredients.length === 0 ? (
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/50 text-xs text-stone-500 italic text-center">
            No ingredients detected in this image. Add an ingredients panel photo to decode additives.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {filteredIngredients.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedIngredient(item)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border text-left transition-all ${
                  item.concernLevel === 'attention'
                    ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200 hover:border-red-400'
                    : item.concernLevel === 'moderate'
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 hover:border-amber-400'
                    : 'bg-stone-50 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:border-[#159A6A]'
                }`}
              >
                <span>{item.name}</span>
                {item.isUltraProcessedIndicator && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 uppercase font-mono">
                    UPF
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Ingredient Modal Drawer */}
      {selectedIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#1A211D] rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                  {selectedIngredient.category}
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  {selectedIngredient.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIngredient(null)}
                className="w-7 h-7 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-stone-600 dark:text-stone-300 space-y-2">
              <p>
                <strong>Role:</strong> {selectedIngredient.role}
              </p>
              <p>{selectedIngredient.description}</p>
              <p className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 font-mono text-[11px]">
                {selectedIngredient.rationale}
              </p>
            </div>
            <button
              onClick={() => setSelectedIngredient(null)}
              className="w-full py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Smart Food Swap Criteria */}
      {analysis.swapCriteria.length > 0 && (
        <div className="p-6 rounded-3xl bg-[#DDF5EA]/30 dark:bg-emerald-950/20 border border-[#159A6A]/30 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#159A6A]" />
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Better Choice Criteria (Smart Swap Guidance)
            </h3>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-300">
            Target criteria to look for when selecting alternatives:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {analysis.swapCriteria.map((swap, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#1A211D]/80 border border-stone-200/60 dark:border-stone-800"
              >
                <span className="text-xs font-bold text-[#159A6A]">{swap.label}</span>
                <p className="text-xs font-medium text-stone-800 dark:text-stone-200 mt-1">
                  Threshold: {swap.threshold}
                </p>
                <p className="text-[11px] text-stone-500 mt-0.5">{swap.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Bottom Quick Navigation Dock */}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/95 dark:bg-[#1A211D]/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-xl z-30">
        <button
          onClick={onScanAnother}
          className="flex-1 py-2.5 px-3 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Scan Another</span>
        </button>

        <button
          onClick={onCompare}
          className="flex-1 py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Compare Foods</span>
        </button>
      </div>
    </div>
  );
}
