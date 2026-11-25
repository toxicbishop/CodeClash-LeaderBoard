import { ErrorPageShell } from '@/components/ErrorPageShell';

export const metadata = {
  title: '404 — Page Not Found | Code Clash Leaderboard',
};

export default function NotFoundPage() {
  return (
    <ErrorPageShell
      code="404"
      badge="ERROR 404"
      title="Page not found"
      description="The route or resource you requested doesn't exist, was moved, or is no longer active."
      tone="indigo"
      showSignInLink
    />
  );
}
