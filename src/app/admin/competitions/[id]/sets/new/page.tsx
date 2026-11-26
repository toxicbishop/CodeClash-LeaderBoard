import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { NewContestSetForm } from './NewContestSetForm';

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

  const { data: existingSets } = await supabase
    .from('contest_sets')
    .select('set_id, set_name, set_code, hackerrank_slug')
    .eq('competition_id', competitionId)
    .order('set_code', { ascending: true });

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

          <NewContestSetForm
            competitionId={competitionId}
            existingSets={existingSets ?? []}
          />
        </div>
      </main>
    </div>
  );
}
