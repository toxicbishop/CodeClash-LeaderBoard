'use client';

import { useState, useSyncExternalStore } from 'react';

function subscribeResize(callback: () => void) {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
}

function getViewportWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 1200;
}

function getServerViewportWidth(): number {
  return 1200;
}

function getInitialDismissedState(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('dismiss_mobile_device_blocker') === 'true';
}

export default function MobileDeviceBlocker() {
  const [isDismissed, setIsDismissed] = useState<boolean>(getInitialDismissedState);
  const viewportWidth = useSyncExternalStore(
    subscribeResize,
    getViewportWidth,
    getServerViewportWidth,
  );

  const isMobile = viewportWidth < 1024;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dismiss_mobile_device_blocker', 'true');
    }
  };

  const handleRestoreWarning = () => {
    setIsDismissed(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('dismiss_mobile_device_blocker');
    }
  };

  if (!isMobile) {
    return null;
  }

  if (isDismissed) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-2 text-xs font-mono flex items-center justify-between z-50">
        <span>⚠️ Optimized for Laptop/PC displays. Horizontal scrolling may be required on this screen.</span>
        <button
          onClick={handleRestoreWarning}
          className="text-amber-600 dark:text-amber-400 underline ml-2 hover:text-amber-700"
        >
          Re-open warning
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[999999] bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6 sm:p-8 overflow-y-auto select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            Display Notice
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
          Code Clash 2026
        </span>
      </div>

      {/* Main Content Card */}
      <div className="my-auto py-6 max-w-sm mx-auto text-center space-y-5">
        {/* Simple Clean Workstation Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shadow-sm">
          <svg
            className="w-8 h-8 text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Please Open on a Laptop or PC
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The competition leaderboard and administration platform is designed for larger desktop displays to view full data tables and live rankings.
          </p>
        </div>

        {/* Simple Specs Container */}
        <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs font-mono text-zinc-400 space-y-2">
          <div className="flex justify-between items-center">
            <span>Recommended Screen:</span>
            <span className="text-zinc-200">&ge; 1024px width</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-zinc-800/60">
            <span>Current Device Width:</span>
            <span className="text-amber-400 font-semibold">{viewportWidth}px</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all"
          >
            Refresh Device Check
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2 px-4 rounded-xl font-medium text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Continue to website anyway &rarr;
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] font-mono text-zinc-600 border-t border-zinc-900 pt-3 pb-2">
        Code Clash Competition Platform &bull; Desktop Mode Required
      </div>
    </div>
  );
}
