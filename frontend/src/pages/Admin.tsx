import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { Plus, Play, Square, Eye, Users, Trash2, LogOut, Download } from 'lucide-react';

export const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [tab, setTab] = useState<'rounds' | 'questions' | 'teams'>('rounds');

  // Rounds State
  const [rounds, setRounds] = useState<any[]>([]);
  const [newRound, setNewRound] = useState({ name: '', duration: 1800 });

  // Questions State
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQ, setNewQ] = useState({ round_id: '', language: 'python', title: '', buggy_code: '', editable_lines: '[[3,5]]', expected_output: '', marks: 10 });

  // Teams State
  const [teams, setTeams] = useState<any[]>([]);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState('DBG');

  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isAdmin) { navigate('/admin/login'); return; }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    const [r, q, t] = await Promise.all([
      supabase.from('rounds').select('*').order('round_number'),
      supabase.from('questions').select('*').order('display_order'),
      supabase.from('teams').select('*').order('created_at'),
    ]);
    if (r.data) setRounds(r.data);
    if (q.data) setQuestions(q.data);
    if (t.data) setTeams(t.data);
  };

  // ============ ROUNDS ============
  const addRound = async () => {
    const num = rounds.length + 1;
    const contestId = '11111111-1111-1111-1111-111111111111';
    await supabase.from('rounds').insert({ contest_id: contestId, round_number: num, name: newRound.name || `Round ${num}`, duration_seconds: newRound.duration });
    setNewRound({ name: '', duration: 1800 });
    fetchAll();
    setStatus('Round added!');
  };

  const toggleRound = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'ended' : 'active';
    const updates: any = { status: newStatus };
    if (newStatus === 'active') updates.starts_at = new Date().toISOString();
    if (newStatus === 'ended') updates.ends_at = new Date().toISOString();
    await supabase.from('rounds').update(updates).eq('id', id);
    fetchAll();
    setStatus(newStatus === 'active' ? '🟢 Round STARTED!' : '🔴 Round ENDED!');
  };

  const revealScores = async (id: string) => {
    await supabase.from('rounds').update({ scores_revealed: true }).eq('id', id);
    fetchAll();
    setStatus('Scores revealed!');
  };

  // ============ QUESTIONS ============
  const addQuestion = async () => {
    let editableRanges;
    try { editableRanges = JSON.parse(newQ.editable_lines); } catch { setStatus('Invalid editable lines JSON'); return; }
    
    const order = questions.filter(q => q.round_id === newQ.round_id).length + 1;
    const { data, error } = await supabase.from('questions').insert({
      round_id: newQ.round_id, language: newQ.language, title: newQ.title,
      buggy_code: newQ.buggy_code, editable_line_ranges: editableRanges, marks: newQ.marks, display_order: order
    }).select().single();

    if (error) { setStatus('Error: ' + error.message); return; }

    await supabase.from('question_answers').insert({ question_id: data.id, expected_output: newQ.expected_output });
    setNewQ({ round_id: newQ.round_id, language: 'python', title: '', buggy_code: '', editable_lines: '[[3,5]]', expected_output: '', marks: 10 });
    fetchAll();
    setStatus('Question + hidden answer added!');
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await supabase.from('question_answers').delete().eq('question_id', id);
    await supabase.from('questions').delete().eq('id', id);
    fetchAll();
  };

  // ============ TEAMS ============
  const generateTeams = async () => {
    const newTeams = [];
    for (let i = 1; i <= bulkCount; i++) {
      const teamId = `${bulkPrefix}${String(i).padStart(2, '0')}`;
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      newTeams.push({ team_id: teamId, pin_hash: pin, display_name: teamId, status: 'active' });
    }
    await supabase.from('teams').insert(newTeams);
    fetchAll();
    setStatus(`${bulkCount} teams generated!`);
  };

  const exportTeams = () => {
    const csv = 'Team ID,PIN\n' + teams.map(t => `${t.team_id},${t.pin_hash}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'teams.csv'; a.click();
  };

  const deleteAllTeams = async () => {
    if (!confirm('DELETE ALL TEAMS? This cannot be undone!')) return;
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    fetchAll();
    setStatus('All teams deleted');
  };

  const tabStyle = (t: string) => ({
    padding: '0.75rem 1.5rem', cursor: 'pointer', border: 'none', borderRadius: '4px 4px 0 0',
    backgroundColor: tab === t ? 'var(--bg-secondary)' : 'transparent',
    color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontWeight: tab === t ? 'bold' as const : 'normal' as const, fontSize: '1rem'
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: 'var(--accent-primary)' }}>🛡️ Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {status && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>{status}</span>}
          <button onClick={() => { logout(); navigate('/'); }} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)' }}>
        <button style={tabStyle('rounds')} onClick={() => setTab('rounds')}>Rounds</button>
        <button style={tabStyle('questions')} onClick={() => setTab('questions')}>Questions</button>
        <button style={tabStyle('teams')} onClick={() => setTab('teams')}>Teams</button>
      </div>

      <div className="card" style={{ borderRadius: '0 4px 4px 4px', minHeight: '500px' }}>

        {/* ========== ROUNDS TAB ========== */}
        {tab === 'rounds' && (
          <div>
            <h2>Manage Rounds</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <input className="input-field" placeholder="Round Name (e.g. Easy)" value={newRound.name} onChange={e => setNewRound({ ...newRound, name: e.target.value })} style={{ flex: 1 }} />
              <input className="input-field" type="number" placeholder="Duration (sec)" value={newRound.duration} onChange={e => setNewRound({ ...newRound, duration: parseInt(e.target.value) })} style={{ width: '150px' }} />
              <button className="btn" onClick={addRound} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Plus size={16} /> Add Round</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>#</th><th>Name</th><th>Duration</th><th>Status</th><th>Scores</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {rounds.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{r.round_number}</td>
                    <td>{r.name}</td>
                    <td>{Math.floor(r.duration_seconds / 60)} min</td>
                    <td><span style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', backgroundColor: r.status === 'active' ? 'rgba(0,204,136,0.2)' : r.status === 'ended' ? 'rgba(255,76,76,0.2)' : 'rgba(255,184,77,0.2)', color: r.status === 'active' ? 'var(--success)' : r.status === 'ended' ? 'var(--error)' : 'var(--warning)' }}>{r.status.toUpperCase()}</span></td>
                    <td>{r.scores_revealed ? '✅ Revealed' : '🔒 Hidden'}</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn" onClick={() => toggleRound(r.id, r.status)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', backgroundColor: r.status === 'active' ? 'var(--error)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {r.status === 'active' ? <><Square size={14} /> Stop</> : <><Play size={14} /> Start</>}
                      </button>
                      {r.status === 'ended' && !r.scores_revealed && (
                        <button className="btn" onClick={() => revealScores(r.id)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Eye size={14} /> Reveal</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rounds.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No rounds yet. Add one above.</p>}
          </div>
        )}

        {/* ========== QUESTIONS TAB ========== */}
        {tab === 'questions' && (
          <div>
            <h2>Add Question</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <select className="input-field" value={newQ.round_id} onChange={e => setNewQ({ ...newQ, round_id: e.target.value })}>
                  <option value="">Select Round</option>
                  {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select className="input-field" value={newQ.language} onChange={e => setNewQ({ ...newQ, language: e.target.value })}>
                  <option value="python">Python</option><option value="javascript">JavaScript</option>
                  <option value="java">Java</option><option value="c">C</option><option value="cpp">C++</option>
                </select>
                <input className="input-field" placeholder="Marks" type="number" value={newQ.marks} onChange={e => setNewQ({ ...newQ, marks: parseInt(e.target.value) })} style={{ width: '100px' }} />
              </div>
              <input className="input-field" placeholder="Question Title (e.g. Fix the Sorting)" value={newQ.title} onChange={e => setNewQ({ ...newQ, title: e.target.value })} />
              <textarea className="input-field" placeholder="Paste Buggy Code Here" rows={8} value={newQ.buggy_code} onChange={e => setNewQ({ ...newQ, buggy_code: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '0.9rem' }} />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input className="input-field" placeholder='Editable Lines JSON e.g. [[3,5],[8,10]]' value={newQ.editable_lines} onChange={e => setNewQ({ ...newQ, editable_lines: e.target.value })} style={{ flex: 1 }} />
              </div>
              <textarea className="input-field" placeholder="Expected Output (exactly what correct code should print)" rows={3} value={newQ.expected_output} onChange={e => setNewQ({ ...newQ, expected_output: e.target.value })} style={{ fontFamily: 'monospace' }} />
              <button className="btn" onClick={addQuestion} style={{ alignSelf: 'flex-start' }}><Plus size={16} /> Add Question</button>
            </div>

            <h3>Existing Questions</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Title</th><th>Language</th><th>Marks</th><th>Round</th><th></th>
              </tr></thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>{q.title}</td>
                    <td>{q.language}</td>
                    <td>{q.marks}</td>
                    <td>{rounds.find(r => r.id === q.round_id)?.name || '—'}</td>
                    <td><button onClick={() => deleteQuestion(q.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--error)' }}><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ========== TEAMS TAB ========== */}
        {tab === 'teams' && (
          <div>
            <h2>Generate Teams</h2>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Prefix</label>
                <input className="input-field" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} style={{ width: '100px' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Count</label>
                <input className="input-field" type="number" value={bulkCount} onChange={e => setBulkCount(parseInt(e.target.value))} style={{ width: '100px' }} />
              </div>
              <button className="btn" onClick={generateTeams} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={16} /> Generate</button>
              <button className="btn" onClick={exportTeams} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#3b82f6' }}><Download size={16} /> Export CSV</button>
              <button className="btn" onClick={deleteAllTeams} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--error)' }}><Trash2 size={16} /> Delete All</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Team ID</th><th>PIN</th><th>Display Name</th><th>Status</th>
              </tr></thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{t.team_id}</td>
                    <td style={{ fontFamily: 'monospace' }}>{t.pin_hash}</td>
                    <td>{t.display_name}</td>
                    <td><span style={{ color: t.status === 'active' ? 'var(--success)' : 'var(--error)' }}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teams.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No teams yet. Generate them above.</p>}
          </div>
        )}
      </div>
    </div>
  );
};
