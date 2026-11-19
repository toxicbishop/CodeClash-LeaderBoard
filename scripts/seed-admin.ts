import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_local_service_role_key_here';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const adminEmail = 'admin@codeclash.com';
  const adminPassword = 'AdminPassword123!';
  const adminName = 'Lead Competition Admin';

  console.log(`Checking if admin user exists (${adminEmail})...`);

  // Check if user already exists
  const { data: userList } = await supabase.auth.admin.listUsers();
  const existingUser = userList.users.find((u) => u.email === adminEmail);

  let userId: string;

  if (existingUser) {
    console.log(`Admin user already exists with ID: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    console.log('Creating admin in auth.users...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: adminName,
        role: 'COMPETITION_ADMIN',
      },
    });

    if (createError || !newUser.user) {
      console.error('Failed to create auth user:', createError);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`Created auth user: ${userId}`);
  }

  // Upsert profile in public.users
  console.log('Upserting public.users profile...');
  const { error: profileError } = await supabase.from('users').upsert({
    user_id: userId,
    name: adminName,
    email: adminEmail,
    role: 'COMPETITION_ADMIN',
    account_status: 'ACTIVE',
  });

  if (profileError) {
    console.error('Failed to upsert profile:', profileError);
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log('Default Competition Admin created successfully!');
  console.log(`Email:    ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log('=============================================\n');
}

main();
