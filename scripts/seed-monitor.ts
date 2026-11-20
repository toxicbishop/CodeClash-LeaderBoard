import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

function required(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Set ${name} in .env.local.`);
  return value;
}

const ACCOUNTS = [
  {
    email: 'masterlab@codeclash.com',
    password: 'password123',
    name: 'Lead Master Lab Admin',
    role: 'MASTER_LAB_ADMIN',
  },
  {
    email: 'hod@institution.edu',
    password: 'password123',
    name: 'Dr. Ramesh Sharma (HOD CSE)',
    role: 'HOD',
  },
  {
    email: 'principal@institution.edu',
    password: 'password123',
    name: 'Dr. Sunita Patel (Principal)',
    role: 'PRINCIPAL',
  },
];

async function main() {
  const supabase = createClient(
    required('NEXT_PUBLIC_SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('\n🌱 Seeding v2 accounts (Master Lab Admin, HOD, Principal)...');

  for (const acc of ACCOUNTS) {
    const { data: list } = await supabase.auth.admin.listUsers();
    let userId = list?.users.find((u) => u.email?.toLowerCase() === acc.email)?.id;

    if (!userId) {
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`Failed to create ${acc.email}:`, error.message);
        continue;
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

    console.log(`✓ ${acc.role}: ${acc.email} / ${acc.password}`);
  }

  console.log('\n✅ Institutional & Master accounts ready.\n');
}

main().catch(console.error);
