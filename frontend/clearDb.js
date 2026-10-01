import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ztiifyaoxyeefxokqben.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWlmeWFveHllZWZ4b2txYmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzMwMjEsImV4cCI6MjEwNjM0OTAyMX0.ngeYVon4Gmq06ToDpFIjei5bh1j2YzT51fZCvQKKROY'
);

async function clear() {
  console.log("Deleting submissions...");
  await supabase.from('submissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleting drafts...");
  await supabase.from('drafts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleting violations...");
  await supabase.from('violations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleting teams...");
  await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Deleting question_answers...");
  await supabase.from('question_answers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleting questions...");
  await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("Deleting rounds...");
  await supabase.from('rounds').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Database cleared successfully!");
}

clear().catch(console.error);
