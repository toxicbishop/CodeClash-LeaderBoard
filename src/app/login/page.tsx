import { LoginForm } from './LoginForm';
import { FatFooter } from '@/components/FatFooter';

export const metadata = {
  title: 'Sign In | Code Clash Leaderboard',
  description: 'Sign in to access the Competition or Lab Administrator portal',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Code Clash 2026
          </p>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Administrator Portal
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Sign in with your competition or lab administrator credentials
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-xl sm:px-10">
            <LoginForm />
          </div>
        </div>
      </div>

      <FatFooter />
    </div>
  );
}