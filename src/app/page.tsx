import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login/LoginForm';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Sign In | Code Clash Leaderboard',
  description: 'Sign in to access the competition or lab administrator portal',
};

export const instant = false;

export default async function LoginPage() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'COMPETITION_ADMIN') {
      redirect('/admin');
    } else if (profile?.role === 'MASTER_LAB_ADMIN' || profile?.role === 'LAB_ADMIN') {
      redirect('/upload');
    } else if (profile?.role === 'HOD' || profile?.role === 'PRINCIPAL') {
      redirect('/monitor');
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Code Clash 2026
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Administrator Portal
            </span>
          </div>

          <Link
            href="/leaderboard"
            className="text-xs font-medium px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Live leaderboard &rarr;
          </Link>
        </div>
      </header>

      <main className="py-16 px-4 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h1 className="text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to Code Clash
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Enter administrator credentials to manage competitions, audit contest sets, or submit lab scores.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-zinc-900 p-8 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <LoginForm />
          </div>

          <div className="mt-6">
            <Link
              href="/leaderboard"
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4"
            >
              Looking for contestant standings? View public leaderboard &rarr;
            </Link>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
