import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './login/LoginForm';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Sign In | Code Clash Leaderboard',
  description: 'Sign in to access the Competition or Lab Administrator portal',
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
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Code Clash 2026
            </span>
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              Contest Portal
            </span>
          </div>

          <Link
            href="/leaderboard"
            className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            Live Leaderboard →
          </Link>
        </div>
      </header>

      <main className="py-12 sm:px-6 lg:px-8 flex-1 flex flex-col justify-center">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Code Clash 2026
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Leaderboard Portal
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your administrator credentials
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-xl sm:px-10">
            <LoginForm />
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/leaderboard"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Looking for contestant standings? View Live Leaderboard →
            </Link>
          </div>
        </div>
      </main>

      <FatFooter />
    </div>
  );
}
