/**
 * scripts/seed-review-demo.ts (v2 Centralized Architecture)
 *
 * Seeds a fully populated multi-set scenario matching the revised specification:
 *  - 1 competition "Code Clash 2026" (slug: code-clash-demo-2026)
 *  - 4 contest sets (Set A, Set B, Set C, Set D) mapped to HackerRank slugs
 *  - 1 Master Lab Admin account
 *  - Realistic participant scores staged per set (status: PENDING_APPROVAL)
 *  - 1 intentional cross-set collision (to test the collision warning flag)
 *
 * Usage:
 *   pnpm seed:review-demo
 *   pnpm seed:review-demo --reset
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}

const RESET_MODE = process.argv.includes('--reset');
const DEMO_SLUG = 'code-clash-demo-2026';

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

const SET_CONFIGS = [
  {
    name: 'Set A',
    code: 'setA',
    slug: 'codeclash-2026-setA',
    participants: [
      { hacker: 'alice_cse', score: 300, solved: 3, penalty: 2400 },
      { hacker: 'rohit_ece', score: 280, solved: 3, penalty: 3100 },
      { hacker: 'priya_it', score: 250, solved: 2, penalty: 1800 },
      { hacker: 'shared_coder', score: 220, solved: 2, penalty: 2100 }, // collision with Set B
    ],
  },
  {
    name: 'Set B',
    code: 'setB',
    slug: 'codeclash-2026-setB',
    participants: [
      { hacker: 'shared_coder', score: 270, solved: 3, penalty: 2900 }, // collision
      { hacker: 'karthik_mech', score: 260, solved: 2, penalty: 1500 },
      { hacker: 'deepa_ai', score: 240, solved: 2, penalty: 2000 },
      { hacker: 'vikram_ds', score: 190, solved: 1, penalty: 1200 },
    ],
  },
  {
    name: 'Set C',
    code: 'setC',
    slug: 'codeclash-2026-setC',
    participants: [
      { hacker: 'sneha_cyber', score: 300, solved: 3, penalty: 2100 },
      { hacker: 'manish_ee', score: 290, solved: 3, penalty: 2800 },
      { hacker: 'ananya_csbs', score: 210, solved: 2, penalty: 2500 },
    ],
  },
  {
    name: 'Set D',
    code: 'setD',
    slug: 'codeclash-2026-setD',
    participants: [
      { hacker: 'varun_iot', score: 290, solved: 3, penalty: 2600 },
      { hacker: 'pooja_aiml', score: 270, solved: 2, penalty: 1700 },
      { hacker: 'rahul_auto', score: 180, solved: 1, penalty: 1400 },
    ],
  },
];

async function main() {
  console.log('\n📦 Code Clash Leaderboard — v2 Demo Seeder\n');

  // Find super admin to set as creator
  const { data: superAdmin } = await supabase
    .from('users')
    .select('user_id')
    .eq('role', 'SUPER_ADMIN')
    .limit(1)
    .single();

  if (!superAdmin) {
    console.error('Super Admin profile not found. Run "pnpm admin:sync" first.');
    process.exit(1);
  }

  // Find master lab admin
  let masterAdminId = (
    await supabase.from('users').select('user_id').eq('role', 'MASTER_LAB_ADMIN').limit(1).maybeSingle()
  )?.data?.user_id;

  if (!masterAdminId) {
    masterAdminId = superAdmin.user_id;
  }

  // Check if demo competition exists
  const { data: existingComp } = await supabase
    .from('competitions')
    .select('competition_id')
    .eq('slug', DEMO_SLUG)
    .maybeSingle();

  if (existingComp) {
    if (RESET_MODE) {
      console.log('🗑  Resetting demo competition...');
      await supabase.from('competitions').delete().eq('competition_id', existingComp.competition_id);
    } else {
      console.log('ℹ  Demo competition already exists. Pass --reset to wipe and re-seed.\n');
      return;
    }
  }

  // 1. Create competition
  const { data: comp, error: compErr } = await supabase
    .from('competitions')
    .insert({
      slug: DEMO_SLUG,
      competition_name: 'Code Clash Demo 2026',
      description: 'Centralized 4-set coding competition demo with HackerRank sync and multi-set consolidation.',
      contest_date: new Date().toISOString().split('T')[0],
      top_k: 10,
      status: 'READY_FOR_REVIEW',
      created_by: superAdmin.user_id,
    })
    .select('competition_id')
    .single();

  if (compErr || !comp) throw compErr;
  console.log(`✓ Created competition: Code Clash Demo 2026 (${comp.competition_id})`);

  // Seed default tie breakers
  await supabase.rpc('seed_default_tiebreakers', { p_competition_id: comp.competition_id });

  // 2. Create contest sets & staged uploads
  for (const setCfg of SET_CONFIGS) {
    const { data: set, error: setErr } = await supabase
      .from('contest_sets')
      .insert({
        competition_id: comp.competition_id,
        set_name: setCfg.name,
        set_code: setCfg.code,
        hackerrank_slug: setCfg.slug,
      })
      .select('set_id')
      .single();

    if (setErr || !set) throw setErr;

    // Check for collisions with previously inserted participants
    const { data: existingParts } = await supabase
      .from('participants')
      .select('external_id, contest_sets(set_name)')
      .eq('competition_id', comp.competition_id);

    const collisionMap = new Map<string, string>();
    existingParts?.forEach((p) => {
      collisionMap.set(
        p.external_id.toLowerCase(),
        (p.contest_sets as unknown as { set_name: string })?.set_name || 'Other Set'
      );
    });

    const setCollisions: Array<{ external_id: string; conflicting_set_name: string }> = [];
    setCfg.participants.forEach((p) => {
      if (collisionMap.has(p.hacker.toLowerCase())) {
        setCollisions.push({
          external_id: p.hacker,
          conflicting_set_name: collisionMap.get(p.hacker.toLowerCase())!,
        });
      }
    });

    // Create upload
    const { data: upload, error: upErr } = await supabase
      .from('uploads')
      .insert({
        competition_id: comp.competition_id,
        set_id: set.set_id,
        uploaded_by: masterAdminId,
        hackerrank_slug: setCfg.slug,
        upload_version: 1,
        status: 'PENDING_APPROVAL',
        record_count: setCfg.participants.length,
        collision_flags: setCollisions.length > 0 ? setCollisions : null,
      })
      .select('upload_id')
      .single();

    if (upErr || !upload) throw upErr;

    // Create participants & results
    const partRows = setCfg.participants.map((p) => ({
      competition_id: comp.competition_id,
      set_id: set.set_id,
      upload_id: upload.upload_id,
      external_id: p.hacker,
      participant_name: p.hacker,
      has_collision: collisionMap.has(p.hacker.toLowerCase()),
    }));

    const { data: insertedParts, error: partErr } = await supabase
      .from('participants')
      .insert(partRows)
      .select('participant_id, external_id');

    if (partErr || !insertedParts) throw partErr;

    const resRows = insertedParts.map((ip) => {
      const src = setCfg.participants.find((p) => p.hacker === ip.external_id)!;
      return {
        participant_id: ip.participant_id,
        upload_id: upload.upload_id,
        total_score: src.score,
        problems_solved: src.solved,
        penalty: src.penalty,
      };
    });

    await supabase.from('results').insert(resRows);
    console.log(`✓ ${setCfg.name} (${setCfg.slug}): ${setCfg.participants.length} participants (PENDING_APPROVAL)`);
  }

  console.log('\n✅ Demo seeding complete!');
  console.log('  → Login as Super Admin at http://localhost:3000');
  console.log('  → Navigate to /admin/competitions to review & approve uploads');
  console.log('  → Master Lab Admin upload panel: http://localhost:3000/upload');
  console.log('  → Principal/HOD monitor: http://localhost:3000/monitor/login\n');
}

main().catch(console.error);
