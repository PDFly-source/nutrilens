'use client';

import { APP_VERSION, COMMIT_SHA, buildLabel } from '@/lib/build-info';

import React, { useState, useEffect } from 'react';
import { useSession } from '@/features/session/SessionContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { PrivacyCenterModal } from '@/features/privacy/PrivacyCenterModal';
import {
  Sun,
  Moon,
  Laptop,
  ShieldCheck,
  Trash2,
  Download,
  Check,
  Plus,
  X,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';

interface SettingsViewProps {
  onClearSession: () => void;
}

export function SettingsView({ onClearSession }: SettingsViewProps) {
  const { preferences, updatePreferences } = useSession();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [customAvoidInput, setCustomAvoidInput] = useState('');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [energyUnit, setEnergyUnit] = useState<'kcal' | 'kJ'>('kcal');

  // Handle theme changes on HTML root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  const handleAddCustomAvoid = () => {
    if (customAvoidInput.trim() && !preferences.customAvoid.includes(customAvoidInput.trim())) {
      updatePreferences({
        customAvoid: [...preferences.customAvoid, customAvoidInput.trim()],
      });
      setCustomAvoidInput('');
    }
  };

  const handleRemoveCustomAvoid = (item: string) => {
    updatePreferences({
      customAvoid: preferences.customAvoid.filter((i) => i !== item),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8 animate-in fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#159A6A] dark:text-[#B9D94C]">
            App Preferences
          </span>
          <span className="text-stone-300 dark:text-stone-700">·</span>
          <span className="text-xs text-stone-500">Session Controls</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Settings & Preferences
        </h1>
        <p className="text-xs text-stone-600 dark:text-stone-400 max-w-lg mt-1">
          Configure temporary session dietary filters, display themes, and privacy controls.
        </p>
      </div>

      {/* PWA Install Banner if available */}
      {(!isInstalled && (isInstallable || isIOS)) && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-[#DDF5EA] to-[#f0f9f4] dark:from-emerald-950/40 dark:to-stone-900 border border-[#159A6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-[#159A6A]" />
              Install NutriLens PWA
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              Install to your home screen for instant camera access and offline tools.
            </p>
          </div>
          {isInstallable && (
            <button
              onClick={install}
              className="px-5 py-2.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
            >
              Install App
            </button>
          )}
          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-4 py-2 rounded-xl border border-[#159A6A] text-[#159A6A] text-xs font-semibold shrink-0 hover:bg-[#159A6A]/10 transition-colors"
            >
              How to Install on iOS
            </button>
          )}
        </div>
      )}

      {/* Dietary Goals & Preferences (In-Memory Session Only) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            Session Filter Rules
          </span>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            Dietary & Nutritional Preferences
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Active during this session only. Scans will highlight conflicts against these targets.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
          {[
            { key: 'dairyFree', label: 'Dairy Avoidance' },
            { key: 'glutenFree', label: 'Gluten Avoidance' },
            { key: 'nutFree', label: 'Nut Avoidance' },
            { key: 'vegan', label: 'Vegan' },
            { key: 'vegetarian', label: 'Vegetarian' },
            { key: 'lowSugar', label: 'Low Sugar (≤5g added)' },
            { key: 'lowerSodium', label: 'Lower Sodium (≤140mg)' },
            { key: 'higherProtein', label: 'Higher Protein (≥8g)' },
            { key: 'higherFiber', label: 'Higher Fiber (≥3g)' },
            { key: 'noArtificialColors', label: 'No Synthetic Dyes' },
          ].map(({ key, label }) => {
            const active = (preferences as any)[key];
            return (
              <button
                key={key}
                onClick={() => updatePreferences({ [key]: !active })}
                className={`p-3 rounded-2xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                  active
                    ? 'bg-[#DDF5EA] dark:bg-emerald-950/60 border-[#159A6A] text-[#159A6A] font-semibold'
                    : 'bg-stone-50 dark:bg-stone-900/50 border-stone-200/80 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400'
                }`}
              >
                <span>{label}</span>
                {active && <Check className="w-3.5 h-3.5 text-[#159A6A]" />}
              </button>
            );
          })}
        </div>

        {/* Custom Avoid Keyword Chips */}
        <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
          <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
            Custom Ingredients to Avoid (e.g. &quot;palm oil&quot;, &quot;sucralose&quot;)
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {preferences.customAvoid.map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-800 dark:text-stone-200"
              >
                {term}
                <button
                  onClick={() => handleRemoveCustomAvoid(term)}
                  className="text-stone-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customAvoidInput}
              onChange={(e) => setCustomAvoidInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomAvoid())}
              placeholder="Add keyword..."
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs focus:outline-none focus:ring-1 focus:ring-[#159A6A]"
            />
            <button
              onClick={handleAddCustomAvoid}
              className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Appearance & Theme */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div>
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            Appearance & Units
          </h3>
          <p className="text-xs text-stone-500">Display styling and measurement units.</p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
              theme === 'light'
                ? 'border-[#159A6A] bg-[#DDF5EA]/30 text-[#159A6A] font-semibold'
                : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
              theme === 'dark'
                ? 'border-[#159A6A] bg-[#DDF5EA]/30 text-[#159A6A] font-semibold'
                : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span>Dark</span>
          </button>
          <button
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-2xl border flex flex-col items-center gap-2 text-xs font-medium transition-all ${
              theme === 'system'
                ? 'border-[#159A6A] bg-[#DDF5EA]/30 text-[#159A6A] font-semibold'
                : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            <Laptop className="w-5 h-5" />
            <span>System</span>
          </button>
        </div>

        {/* Energy Unit Stepper */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800 text-xs">
          <span className="font-medium text-stone-800 dark:text-stone-200">Energy Unit</span>
          <div className="flex p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
            <button
              onClick={() => setEnergyUnit('kcal')}
              className={`px-3 py-1 rounded-lg font-semibold ${
                energyUnit === 'kcal' ? 'bg-white dark:bg-stone-900 shadow-xs' : 'text-stone-500'
              }`}
            >
              Calories (kcal)
            </button>
            <button
              onClick={() => setEnergyUnit('kJ')}
              className={`px-3 py-1 rounded-lg font-semibold ${
                energyUnit === 'kJ' ? 'bg-white dark:bg-stone-900 shadow-xs' : 'text-stone-500'
              }`}
            >
              Kilojoules (kJ)
            </button>
          </div>
        </div>
      </div>

      {/* Privacy & Session Actions */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1A211D] border border-stone-200/80 dark:border-stone-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#159A6A]" />
              Privacy & Local Session
            </h3>
            <p className="text-xs text-stone-500">
              NutriLens operates strictly without telemetry, databases, or cloud persistence.
            </p>
          </div>
          <button
            onClick={() => setPrivacyModalOpen(true)}
            className="text-xs font-semibold text-[#159A6A] dark:text-[#B9D94C] hover:underline"
          >
            Read Privacy Center
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
              Clear Current Session
            </span>
            <span className="text-[11px] text-stone-500">
              Clears active scan, comparison buffer, and temporary preference filters from memory.
            </span>
          </div>
          <button
            onClick={onClearSession}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Memory
          </button>
        </div>
      </div>

      {/* About Section */}
      <div className="p-6 rounded-3xl bg-stone-50 dark:bg-[#1A211D] border border-stone-200/60 dark:border-stone-800 text-xs text-stone-500 space-y-1.5">
        <div className="font-semibold text-stone-700 dark:text-stone-300">
          NutriLens · SCAN. KNOW. CHOOSE. (Version {APP_VERSION} PWA)
        </div>
        <div className="text-[11px] text-stone-400 dark:text-stone-500">
          Running build: {buildLabel()}
          {COMMIT_SHA === 'dev' && ' — local development build (no git commit)'}
        </div>
        <p>
          Informational food-label intelligence tool. Does not diagnose diseases or provide medical diagnosis.
        </p>
      </div>

      {/* Privacy Modal */}
      {privacyModalOpen && (
        <PrivacyCenterModal
          onClose={() => setPrivacyModalOpen(false)}
          onClearSession={onClearSession}
        />
      )}

      {/* iOS Install Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1A211D] p-6 shadow-2xl border border-stone-200 dark:border-stone-800">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 mb-2">
              Install NutriLens on iPhone / iPad
            </h3>
            <ol className="text-xs text-stone-600 dark:text-stone-300 space-y-2 list-decimal list-inside leading-relaxed mb-4">
              <li>Tap the <strong>Share</strong> button in the Safari bottom toolbar.</li>
              <li>Scroll down the share sheet and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner to launch fullscreen anytime.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
