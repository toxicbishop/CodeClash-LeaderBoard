export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Code Clash 2026
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Code Clash Leaderboard
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          One leaderboard. Every lab. Your top 10.
        </p>
        <p className="mt-8 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          The leaderboard is being prepared. Contest results will appear here
          once the event is connected.
        </p>
      </div>
    </main>
  );
}
