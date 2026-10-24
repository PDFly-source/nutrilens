'use client';

/**
 * Cooked-food report layout (v2) — separate from the packaged-food report.
 * Shows what was observed vs inferred vs estimated, with uncertainty made
 * explicit and no "good/bad" verdicts.
 */

import React from 'react';
import {
  Flame,
  Scale,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Camera,
} from 'lucide-react';
import { ProductAnalysis } from '@/types/food';


interface CookedFoodReportProps {
  analysis: ProductAnalysis;
  onScanAnother: () => void;
  onCompare: () => void;
  onExport: () => void;
  onShare: () => void;
}

function RangeRow({
  label,
  min,
  max,
  unit,
}: {
  label: string;
  min: number;
  max: number;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-stone-800 last:border-0">
      <span className="text-sm text-stone-600 dark:text-stone-400">{label}</span>
      <span className="text-sm font-semibold font-mono">
        {min}–{max} {unit}
      </span>
    </div>
  );
}

export function CookedFoodReport({
  analysis,
  onScanAnother,
  onCompare,
  onExport,
  onShare,
}: CookedFoodReportProps) {
  const r = analysis.cookedReport;
  if (!r) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-br from-[#DDF5EA] to-[#FFFFFF] dark:from-emerald-950/40 dark:to-[#1A211D] border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-[#159A6A] uppercase tracking-wider">
              Cooked food · estimate
            </p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">{r.dishName}</h1>
            <p className="text-xs text-stone-500 mt-1">
              Classification:{' '}
              {r.classificationProvenance === 'user_provided'
                ? 'confirmed by you'
                : r.classificationProvenance === 'vision_estimate'
                  ? `suggested by the on-device recognition model (${Math.round(r.classificationConfidence * 100)}% confidence)`
                  : 'unknown'}
            </p>
          </div>
          {analysis.imagePreviewUrl && (
            <img
              src={analysis.imagePreviewUrl}
              alt="Scanned dish"
              className="w-20 h-20 rounded-2xl object-cover border border-stone-200 dark:border-stone-800"
            />
          )}
        </div>
        {r.alternatives.length > 0 && (
          <p className="text-xs text-stone-500 mt-2">
            Other possibilities: {r.alternatives.join(', ')}
          </p>
        )}
      </div>

      {/* Portion + estimate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Scale className="w-4 h-4 text-[#159A6A]" /> Estimated portion
          </div>
          <p className="text-2xl font-bold">
            {r.portion.grams} <span className="text-base font-medium">g</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">
            Method: {r.portion.method.replace('_', ' ')} — {r.portion.uncertainty}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Flame className="w-4 h-4 text-orange-500" /> Estimated calories
          </div>
          <p className="text-2xl font-bold">
            {r.calories.min}–{r.calories.max} <span className="text-base font-medium">kcal</span>
          </p>
          <p className="text-xs text-stone-500 mt-1">Plausible range for this portion.</p>
        </div>
      </div>

      {/* Macros */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] p-5">
        <h2 className="text-sm font-semibold mb-2">Estimated macros (ranges)</h2>
        <RangeRow label="Protein" min={r.protein.min} max={r.protein.max} unit="g" />
        <RangeRow label="Carbohydrates" min={r.carbs.min} max={r.carbs.max} unit="g" />
        <RangeRow label="Total fat" min={r.fat.min} max={r.fat.max} unit="g" />
        {r.fiber && <RangeRow label="Fibre" min={r.fiber.min} max={r.fiber.max} unit="g" />}
        {r.sodium && <RangeRow label="Sodium" min={r.sodium.min} max={r.sodium.max} unit="mg" />}
        <p className="text-[11px] text-stone-500 mt-3">
          Source: {r.nutritionSource}. Health impact depends on portion, preparation, your overall
          diet and individual circumstances — no single dish is simply “good” or “bad”.
        </p>
      </div>

      {/* Observed vs inferred */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Eye className="w-4 h-4 text-[#159A6A]" /> Visually identified
          </div>
          {r.visibleIngredients.length > 0 ? (
            <ul className="text-sm text-stone-600 dark:text-stone-400 list-disc list-inside space-y-1">
              {r.visibleIngredients.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500">Nothing confirmed as visible.</p>
          )}
          {r.ingredientEvidence && r.ingredientEvidence.filter((i) => i.evidence === 'unknown').length > 0 && (
            <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                Needs your confirmation
              </p>
              <ul className="text-xs text-stone-500 space-y-0.5">
                {r.ingredientEvidence
                  .filter((i) => i.evidence === 'unknown')
                  .map((i) => (
                    <li key={i.name}>{i.name}</li>
                  ))}
              </ul>
            </div>
          )}
          {r.cookingMethod && (
            <p className="text-xs text-stone-500 mt-2">
              Cooking method assumed: {r.cookingMethod}.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FFFFFF] dark:bg-[#1A211D] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <EyeOff className="w-4 h-4 text-stone-400" /> Inferred / typical (not observed)
          </div>
          {r.inferredIngredients.length > 0 ? (
            <ul className="text-sm text-stone-500 list-disc list-inside space-y-1">
              {r.inferredIngredients.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-500">—</p>
          )}
        </div>
      </div>

      {r.evidenceDisclaimer && (
        <p className="text-[11px] text-stone-400 dark:text-stone-500">{r.evidenceDisclaimer}</p>
      )}

      {/* Assumptions & unknowns */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 p-5 space-y-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold mb-1.5">
            <Sparkles className="w-4 h-4 text-[#159A6A]" /> Assumptions used
          </div>
          <ul className="text-xs text-stone-600 dark:text-stone-400 list-disc list-inside space-y-1">
            {r.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold mb-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> What this estimate cannot know
          </div>
          <ul className="text-xs text-stone-600 dark:text-stone-400 list-disc list-inside space-y-1">
            {r.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-stone-500 pt-1">
          <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          These are database-derived approximations with AI estimation for the portion — not
          laboratory measurements. Non-diagnostic: this report does not assess your health.
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={onScanAnother}
          className="px-4 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#12855A] text-white text-sm font-semibold flex items-center gap-2"
        >
          <Camera className="w-4 h-4" /> Scan another
        </button>
        <button
          onClick={onCompare}
          className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          Compare
        </button>
        <button
          onClick={onExport}
          className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          Export
        </button>
        <button
          onClick={onShare}
          className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          Share
        </button>
      </div>
    </div>
  );
}
