'use client';

import React from 'react';
import {
  ShieldCheck,
  Lock,
  EyeOff,
  ServerOff,
  Trash2,
  X,
  CheckCircle,
} from 'lucide-react';

interface PrivacyCenterModalProps {
  onClose: () => void;
  onClearSession: () => void;
}

export function PrivacyCenterModal({ onClose, onClearSession }: PrivacyCenterModalProps) {
  const pillars = [
    {
      icon: ServerOff,
      title: 'Zero Remote Cloud Storage',
      desc: 'No remote database, no Firebase, no MongoDB, and no server stores your food pictures or scan queries.',
    },
    {
      icon: EyeOff,
      title: 'No User Accounts or Tracking',
      desc: 'No signup, no passwords, no email collection, no analytics SDKs, and no tracking cookies.',
    },
    {
      icon: Lock,
      title: 'In-Memory Ephemeral Sessions',
      desc: 'All nutrition extraction and scores exist strictly in volatile RAM memory during this browser tab session. Refreshing the tab automatically clears everything.',
    },
    {
      icon: ShieldCheck,
      title: 'Client-Side WebAssembly OCR',
      desc: 'Text recognition executes directly inside your browser engine using client-side WebAssembly without transmitting images across the internet.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl p-6 bg-white dark:bg-[#1A211D] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DDF5EA] dark:bg-emerald-950/70 text-[#159A6A] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Privacy Architecture Center
              </h2>
              <p className="text-xs text-stone-500">Private by Design</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800 flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-white dark:bg-stone-800 text-[#159A6A] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {p.title}
                  </h3>
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl bg-stone-100/70 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
              Clear Current Session Memory
            </h4>
            <p className="text-[11px] text-stone-500">
              Immediately wipes any active scans and temporary comparison data.
            </p>
          </div>
          <button
            onClick={() => {
              onClearSession();
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shrink-0 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Session Now
          </button>
        </div>
      </div>
    </div>
  );
}
