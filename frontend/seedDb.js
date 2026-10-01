import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ztiifyaoxyeefxokqben.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWlmeWFveHllZWZ4b2txYmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzMwMjEsImV4cCI6MjEwNjM0OTAyMX0.ngeYVon4Gmq06ToDpFIjei5bh1j2YzT51fZCvQKKROY'
);

async function seed() {
  const roundId = '22222222-2222-2222-2222-222222222222';
  console.log("Seeding round...");
  await supabase.from('rounds').insert({
    id: roundId,
    contest_id: '11111111-1111-1111-1111-111111111111',
    name: 'Round 1',
    round_number: 1,
    duration_seconds: 1800,
    status: 'pending'
  });

  const questions = [
    {
      id: '44444444-4444-4444-4444-444444444444',
      round_id: roundId,
      title: '1. Buggy Greeting',
      marks: 10,
      display_order: 1,
      language: 'python',
      buggy_code: `def greet(name):\n    return "Goodbye, " + name\n\nprint(greet("World"))`,
      editable_line_ranges: [[3, 3]]
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      round_id: roundId,
      title: '2. Array Sum',
      marks: 15,
      display_order: 2,
      language: 'python',
      buggy_code: `def sum_array(arr):\n    total = 0\n    for i in range(1, len(arr)):\n        total += arr[i]\n    return total\n\nprint(sum_array([10, 20, 30, 40]))`,
      editable_line_ranges: [[4, 4]]
    },
    {
      id: '66666666-6666-6666-6666-666666666666',
      round_id: roundId,
      title: '3. Even or Odd',
      marks: 10,
      display_order: 3,
      language: 'python',
      buggy_code: `def check_even_odd(n):\n    if n % 2 != 0:\n        return "Even"\n    else:\n        return "Odd"\n\nprint(check_even_odd(42))`,
      editable_line_ranges: [[3, 3]]
    }
  ];

  const expectedOutputs = [
    { question_id: '44444444-4444-4444-4444-444444444444', expected_output: 'Hello, World' },
    { question_id: '55555555-5555-5555-5555-555555555555', expected_output: '100' },
    { question_id: '66666666-6666-6666-6666-666666666666', expected_output: 'Even' }
  ];

  console.log("Seeding questions...");
  await supabase.from('questions').insert(questions);
  
  console.log("Seeding question answers...");
  await supabase.from('question_answers').insert(expectedOutputs);

  console.log("Database seeded successfully!");
}

seed().catch(console.error);
