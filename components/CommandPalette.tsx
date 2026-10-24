'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Camera,
  Barcode,
  FileText,
  ListFilter,
  Scale,
  BookOpen,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  Command,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionKey: string) => void;
}

export function CommandPalette({ isOpen, onClose, onSelectAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { key: 'scan-nutrition', label: 'Scan Nutrition Label', icon: FileText, category: 'Scanner' },
    { key: 'scan-ingredients', label: 'Scan Ingredients Statement', icon: ListFilter, category: 'Scanner' },
    { key: 'scan-barcode', label: 'Scan Retail Barcode', icon: Barcode, category: 'Scanner' },
    { key: 'scan-product', label: 'Scan Full Product Packaging', icon: Camera, category: 'Scanner' },
    { key: 'nav-compare', label: 'Compare Two Food Products', icon: Scale, category: 'Decision' },
    { key: 'nav-learn', label: 'Learn: How to Read Labels', icon: BookOpen, category: 'Education' },
    { key: 'nav-learn-sugar', label: 'Learn: The Truth About Added Sugars', icon: BookOpen, category: 'Education' },
    { key: 'nav-learn-sodium', label: 'Learn: Sodium Limits in Packaged Food', icon: BookOpen, category: 'Education' },
    { key: 'open-privacy', label: 'Open Privacy Architecture Center', icon: ShieldCheck, category: 'Security' },
    { key: 'nav-settings', label: 'App Settings & Dietary Preferences', icon: Settings, category: 'Settings' },
    { key: 'clear-session', label: 'Clear Current Session Memory', icon: Trash2, category: 'Privacy' },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1A211D] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-stone-100 dark:border-stone-800">
          <Search className="w-4 h-4 text-stone-400 mr-2.5" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search action..."
            className="flex-1 bg-transparent text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Options List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-stone-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    onSelectAction(item.key);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800/70 text-left text-xs transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-stone-800 group-hover:bg-[#DDF5EA] dark:group-hover:bg-emerald-950 text-stone-600 dark:text-stone-400 group-hover:text-[#159A6A] flex items-center justify-center transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-400 uppercase tracking-wider">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-100 dark:border-stone-800 text-[11px] text-stone-400 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K
          </span>
        </div>
      </div>
    </div>
  );
}
