import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logout } from '@/app/login/actions';

export const instant = false;

export default async function LabAdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Lab Admin Portal
            </span>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
              Welcome, {profile?.name || user.email}
            </h1>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            >
              Sign out
            </button>
          </form>
        </header>

        <main className="mt-8">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Assigned Lab Overview
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Role: <span className="font-mono text-emerald-500 font-semibold">{profile?.role}</span>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
