import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Terms & Conditions | Code Clash 2026',
  description: 'Terms of participation and contest guidelines for Code Clash 2026.',
};

export default function TermsPage() {
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
              Terms & Conditions
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Contest terms, eligibility rules, and scoring procedures governing Code Clash 2026 and its consolidated leaderboard system.
            </p>
          </div>

          <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Eligibility & Registration</h2>
              <p>
                Participation in Code Clash 2026 is open to verified participants registered across assigned computer
                laboratories. Contestants must use their designated credentials and compete solely within their assigned lab section.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. Fair Play & Academic Integrity</h2>
              <p>
                All submitted source code must be the original work of the contestant during the contest period.
                Any form of collusion, sharing of solutions between physical labs, or cross-lab impersonation
                will result in immediate disqualification and removal from all official leaderboard rankings.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Scoring & Tiebreaking Rules</h2>
              <p>
                Results ingested from lab contest sessions are consolidated according to standardized global criteria:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
                <li>Primary metric: Total score across all competition rounds (100 marks maximum).</li>
                <li>Secondary tiebreaker: Total number of fully solved problems.</li>
                <li>Tertiary tiebreaker: Total elapsed contest time / penalty in seconds.</li>
                <li>Contestants tied on all three metrics share the same overall rank.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. Publication & Verification Gate</h2>
              <p>
                Individual lab results are subject to administrative verification and audit before official publication.
                Published leaderboards represent immutable official snapshots. Any adjustments require re-verification
                and the issuance of an incremented snapshot version.
              </p>
            </section>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
