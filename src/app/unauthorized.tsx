import { ErrorPageShell } from '@/components/ErrorPageShell';

export const metadata = {
  title: '401 — Unauthorized | Code Clash Leaderboard',
};

export default function UnauthorizedPage() {
  return (
    <ErrorPageShell
      code="401"
      badge="ERROR 401 • UNAUTHORIZED"
      title="Unauthorized"
      description="Authorization is required to access this endpoint."
      tone="amber"
    />
  );
}
