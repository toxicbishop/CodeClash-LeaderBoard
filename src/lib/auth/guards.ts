/**
 * src/lib/auth/guards.ts  —  v2
 *
 * Four role guards for the revised architecture:
 *   SUPER_ADMIN        → requireSuperAdmin()       — /admin/* pages
 *   MASTER_LAB_ADMIN   → requireMasterLabAdmin()   — /upload/* pages
 *   HOD | PRINCIPAL    → requireMonitor()          — /monitor/* pages
 *   SUPER_ADMIN | MASTER_LAB_ADMIN → requireAnyAdmin() — shared pages
 */

import { forbidden, redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export type GuardResult = {
  user: { id: string };
  profile: { name: string; email: string; role: UserRole; account_status: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
};

async function guard(allowedRoles: UserRole[], loginPath = '/'): Promise<GuardResult> {
  await connection();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath);

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, role, account_status')
    .eq('user_id', user.id)
    .eq('account_status', 'ACTIVE')
    .single();

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    try {
      const adminClient = createAdminClient();
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'ROLE_CHECK_FAILED',
        entity_type: 'user',
        entity_id: user.id,
        details: {
          current_role: profile?.role || 'UNKNOWN',
          required_roles: allowedRoles,
          login_path: loginPath,
        },
      });
    } catch {
      // Best-effort audit logging
    }
    forbidden();
  }

  return { user, profile: profile as GuardResult['profile'], supabase };
}

/**
 * requireSuperAdmin()
 * Full control — competition creation, approval, publishing.
 */
export async function requireSuperAdmin(): Promise<GuardResult> {
  return guard(['SUPER_ADMIN']);
}

/**
 * requireMasterLabAdmin()
 * HackerRank sync and upload management.
 * Super Admins can also access upload pages.
 */
export async function requireMasterLabAdmin(): Promise<GuardResult> {
  return guard(['SUPER_ADMIN', 'MASTER_LAB_ADMIN']);
}

/**
 * requireMonitor()
 * Read-only access for HOD and Principal.
 * Redirects to the monitor login page if not authenticated.
 */
export async function requireMonitor(): Promise<GuardResult> {
  return guard(['HOD', 'PRINCIPAL'], '/monitor/login');
}

/**
 * requireAnyAdmin()
 * Any administrative role (not monitors).
 */
export async function requireAnyAdmin(): Promise<GuardResult> {
  return guard(['SUPER_ADMIN', 'MASTER_LAB_ADMIN']);
}

/**
 * requireAnyAuthorizedUser()
 * Any authorized stakeholder: Super Admin, Master Lab Admin, HOD, or Principal.
 */
export async function requireAnyAuthorizedUser(): Promise<GuardResult> {
  return guard(['SUPER_ADMIN', 'MASTER_LAB_ADMIN', 'HOD', 'PRINCIPAL']);
}

