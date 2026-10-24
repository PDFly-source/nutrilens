'use client';

import React from 'react';
import { useSession } from '@/features/session/SessionContext';
import {
  Scale,
  Plus,
  ArrowLeftRight,
  RotateCcw,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface CompareHubProps {
  onScanSecondProduct: () => void;
  onScanFirstProduct: () => void;
}

function formatCompVal(val: number | null | undefined, unit: string = ''): string {
  if (val === null || val === undefined) return 'Not detected';
  return `${val}${unit}`;
}

function compareHigher(a: number | null, b: number | null): 'A' | 'B' | 'tie' | null {
  if (a === null || b === null) return null;
  if (a > b) return 'A';
  if (b > a) return 'B';
  return 'tie';
}

function compareLower(a: number | null, b: number | null): 'A' | 'B' | 'tie' | null {
  if (a === null || b === null) return null;
  if (a < b) return 'A';
  if (b < a) return 'B';
  return 'tie';
}

export function CompareHub({ onScanSecondProduct, onScanFirstProduct }: CompareHubProps) {
  const { currentScan, compareScan, swapScans, setCompareScan } = useSession();

  if (!currentScan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#159A6A] flex items-center justify-center mx-auto">
          <Scale className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">
          Your Comparison Tray is Empty
        </h2>
        <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
          Scan your first packaged food to unlock side-by-side nutritional intelligence.
        </p>
        <button
          onClick={onScanFirstProduct}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Scan First Food
        </button>
      </div>
    );
  }

  const pA = currentScan;
  const pB = compareScan;

  // Comparison metrics rows
  const metrics = [
    {
      label: 'Overall Score',
      valA: pA.scores.isScoreAvailable ? `${pA.scores.overall}/100` : 'Unavailable',
      valB: pB ? (pB.scores.isScoreAvailable ? `${pB.scores.overall}/100` : 'Unavailable') : '-',
      winner: pB && pA.scores.isScoreAvailable && pB.scores.isScoreAvailable
        ? pA.scores.overall > pB.scores.overall
          ? 'A'
          : pB.scores.overall > pA.scores.overall
          ? 'B'
          : 'tie'
        : null,
      context: 'Higher overall density & quality',
    },
    {
      label: 'Calories (kcal)',
      valA: formatCompVal(pA.nutrition.calories, ' kcal'),
      valB: pB ? formatCompVal(pB.nutrition.calories, ' kcal') : '-',
      winner: pB ? compareLower(pA.nutrition.calories, pB.nutrition.calories) : null,
      context: 'Lower caloric density per portion',
    },
    {
      label: 'Protein (g)',
      valA: formatCompVal(pA.nutrition.protein, 'g'),
      valB: pB ? formatCompVal(pB.nutrition.protein, 'g') : '-',
      winner: pB ? compareHigher(pA.nutrition.protein, pB.nutrition.protein) : null,
      context: 'Better for protein intake',
    },
    {
      label: 'Dietary Fiber (g)',
      valA: formatCompVal(pA.nutrition.dietaryFiber, 'g'),
      valB: pB ? formatCompVal(pB.nutrition.dietaryFiber, 'g') : '-',
      winner: pB ? compareHigher(pA.nutrition.dietaryFiber, pB.nutrition.dietaryFiber) : null,
      context: 'Better for fiber & gut health',
    },
    {
      label: 'Added Sugar (g)',
      valA: formatCompVal(pA.nutrition.addedSugars, 'g'),
      valB: pB ? formatCompVal(pB.nutrition.addedSugars, 'g') : '-',
      winner: pB ? compareLower(pA.nutrition.addedSugars, pB.nutrition.addedSugars) : null,
      context: 'Better for lower added sugar',
    },
    {
      label: 'Sodium (mg)',
      valA: formatCompVal(pA.nutrition.sodium, 'mg'),
      valB: pB ? formatCompVal(pB.nutrition.sodium, 'mg') : '-',
      winner: pB ? compareLower(pA.nutrition.sodium, pB.nutrition.sodium) : null,
      context: 'Better for lower sodium',
    },
    {
      label: 'Saturated Fat (g)',
      valA: formatCompVal(pA.nutrition.saturatedFat, 'g'),
      valB: pB ? formatCompVal(pB.nutrition.saturatedFat, 'g') : '-',
      winner: pB ? compareLower(pA.nutrition.saturatedFat, pB.nutrition.saturatedFat) : null,
      context: 'Lower saturated fat',
    },
    {
      label: 'Total Ingredients',
      valA: `${pA.ingredients.length}`,
      valB: pB ? `${pB.ingredients.length}` : '-',
      winner: pB
        ? pA.ingredients.length < pB.ingredients.length
          ? 'A'
          : pB.ingredients.length < pA.ingredients.length
          ? 'B'
          : 'tie'
        : null,
      context: 'Simpler ingredient deck',
    },
    {
      label: 'Functional Additives',
      valA: `${pA.ingredients.filter((i) => i.category !== 'whole-food').length}`,
      valB: pB ? `${pB.ingredients.filter((i) => i.category !== 'whole-food').length}` : '-',
      winner: pB
        ? pA.ingredients.filter((i) => i.category !== 'whole-food').length <
          pB.ingredients.filter((i) => i.category !== 'whole-food').length
          ? 'A'
          : pB.ingredients.filter((i) => i.category !== 'whole-food').length <
            pA.ingredients.filter((i) => i.category !== 'whole-food').length
          ? 'B'
          : 'tie'
        : null,
      context: 'Fewer additives & stabilizers',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
            Decision Matrix
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Side-by-Side Product Comparison
          </h1>
        </div>

        {pB && (
          <button
            onClick={swapScans}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1A211D] text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Swap Sides
          </button>
        )}
      </div>

      {/* Product Column Headers */}
      <div className="grid grid-cols-2 gap-4">
        {/* Product A */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1A211D] border-2 border-[#159A6A]/40 shadow-sm relative">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#DDF5EA] dark:bg-emerald-950 text-[#159A6A]">
            Product A
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-2 truncate">
            {pA.productName}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5 truncate">
            Serving: {pA.nutrition.servingSize || 'Not detected'}
          </p>
        </div>

        {/* Product B or Slot to Add */}
        {pB ? (
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1A211D] border-2 border-stone-200 dark:border-stone-800 shadow-sm relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                Product B
              </span>
              <button
                onClick={() => setCompareScan(null)}
                className="text-[11px] text-stone-400 hover:text-red-500"
              >
                Remove
              </button>
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-2 truncate">
              {pB.productName}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5 truncate">
              Serving: {pB.nutrition.servingSize || 'Not detected'}
            </p>
          </div>
        ) : (
          <div
            onClick={onScanSecondProduct}
            className="p-5 rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-[#159A6A] bg-stone-50/50 dark:bg-stone-900/40 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
          >
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-400 group-hover:text-[#159A6A] transition-colors mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              Scan Product B
            </span>
            <span className="text-[10px] text-stone-400">Tap to add second food</span>
          </div>
        )}
      </div>

      {/* Comparison Rows */}
      <div className="rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
          {metrics.map((row, idx) => (
            <div
              key={idx}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/50 dark:hover:bg-stone-900/30 transition-colors"
            >
              <div className="w-full sm:w-1/3">
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  {row.label}
                </span>
                <p className="text-[11px] text-stone-400 mt-0.5">{row.context}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1 items-center">
                {/* Product A Metric */}
                <div
                  className={`p-2.5 rounded-xl text-center text-xs font-semibold tabular-nums ${
                    row.winner === 'A'
                      ? 'bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#08734E] dark:text-emerald-300 border border-[#159A6A]/30'
                      : 'bg-stone-50 dark:bg-stone-900/50 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {row.winner === 'A' && <Check className="w-3.5 h-3.5 text-[#159A6A]" />}
                    <span>{row.valA}</span>
                  </div>
                </div>

                {/* Product B Metric */}
                <div
                  className={`p-2.5 rounded-xl text-center text-xs font-semibold tabular-nums ${
                    row.winner === 'B'
                      ? 'bg-[#DDF5EA] dark:bg-emerald-950/60 text-[#08734E] dark:text-emerald-300 border border-[#159A6A]/30'
                      : 'bg-stone-50 dark:bg-stone-900/50 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {row.winner === 'B' && <Check className="w-3.5 h-3.5 text-[#159A6A]" />}
                    <span>{row.valB}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
