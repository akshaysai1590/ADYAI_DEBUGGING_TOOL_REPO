import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { question_id, team_id, code, language, action } = await req.json()
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: answerData } = await supabaseAdmin
      .from('question_answers')
      .select('expected_output')
      .eq('question_id', question_id)
      .single()

    const expectedOutput = (answerData?.expected_output || '').trim()
    let actualOutput = '';
    let runSuccess = false;
    let errorMessage = '';

    // Language ID mapping for Judge0 / Runner
    const langMap: Record<string, number> = {
      'python': 71,
      'javascript': 93,
      'java': 62,
      'c': 50,
      'cpp': 54
    };

    const judgeUrl = 'http://18.205.20.2:2358';
    const judgeToken = 'AdhyantSuperSecretToken123!';

    try {
      const awsReq = await fetch(`${judgeUrl}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': judgeToken
        },
        body: JSON.stringify({
          source_code: code,
          language_id: langMap[language] || 71
        })
      });

      const awsRes = await awsReq.json();

      if (awsRes.status?.id === 3) {
        actualOutput = (awsRes.stdout || '').trim();
        runSuccess = true;
      } else {
        // Compilation error, runtime error, or TLE
        errorMessage = (awsRes.stderr || awsRes.compile_output || awsRes.message || 'Execution error').trim();
        runSuccess = false;
      }
    } catch (e: any) {
      console.error('AWS Runner error:', e);
      errorMessage = 'Could not reach execution server: ' + (e.message || String(e));
      runSuccess = false;
    }

    if (!runSuccess) {
      return new Response(JSON.stringify({ 
        success: true, 
        is_correct: false, 
        message: "Execution or Compilation Error", 
        error_details: errorMessage 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Compare with expected output (case-insensitive trim or exact match)
    const isCorrect = actualOutput === expectedOutput;

    // Save to DB if submitting
    if (action === 'submit') {
      await supabaseAdmin.from('submissions').upsert({
        team_id,
        question_id,
        code,
        is_correct: isCorrect,
        marks_awarded: isCorrect ? 10 : 0,
        locked: true
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      is_correct: isCorrect,
      actual_output: actualOutput
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})
