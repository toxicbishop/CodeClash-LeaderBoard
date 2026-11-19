import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

function required(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Set ${name} in .env.local or the environment.`);
  return value;
}

async function main() {
  const email = required('COMPETITION_ADMIN_EMAIL').trim().toLowerCase();
  const password = required('COMPETITION_ADMIN_PASSWORD');
  const supabase = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = supabase.auth.admin;
  const name = 'Lead Competition Admin';
  const role = 'COMPETITION_ADMIN';

  // Look up the Auth identity first so a retry after a failed profile insert is safe.
  let userId: string | undefined;
  let createdBySeed = false;
  let page = 1;
  while (true) {
    const { data, error } = await admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((entry) => entry.email?.toLowerCase() === email);
    if (user) {
      userId = user.id;
      createdBySeed = user.app_metadata.competition_admin_seed === true;
      break;
    }
    if (!data.nextPage) break;
    page = data.nextPage;
  }

  if (userId) {
    const { data: profile, error } = await supabase.from('users')
      .select('role').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (profile ? profile.role !== role : !createdBySeed) {
      throw new Error('The configured email belongs to an existing account without a competition administrator profile.');
    }
    const { error: updateError } = await admin.updateUserById(userId, { password });
    if (updateError && updateError.code !== 'same_password') throw updateError;
    if (profile) {
      console.log('Competition administrator password synchronized.');
      return;
    }
  } else {
    const { data, error } = await admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role },
      app_metadata: { competition_admin_seed: true },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error } = await supabase.from('users').upsert(
    { user_id: userId, email, name, role, account_status: 'ACTIVE' },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  console.log('Competition administrator account ready.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin credential sync failed.');
  process.exitCode = 1;
});
