'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { ProductAnalysis, SessionPreferences, PreferenceCheckResult } from '@/types/food';

interface SessionContextType {
  currentScan: ProductAnalysis | null;
  compareScan: ProductAnalysis | null;
  preferences: SessionPreferences;
  setCurrentScan: (scan: ProductAnalysis | null) => void;
  setCompareScan: (scan: ProductAnalysis | null) => void;
  updatePreferences: (newPrefs: Partial<SessionPreferences>) => void;
  clearEntireSession: () => void;
  swapScans: () => void;
  preferenceResults: PreferenceCheckResult[];
}

const defaultPreferences: SessionPreferences = {
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false,
  nutFree: false,
  lowSugar: false,
  lowerSodium: false,
  higherProtein: false,
  higherFiber: false,
  noArtificialColors: false,
  customAvoid: [],
};

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Pure in-memory React state (no localStorage or IndexedDB persistence)
  const [currentScan, setCurrentScan] = useState<ProductAnalysis | null>(null);
  const [compareScan, setCompareScan] = useState<ProductAnalysis | null>(null);
  const [preferences, setPreferences] = useState<SessionPreferences>(defaultPreferences);

  const updatePreferences = (newPrefs: Partial<SessionPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...newPrefs }));
  };

  const clearEntireSession = () => {
    setCurrentScan(null);
    setCompareScan(null);
    setPreferences(defaultPreferences);
  };

  const swapScans = () => {
    const temp = currentScan;
    setCurrentScan(compareScan);
    setCompareScan(temp);
  };

  // Evaluate active preferences against current scanned product
  const preferenceResults = useMemo<PreferenceCheckResult[]>(() => {
    if (!currentScan) return [];
    const results: PreferenceCheckResult[] = [];

    const ingrNames = currentScan.ingredients.map((i) => i.name.toLowerCase());
    const allergens = currentScan.allergens.map((a) => a.toLowerCase());

    if (preferences.dairyFree) {
      const conflicts = currentScan.ingredients
        .filter((i) => i.allergenDetected === 'Milk' || i.name.toLowerCase().includes('milk') || i.name.toLowerCase().includes('whey') || i.name.toLowerCase().includes('casein'))
        .map((i) => i.name);
      results.push({
        preference: 'Dairy Avoidance',
        matched: conflicts.length === 0,
        conflicts,
      });
    }

    if (preferences.glutenFree) {
      const conflicts = currentScan.ingredients
        .filter((i) => i.allergenDetected === 'Wheat' || i.allergenDetected === 'Gluten' || i.name.toLowerCase().includes('flour') || i.name.toLowerCase().includes('barley') || i.name.toLowerCase().includes('rye'))
        .map((i) => i.name);
      results.push({
        preference: 'Gluten Avoidance',
        matched: conflicts.length === 0,
        conflicts,
      });
    }

    if (preferences.nutFree) {
      const conflicts = currentScan.ingredients
        .filter((i) => i.allergenDetected === 'Peanuts' || i.allergenDetected === 'Tree Nuts' || i.name.toLowerCase().includes('peanut') || i.name.toLowerCase().includes('almond') || i.name.toLowerCase().includes('cashew'))
        .map((i) => i.name);
      results.push({
        preference: 'Nut Avoidance',
        matched: conflicts.length === 0,
        conflicts,
      });
    }

    if (preferences.vegan) {
      const conflicts = currentScan.ingredients
        .filter((i) => i.allergenDetected === 'Milk' || i.allergenDetected === 'Egg' || i.allergenDetected === 'Fish' || i.allergenDetected === 'Shellfish' || i.name.toLowerCase().includes('gelatin') || i.name.toLowerCase().includes('honey'))
        .map((i) => i.name);
      results.push({
        preference: 'Vegan',
        matched: conflicts.length === 0,
        conflicts,
      });
    }

    if (preferences.lowSugar) {
      const hasData = currentScan.nutrition.addedSugars !== null;
      const matched = hasData && currentScan.nutrition.addedSugars! <= 5;
      results.push({
        preference: 'Low Sugar Target (≤5g added)',
        matched,
        conflicts: !hasData ? ['Added sugar data not detected'] : matched ? [] : [`Contains ${currentScan.nutrition.addedSugars}g added sugars`],
      });
    }

    if (preferences.lowerSodium) {
      const hasData = currentScan.nutrition.sodium !== null;
      const matched = hasData && currentScan.nutrition.sodium! <= 140;
      results.push({
        preference: 'Lower Sodium Target (≤140mg)',
        matched,
        conflicts: !hasData ? ['Sodium data not detected'] : matched ? [] : [`Contains ${currentScan.nutrition.sodium}mg sodium per serving`],
      });
    }

    if (preferences.higherProtein) {
      const hasData = currentScan.nutrition.protein !== null;
      const matched = hasData && currentScan.nutrition.protein! >= 8;
      results.push({
        preference: 'Higher Protein Target (≥8g)',
        matched,
        conflicts: !hasData ? ['Protein data not detected'] : matched ? [] : [`Contains ${currentScan.nutrition.protein}g protein`],
      });
    }

    if (preferences.noArtificialColors) {
      const conflicts = currentScan.ingredients
        .filter((i) => i.category === 'color' && i.isUltraProcessedIndicator)
        .map((i) => i.name);
      results.push({
        preference: 'No Artificial Dyes',
        matched: conflicts.length === 0,
        conflicts,
      });
    }

    // Custom avoid list
    if (preferences.customAvoid.length > 0) {
      for (const customTerm of preferences.customAvoid) {
        const term = customTerm.toLowerCase().trim();
        if (!term) continue;
        const matches = currentScan.ingredients.filter((i) => i.name.toLowerCase().includes(term)).map((i) => i.name);
        results.push({
          preference: `Avoid: "${customTerm}"`,
          matched: matches.length === 0,
          conflicts: matches,
        });
      }
    }

    return results;
  }, [currentScan, preferences]);

  return (
    <SessionContext.Provider
      value={{
        currentScan,
        compareScan,
        preferences,
        setCurrentScan,
        setCompareScan,
        updatePreferences,
        clearEntireSession,
        swapScans,
        preferenceResults,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
