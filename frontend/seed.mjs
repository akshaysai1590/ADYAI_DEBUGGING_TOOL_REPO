/**
 * Seed script — creates 3 rounds + placeholder questions
 * Run: node seed.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ztiifyaoxyeefxokqben.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWlmeWFveHllZWZ4b2txYmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzMwMjEsImV4cCI6MjEwNjM0OTAyMX0.ngeYVon4Gmq06ToDpFIjei5bh1j2YzT51fZCvQKKROY';
const CONTEST_ID = '11111111-1111-1111-1111-111111111111';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Round definitions ────────────────────────────────────────────────────────
const ROUNDS = [
  { round_number: 1, name: 'Easy — Round 1',   duration_seconds: 1800, questionCount: 6 },
  { round_number: 2, name: 'Medium — Round 2', duration_seconds: 1500, questionCount: 4 },
  { round_number: 3, name: 'Hard — Round 3',   duration_seconds: 1200, questionCount: 2 },
];

async function main() {
  console.log('\n🌱  Adhyant Seed Script');
  console.log('══════════════════════════════════════\n');

  // ── 1. Wipe existing rounds for this contest (questions cascade-delete) ──
  console.log('🗑  Clearing existing rounds…');
  const { error: delErr } = await supabase
    .from('rounds')
    .delete()
    .eq('contest_id', CONTEST_ID);

  if (delErr) {
    console.error('❌  Failed to delete rounds:', delErr.message);
    process.exit(1);
  }
  console.log('   ✓ Existing rounds cleared.\n');

  // ── 2. Insert rounds + placeholder questions ────────────────────────────
  for (const round of ROUNDS) {
    process.stdout.write(`📦  Inserting "${round.name}" …`);

    const { data: roundRow, error: rErr } = await supabase
      .from('rounds')
      .insert({
        contest_id:       CONTEST_ID,
        round_number:     round.round_number,
        name:             round.name,
        duration_seconds: round.duration_seconds,
        status:           'pending',
      })
      .select()
      .single();

    if (rErr) {
      console.error(`\n❌  Round insert failed: ${rErr.message}`);
      process.exit(1);
    }
    console.log(` ✓  id=${roundRow.id}`);

    // Placeholder questions
    for (let i = 1; i <= round.questionCount; i++) {
      const { error: qErr } = await supabase.from('questions').insert({
        round_id:             roundRow.id,
        language:             'python',
        title:                `Question ${i} (TBD)`,
        buggy_code:           `# Question ${i} — to be filled by admin\nprint("Hello")`,
        editable_line_ranges: [[2, 2]],
        marks:                10,
        display_order:        i,
      });
      if (qErr) {
        console.error(`   ❌  Question ${i} failed: ${qErr.message}`);
      } else {
        console.log(`   ↳  Q${i} placeholder created`);
      }
    }
    console.log();
  }

  // ── 3. Summary ─────────────────────────────────────────────────────────
  const { data: allRounds } = await supabase
    .from('rounds')
    .select('name, round_number, duration_seconds')
    .eq('contest_id', CONTEST_ID)
    .order('round_number');

  const { data: allQuestions } = await supabase
    .from('questions')
    .select('title, round_id');

  console.log('══════════════════════════════════════');
  console.log('✅  Seed complete!\n');
  console.log('Rounds in DB:');
  allRounds?.forEach(r => {
    const qCount = allQuestions?.filter(q => q.round_id).length ?? 0;
    const dur = `${r.duration_seconds / 60} min`;
    console.log(`  • [${r.round_number}] ${r.name}  (${dur})`);
  });
  console.log(`\nTotal placeholder questions: ${allQuestions?.length ?? 0}`);
  console.log('\nOpen the admin panel → Questions tab to fill them in.');
}

main().catch(err => { console.error(err); process.exit(1); });
