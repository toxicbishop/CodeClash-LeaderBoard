import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { createContestSet } from '@/app/admin/actions';

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NewContestSetPage({ params }: PageProps) {
  const { id: competitionId } = await params;
  const { profile, supabase } = await requireSuperAdmin();

  const { data: comp } = await supabase
    .from('competitions')
    .select('competition_id, competition_name')
    .eq('competition_id', competitionId)
    .single();

  if (!comp) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-xl mx-auto px-4 py-8">
        <Link
          href={`/admin/competitions/${competitionId}`}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center space-x-1"
        >
          <span>← Back to {comp.competition_name}</span>
        </Link>

        <div className="mt-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Add Contest Set</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Map a new contest set (e.g. Set A) to its live HackerRank contest slug.
          </p>

          <form action={createContestSet} className="mt-6 space-y-4">
            <input type="hidden" name="competition_id" value={competitionId} />

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Set Name
              </label>
              <input
                name="set_name"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Set A"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Set Code (Short Identifier)
              </label>
              <input
                name="set_code"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="setA"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                HackerRank Contest Slug
              </label>
              <input
                name="hackerrank_slug"
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="codeclash-2026-setA"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Matches the URL: hackerrank.com/contests/[slug]
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                HackerRank Session Cookie (Optional)
              </label>
              <input
                name="hr_session_cookie"
                type="password"
                className="mt-1 block w-full px-3 py-2 text-sm font-mono rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Paste _hrank_session value so lab admins don't need to"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Encrypted with AES-256-GCM before storing. Leave blank if you prefer entering it during sync.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end space-x-3">
              <Link
                href={`/admin/competitions/${competitionId}`}
                className="px-4 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
              >
                Add Set
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
