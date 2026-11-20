import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { RulesEditor } from './RulesEditor';

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TieBreakerRulesPage({ params }: PageProps) {
  const { profile, supabase } = await requireSuperAdmin();
  const { id: competitionId } = await params;

  const { data: competition } = await supabase
    .from('competitions')
    .select('competition_id, competition_name, slug')
    .eq('competition_id', competitionId)
    .single();

  if (!competition) notFound();

  const { data: rules } = await supabase
    .from('tie_breaker_rules')
    .select('*')
    .eq('competition_id', competitionId)
    .order('priority', { ascending: true });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminNav currentPath="/admin/competitions" adminName={profile.name} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/admin/competitions/${competitionId}`}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to {competition.competition_name}
        </Link>

        <div className="mt-6 mb-8">
          <div className="flex items-center space-x-2 text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
            <span>Ranking & Evaluation Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            Tie-Breaker Rules Configuration
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Configure the lexicographical sort priority used to consolidate contestant standings across contest sets.
            Rule #1 is evaluated first; subsequent enabled rules resolve identical scores down the hierarchy.
          </p>
        </div>

        <RulesEditor competitionId={competitionId} initialRules={rules || []} />
      </main>
    </div>
  );
}
