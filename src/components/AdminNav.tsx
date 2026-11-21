import Link from 'next/link';
import { logout } from '@/app/login/actions';

interface AdminNavProps {
  currentPath?: string;
  adminName?: string;
}

export function AdminNav({ currentPath, adminName }: AdminNavProps) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                Code Clash
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Admin Console
              </span>
            </Link>

            <nav className="flex gap-4">
              <Link
                href="/admin"
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  currentPath === '/admin'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Overview
              </Link>
              <Link
                href="/admin/competitions"
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  currentPath?.startsWith('/admin/competitions')
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Competitions
              </Link>
              <Link
                href="/admin/users"
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                  currentPath === '/admin/users'
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Lab Admins
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {adminName && (
              <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                {adminName}
              </span>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="px-3 py-2 text-xs font-medium rounded-lg text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
