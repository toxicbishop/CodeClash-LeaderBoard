import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Privacy Policy | Code Clash 2026',
  description: 'Privacy policy and data handling practices for Code Clash 2026.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400">
            &larr; Code Clash Portal
          </Link>
          <span className="text-xs text-zinc-400 font-mono">Last updated: November 2026</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 sm:p-12 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-medium text-zinc-900 dark:text-zinc-50">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              How participant data, contest results, and administrative credentials are handled within the Code Clash Leaderboard Platform.
            </p>
          </div>

          <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Information Collected</h2>
              <p>
                The platform processes only the information necessary to conduct and verify the competition:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
                <li>Contestant names, participant identifiers (such as student roll numbers or HackerRank usernames).</li>
                <li>Laboratory assignment and workstation/lab names.</li>
                <li>Performance metrics: scores, problems solved, penalties, and submission timestamps.</li>
                <li>Administrator credentials for role-based access control.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. How Data is Used</h2>
              <p>
                Data is exclusively used for contest scoring, rank generation, cross-lab collision detection,
                and display on verified leaderboards. We do not sell, monetize, or distribute participant
                data to external third parties.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Data Security & Storage</h2>
              <p>
                Uploaded files and database records are safeguarded using industry-standard encryption, strict
                row-level security (RLS) policies, and role-based authorization to prevent unauthorized access
                across laboratories.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. Retention & Archiving</h2>
              <p>
                Contest snapshots and audit records are archived for verification and historical records.
                Requests regarding participant data inquiries can be directed to the event organizing committee.
              </p>
            </section>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
