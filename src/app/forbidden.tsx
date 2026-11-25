import { ErrorPageShell } from '@/components/ErrorPageShell';

export const metadata = {
  title: '403 — Access Denied | Code Clash Leaderboard',
};

export default function ForbiddenPage() {
  return (
    <ErrorPageShell
      code="403"
      badge="ERROR 403 • ACCESS DENIED"
      title="You don't have access"
      description="You do not have permission to view this resource. Contact the Super Admin if you believe this is an error."
      tone="red"
      showSignInLink
    />
  );
}
