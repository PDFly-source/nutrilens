'use client';

import React from 'react';
import { useSession } from '@/features/session/SessionContext';
import { ScanMode } from '@/types/food';
import {
  Camera,
  Barcode,
  FileText,
  ListFilter,
  Package,
  Scale,
  BookOpen,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface HomeViewProps {
  onStartScan: (mode?: ScanMode) => void;
  onNavigateTab: (tab: 'home' | 'scan' | 'compare' | 'learn' | 'settings') => void;
  onViewReport: () => void;
}

export function HomeView({ onStartScan, onNavigateTab, onViewReport }: HomeViewProps) {
  const { currentScan } = useSession();

  const quickModes: { id: ScanMode; label: string; icon: React.ElementType; note: string }[] = [
    { id: 'nutrition', label: 'Nutrition Facts', icon: FileText, note: 'Calories, Macros, Daily Values' },
    { id: 'ingredients', label: 'Ingredients', icon: ListFilter, note: 'Additives, Sweeteners, Dyes' },
    { id: 'barcode', label: 'Barcode', icon: Barcode, note: 'UPC/EAN Optical Reader' },
    { id: 'product', label: 'Packaging', icon: Package, note: 'Marketing Claims vs Data' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8 animate-in fade-in duration-200">
      {/* Brand Header & Privacy Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              NutriLens
            </h1>
            <span className="text-stone-400 dark:text-stone-600">·</span>
            <span className="text-xs font-bold tracking-wider uppercase text-[#159A6A] dark:text-[#B9D94C]">
              SCAN. KNOW. CHOOSE.
            </span>
          </div>
        </div>

        {/* Privacy Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDF5EA] dark:bg-emerald-950/80 border border-[#159A6A]/30 text-[#08734E] dark:text-[#B9D94C] text-[11px] font-bold w-fit">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>PRIVATE BY DESIGN</span>
        </div>
      </div>

      {/* Hero Section: High-Contrast Crisp Surface */}
      <div className="relative p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#1A231E] border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="max-w-xl space-y-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-950 dark:text-white leading-tight">
            Know what&apos;s really inside your food.
          </h2>
          <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed font-normal">
            NutriLens instantly transforms confusing food packaging, hidden sugars, industrial additives, and marketing claims into clear, evidence-based intelligence.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onStartScan('nutrition')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#159A6A] hover:bg-[#08734E] active:bg-[#08734E] text-white text-sm font-bold shadow-md shadow-emerald-900/15 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none"
            >
              <Camera className="w-4 h-4" />
              Scan Food Now
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('compare')}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-[0.98] transition-colors cursor-pointer touch-manipulation select-none"
            >
              <Scale className="w-3.5 h-3.5" />
              Compare Foods
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('learn')}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-stone-100 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-stone-700 active:scale-[0.98] transition-colors cursor-pointer touch-manipulation select-none"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Learn
            </button>
          </div>
        </div>
      </div>

      {/* Educational Microcopy Callout */}
      <div className="px-5 py-3.5 rounded-2xl bg-white dark:bg-[#1A231E] border border-stone-200 dark:border-stone-800 text-center shadow-xs">
        <p className="text-xs font-medium text-stone-700 dark:text-stone-300">
          No account. No cloud storage. Your scan stays strictly in this session.
        </p>
      </div>

      {/* Active Session Scan Card or Clean Empty State */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
            Current Session Scan
          </span>
          {currentScan && (
            <span className="text-[11px] font-semibold text-[#159A6A] dark:text-[#B9D94C]">
              Active in RAM Memory
            </span>
          )}
        </div>

        {currentScan ? (
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1A231E] border-2 border-[#159A6A]/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#08734E] dark:text-[#B9D94C] bg-[#DDF5EA] dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                Active Product
              </span>
              <h3 className="text-lg font-bold text-stone-950 dark:text-white">
                {currentScan.productName}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                Score: {currentScan.scores.isScoreAvailable ? `${currentScan.scores.overall}/100` : 'Pending'} · {currentScan.processingLevel.label}
                {currentScan.nutrition.calories !== null ? ` · ${currentScan.nutrition.calories} kcal` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onViewReport}
                className="px-5 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] active:bg-[#08734E] text-white text-xs font-bold transition-colors cursor-pointer touch-manipulation select-none"
              >
                View Full Report
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('compare')}
                className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer touch-manipulation select-none"
              >
                Compare
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-white dark:bg-[#1A231E] border border-stone-200 dark:border-stone-800 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-300 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 text-[#159A6A]" />
            </div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white">
              No scans in this session yet
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 max-w-sm mx-auto leading-relaxed">
              Scan a packaged food label or ingredient statement to unlock instant nutritional breakdown and additive intelligence.
            </p>
            <button
              type="button"
              onClick={() => onStartScan('nutrition')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:bg-stone-800 active:scale-[0.98] transition-all cursor-pointer touch-manipulation select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              Scan Your First Food
            </button>
          </div>
        )}
      </div>

      {/* Quick Scan Modes Grid */}
      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">
          Quick Capture Options
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickModes.map((qm) => {
            const Icon = qm.icon;
            return (
              <button
                key={qm.id}
                type="button"
                onClick={() => onStartScan(qm.id)}
                className="p-4 rounded-3xl bg-white dark:bg-[#1A231E] border border-stone-200 dark:border-stone-800 shadow-xs hover:border-[#159A6A] hover:shadow-sm text-left transition-all flex flex-col justify-between h-32 group cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-2xl bg-[#DDF5EA] dark:bg-emerald-950/80 text-[#159A6A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-950 dark:text-white">
                    {qm.label}
                  </h4>
                  <p className="text-[10px] text-stone-600 dark:text-stone-400 truncate mt-0.5 font-medium">
                    {qm.note}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
