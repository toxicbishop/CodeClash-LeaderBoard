import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}. Set it in .env.local.`);
  return value.trim();
}

async function main() {
  const supabase = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const accounts = [
    {
      email: required('MASTER_LAB_ADMIN_EMAIL').toLowerCase(),
      password: required('MASTER_LAB_ADMIN_PASSWORD'),
      name: 'Lead Master Lab Admin',
      role: 'MASTER_LAB_ADMIN',
    },
    {
      email: required('HOD_EMAIL').toLowerCase(),
      password: required('HOD_PASSWORD'),
      name: 'Dr. Ramesh Sharma (HOD CSE)',
      role: 'HOD',
    },
    {
      email: required('PRINCIPAL_EMAIL').toLowerCase(),
      password: required('PRINCIPAL_PASSWORD'),
      name: 'Dr. Sunita Patel (Principal)',
      role: 'PRINCIPAL',
    },
  ];

  console.log('\n🌱 Synchronizing institutional & master accounts from .env.local...');

  for (const acc of accounts) {
    const { data: list } = await supabase.auth.admin.listUsers();
    let userId = list?.users.find((u) => u.email?.toLowerCase() === acc.email)?.id;

    if (!userId) {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
      });
      if (error) {
        throw new Error('Failed to create account: ' + acc.email + ' - ' + error.message);
      }
      userId = newUser.user.id;
    } else {
      await supabase.auth.admin.updateUserById(userId, { password: acc.password });
    }

    await supabase.from('users').upsert({
      user_id: userId,
      name: acc.name,
      email: acc.email,
      role: acc.role,
      account_status: 'ACTIVE',
    });

    console.log('✓ Account active: ' + acc.role + ' (' + acc.email + ')');
  }

  console.log('\n✅ All accounts synchronized successfully.\n');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.log('Error during seed: ' + msg);
  process.exit(1);
});
