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
  // Assume desktop on server
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

  // If not on mobile/tablet viewport (< 1024px), render nothing
  if (!isMobile) {
    return null;
  }

  // If user explicitly dismissed the warning on mobile, show a small top notice
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
    <div className="fixed inset-0 z-[999999] bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6 sm:p-10 overflow-y-auto select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Device Restriction Notice
          </span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
          Code Clash 2026
        </span>
      </div>

      {/* Main Content Card */}
      <div className="my-auto py-8 max-w-md mx-auto text-center space-x-0 space-y-6">
        {/* Visual Workstation Graphic */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 blur-sm" />
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-2xl">
            <svg
              className="w-10 h-10 text-indigo-400"
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
          {/* Mobile phone indicator with prohibition cross */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-950 border border-red-500 flex items-center justify-center shadow-lg">
            <svg
              className="w-4 h-4 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Please Open on a Laptop or PC
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            The Code Clash Leaderboard and competition management system is strictly designed for desktop and laptop displays.
          </p>
        </div>

        {/* Feature reason list */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left text-xs text-zinc-300 space-y-2.5 font-mono">
          <div className="flex items-start space-x-2">
            <span className="text-indigo-400 mt-0.5">•</span>
            <span>Multi-column leaderboard matrices and tie-breaker statistics require a minimum display width of 1024px.</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-indigo-400 mt-0.5">•</span>
            <span>Real-time admin controls and live uploads cannot be safely operated on mobile touch interfaces.</span>
          </div>
          <div className="pt-2 border-t border-zinc-800 flex justify-between text-[11px] text-zinc-500">
            <span>Detected Screen Width:</span>
            <span className="text-zinc-300 font-semibold">{viewportWidth}px (Target: &ge; 1024px)</span>
          </div>
        </div>

        {/* Action button */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20"
          >
            Refresh Device Check
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors border border-transparent hover:border-zinc-800"
          >
            I understand the limitations, continue anyway &rarr;
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] font-mono text-zinc-600 border-t border-zinc-900 pt-4">
        Code Clash Competition Platform &bull; Laptop &amp; PC Workstation Mode
      </div>
    </div>
  );
}
