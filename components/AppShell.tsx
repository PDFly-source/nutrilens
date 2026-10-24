'use client';

import React, { useEffect, useState } from 'react';
import { warmUpOcrEngine } from '@/features/ocr/ocr-service';
import { useSession } from '@/features/session/SessionContext';
import { HomeView } from '@/features/home/HomeView';
import { ScanHub } from '@/features/scanner/ScanHub';
import { ReportDashboard } from '@/features/analysis/ReportDashboard';
import { CompareHub } from '@/features/comparison/CompareHub';
import { LearnHub } from '@/features/learn/LearnHub';
import { SettingsView } from '@/features/settings/SettingsView';
import { CameraModal } from '@/features/scanner/CameraModal';
import { CommandPalette } from '@/components/CommandPalette';
import { downloadLocalReport, shareLocalReport } from '@/features/export/export-service';
import { ScanMode, ProductAnalysis } from '@/types/food';
import {
  Home,
  Camera,
  Scale,
  BookOpen,
  Settings,
  Search,
  Command,
  ShieldCheck,
} from 'lucide-react';

export type ActiveTab = 'home' | 'scan' | 'report' | 'compare' | 'learn' | 'settings';

export function AppShell() {
  // Preload the local OCR engine in the background so the first scan
  // doesn't pay the one-time wasm/language-data download cost.
  useEffect(() => {
    warmUpOcrEngine();
  }, []);
  const { currentScan, setCurrentScan, setCompareScan, clearEntireSession } = useSession();

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [activeCameraMode, setActiveCameraMode] = useState<ScanMode | null>(null);
  const [isScanningForCompare, setIsScanningForCompare] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Handle new scan result
  const handleScanComplete = (analysis: ProductAnalysis) => {
    if (isScanningForCompare) {
      setCompareScan(analysis);
      setIsScanningForCompare(false);
      setActiveTab('compare');
    } else {
      setCurrentScan(analysis);
      setActiveTab('report');
    }
  };

  // Trigger scanning for Product B in comparison
  const handleScanSecondProduct = () => {
    setIsScanningForCompare(true);
    setActiveCameraMode('nutrition');
  };

  const handleCommandAction = (key: string) => {
    switch (key) {
      case 'scan-nutrition':
        setActiveCameraMode('nutrition');
        break;
      case 'scan-ingredients':
        setActiveCameraMode('ingredients');
        break;
      case 'scan-barcode':
        setActiveCameraMode('barcode');
        break;
      case 'scan-product':
        setActiveCameraMode('product');
        break;
      case 'nav-compare':
        setActiveTab('compare');
        break;
      case 'nav-learn':
      case 'nav-learn-sugar':
      case 'nav-learn-sodium':
        setActiveTab('learn');
        break;
      case 'nav-settings':
        setActiveTab('settings');
        break;
      case 'clear-session':
        clearEntireSession();
        setActiveTab('home');
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F2] dark:bg-[#121614] text-[#17201B] dark:text-[#EAEFEA] transition-colors">
      {/* Top Bar (Compliant with 3-Zone Top Bar Contract) */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-[#1A211D]/95 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="text-base sm:text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 hover:opacity-80 transition-opacity cursor-pointer touch-manipulation select-none"
        >
          NutriLens
        </button>

        {/* Zone 2: Clean text navigation links for tablet/desktop */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-stone-600 dark:text-stone-400">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer touch-manipulation ${
              activeTab === 'home' ? 'text-[#159A6A] dark:text-[#B9D94C]' : ''
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer touch-manipulation ${
              activeTab === 'scan' ? 'text-[#159A6A] dark:text-[#B9D94C]' : ''
            }`}
          >
            Scan Hub
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer touch-manipulation ${
              activeTab === 'compare' ? 'text-[#159A6A] dark:text-[#B9D94C]' : ''
            }`}
          >
            Compare
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('learn')}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer touch-manipulation ${
              activeTab === 'learn' ? 'text-[#159A6A] dark:text-[#B9D94C]' : ''
            }`}
          >
            Learn
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer touch-manipulation ${
              activeTab === 'settings' ? 'text-[#159A6A] dark:text-[#B9D94C]' : ''
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2">
          {/* Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition-colors cursor-pointer touch-manipulation"
            title="Search commands (Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Commands</span>
            <kbd className="hidden sm:inline text-[10px] bg-stone-200 dark:bg-stone-800 px-1.5 py-0.5 rounded text-stone-500">
              ⌘K
            </kbd>
          </button>

          {/* Direct Scan Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsScanningForCompare(false);
              setActiveCameraMode('nutrition');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#159A6A] hover:bg-[#08734E] active:bg-[#08734E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scan Food</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeTab === 'home' && (
          <HomeView
            onStartScan={(mode) => {
              setIsScanningForCompare(false);
              setActiveCameraMode(mode || 'nutrition');
            }}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onViewReport={() => setActiveTab('report')}
          />
        )}

        {activeTab === 'scan' && (
          <ScanHub
            onScanComplete={handleScanComplete}
            onNavigateCompare={() => setActiveTab('compare')}
          />
        )}

        {activeTab === 'report' && currentScan && (
          <ReportDashboard
            analysis={currentScan}
            onScanAnother={() => {
              setIsScanningForCompare(false);
              setActiveCameraMode('nutrition');
            }}
            onScanBackPanel={() => {
              setIsScanningForCompare(false);
              setActiveCameraMode('nutrition');
            }}
            onCompare={() => setActiveTab('compare')}
            onExport={() => downloadLocalReport(currentScan)}
            onShare={() => shareLocalReport(currentScan)}
          />
        )}

        {activeTab === 'compare' && (
          <CompareHub
            onScanFirstProduct={() => {
              setIsScanningForCompare(false);
              setActiveCameraMode('nutrition');
            }}
            onScanSecondProduct={handleScanSecondProduct}
          />
        )}

        {activeTab === 'learn' && <LearnHub />}

        {activeTab === 'settings' && (
          <SettingsView
            onClearSession={() => {
              clearEntireSession();
              setActiveTab('home');
            }}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (≤15% viewport height compliance) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white dark:bg-[#161D19] border-t border-stone-200 dark:border-stone-800 grid grid-cols-5 items-center px-1 pb-safe shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation select-none active:scale-95 ${
            activeTab === 'home'
              ? 'text-[#159A6A] dark:text-[#B9D94C] font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation select-none active:scale-95 ${
            activeTab === 'scan'
              ? 'text-[#159A6A] dark:text-[#B9D94C] font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">Scan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compare')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation select-none active:scale-95 ${
            activeTab === 'compare'
              ? 'text-[#159A6A] dark:text-[#B9D94C] font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Scale className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">Compare</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('learn')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation select-none active:scale-95 ${
            activeTab === 'learn'
              ? 'text-[#159A6A] dark:text-[#B9D94C] font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">Learn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer touch-manipulation select-none active:scale-95 ${
            activeTab === 'settings'
              ? 'text-[#159A6A] dark:text-[#B9D94C] font-bold'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight font-medium">Settings</span>
        </button>
      </nav>

      {/* Global Camera Modal */}
      {activeCameraMode && (
        <CameraModal
          initialMode={activeCameraMode}
          onClose={() => {
            setActiveCameraMode(null);
            setIsScanningForCompare(false);
          }}
          onAnalysisReady={(analysis) => {
            setActiveCameraMode(null);
            handleScanComplete(analysis);
          }}
        />
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectAction={handleCommandAction}
      />
    </div>
  );
}
