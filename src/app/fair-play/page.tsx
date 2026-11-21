import Link from 'next/link';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Fair Play Rules | Code Clash 2026',
  description: 'Academic integrity, competition ethics, and anti-collusion guidelines for Code Clash 2026.',
};

export default function FairPlayPage() {
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
              Fair Play & Code of Conduct
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Rules governing academic integrity, workstation use, and collision detection during Code Clash 2026.
            </p>
          </div>

          <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">1. Individual Authorship</h2>
              <p>
                All code submitted during the competition must be written entirely by the registered contestant
                during the active contest window. Use of unauthorized code generators, peer collaboration,
                or pre-written templates not explicitly permitted in problem statements is strictly prohibited.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">2. Single Workstation & Identity Policy</h2>
              <p>
                Each participant is assigned to a physical lab workstation and must compete exclusively under their verified
                HackerRank identifier. Sharing workstations, switching terminals without proctor authorization,
                or allowing another individual to submit from an assigned terminal will trigger immediate disqualification.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">3. Cross-Set Collision Detection</h2>
              <p>
                The platform runs automated collision detection across all synchronized contest sets. If an identifier
                appears in more than one laboratory upload simultaneously, the system flags the upload for administrative
                audit and pauses rank publication until the collision is resolved by the competition administrator.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">4. Plagiarism Analysis & Review</h2>
              <p>
                Submissions are subject to automated similarity checks and AST-level code comparisons. If two or more
                submissions demonstrate statistical identity beyond trivial boilerplate:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
                <li>All involved participants will be flagged for review.</li>
                <li>Both laboratory proctors and the Competition Admin will examine commit timestamps and telemetry.</li>
                <li>Confirmed violations result in nullification of scores and removal from official snapshot releases.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">5. Appeals & Audit Logging</h2>
              <p>
                All administrative actions, score adjustments, and snapshot generations are immutably logged with
                actor metadata. Disqualification decisions may be formally appealed to the organizing review committee
                within 60 minutes of draft leaderboard publication.
              </p>
            </section>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
