/**
 * scripts/seed-review-demo.ts
 *
 * Seeds a fully populated Phase-3-ready scenario so the admin can immediately
 * test the Review, Approve & Reject flow without manually uploading files.
 *
 * Creates:
 *  - 1 competition "Code Clash Demo 2026" with deadline 1 hour from now
 *  - 2 lab admin accounts (lab-admin-1@demo.local, lab-admin-2@demo.local)
 *  - 2 labs (Lab A, Lab B) assigned to those admins
 *  - 10 participants per lab with realistic scores
 *  - 2 uploads (both PENDING_APPROVAL) so the admin sees the full review UI
 *
 * Usage: pnpm seed:review-demo
 * Reset: pnpm seed:review-demo --reset  (wipes demo competition and re-seeds)
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

const RESET_MODE = process.argv.includes('--reset');
const DEMO_SLUG  = 'code-clash-demo-2026';

function required(name: string) {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Set ${name} in .env.local`);
  return v;
}

const supabase = createClient(
  required('NEXT_PUBLIC_SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const LAB_ADMINS = [
  { email: 'lab-a@demo.local', name: 'Demo Lab Admin A', password: 'demo-password-a' },
  { email: 'lab-b@demo.local', name: 'Demo Lab Admin B', password: 'demo-password-b' },
];

const PARTICIPANT_POOL = [
  ['P001', 'Alice Sharma',    95, 8, 120],
  ['P002', 'Bob Krishnan',    88, 7, 145],
  ['P003', 'Carol Patel',     82, 7, 160],
  ['P004', 'David Nair',      79, 6, 175],
  ['P005', 'Eva Mehta',       76, 6, 190],
  ['P006', 'Frank Reddy',     71, 5, 200],
  ['P007', 'Grace Iyer',      68, 5, 215],
  ['P008', 'Henry Verma',     63, 4, 230],
  ['P009', 'Iris Joshi',      55, 4, 250],
  ['P010', 'James Kumar',     42, 3, 300],
] as const;

async function upsertLabAdmin(email: string, name: string, password: string) {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const existing = users.find(u => u.email === email);

  let userId: string;
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { password });
    userId = existing.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role: 'LAB_ADMIN' },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  await supabase.from('users').upsert(
    { user_id: userId, email, name, role: 'LAB_ADMIN', account_status: 'ACTIVE' },
    { onConflict: 'user_id' }
  );
  return userId;
}

async function main() {
  console.log('\n📦 Code Clash Leaderboard — Demo Seeder\n');

  // Reset if requested
  if (RESET_MODE) {
    console.log('🗑  Resetting demo data...');
    const { data: existing } = await supabase
      .from('competitions').select('competition_id').eq('slug', DEMO_SLUG).maybeSingle();
    if (existing) {
      await supabase.from('competitions').delete().eq('competition_id', existing.competition_id);
      console.log('   Demo competition deleted (cascade removes labs, uploads, participants)');
    }
  }

  // Check if already seeded
  const { data: existing } = await supabase
    .from('competitions').select('competition_id').eq('slug', DEMO_SLUG).maybeSingle();
  if (existing && !RESET_MODE) {
    console.log('⚠  Demo data already exists. Use --reset to re-seed.\n');
    return;
  }

  // 1. Get competition admin
  const { data: adminProfile } = await supabase
    .from('users').select('user_id').eq('role', 'COMPETITION_ADMIN').limit(1).maybeSingle();
  if (!adminProfile) throw new Error('No Competition Admin found. Run pnpm admin:sync first.');
  const adminId = adminProfile.user_id;

  // 2. Create competition
  const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .insert({
      slug: DEMO_SLUG,
      competition_name: 'Code Clash Demo 2026',
      description: 'Seeded demo competition for testing the review and approval workflow.',
      contest_date: new Date().toISOString().split('T')[0],
      upload_deadline: deadline,
      top_k: 5,
      created_by: adminId,
    })
    .select('competition_id')
    .single();
  if (compError) throw compError;
  console.log(`✓ Created competition: Code Clash Demo 2026 (${competition.competition_id})`);

  // 3. Create lab admin accounts
  const adminIds = await Promise.all(
    LAB_ADMINS.map(a => upsertLabAdmin(a.email, a.name, a.password))
  );
  console.log('✓ Lab admin accounts ready (lab-a@demo.local / lab-b@demo.local, password: demo-password-*)');

  // 4. Create labs
  const labNames = ['Lab A — Block 1', 'Lab B — Block 2'];
  const labIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { data: lab, error } = await supabase
      .from('labs')
      .insert({
        lab_name: labNames[i],
        competition_id: competition.competition_id,
        assigned_admin_id: adminIds[i],
      })
      .select('lab_id')
      .single();
    if (error) throw error;
    labIds.push(lab.lab_id);
  }
  console.log('✓ Labs created: Lab A and Lab B');

  // 5. For each lab: create upload record + participants + results
  for (let labIndex = 0; labIndex < 2; labIndex++) {
    const labId = labIds[labIndex];
    const labAdminId = adminIds[labIndex];
    const labLetter = labIndex === 0 ? 'A' : 'B';

    // Insert upload
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        competition_id: competition.competition_id,
        lab_id: labId,
        uploaded_by: labAdminId,
        file_name: `lab_${labLetter.toLowerCase()}_results.csv`,
        file_path: `demo/lab-${labLetter.toLowerCase()}-results.csv`,
        upload_version: 1,
        status: 'PENDING_APPROVAL',
        record_count: PARTICIPANT_POOL.length,
        column_mapping: { participantId: 0, participantName: 1, totalScore: 2, problemsSolved: 3, penalty: 4 },
      })
      .select('upload_id')
      .single();
    if (uploadError) throw uploadError;

    // Insert participants and results
    for (const [extId, name, score, solved, penalty] of PARTICIPANT_POOL) {
      const participantId = `${labLetter}-${extId}`;
      const { data: participant, error: pErr } = await supabase
        .from('participants')
        .upsert(
          { competition_id: competition.competition_id, external_participant_id: participantId, participant_name: name },
          { onConflict: 'competition_id,external_participant_id' }
        )
        .select('participant_id')
        .single();
      if (pErr) throw pErr;

      const { error: rErr } = await supabase.from('results').insert({
        participant_id: participant.participant_id,
        lab_id: labId,
        upload_id: upload.upload_id,
        total_score: score,
        problems_solved: solved,
        penalty,
      });
      if (rErr) throw rErr;
    }

    console.log(`✓ Lab ${labLetter}: seeded ${PARTICIPANT_POOL.length} participants (upload PENDING_APPROVAL)`);
  }

  console.log('\n✅ Demo seeding complete!\n');
  console.log('  → Go to http://localhost:3000/admin to see the competition');
  console.log('  → Click "Manage Labs →" on "Code Clash Demo 2026"');
  console.log('  → Both labs show PENDING APPROVAL — ready to test the review flow\n');
}

main().catch(err => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
