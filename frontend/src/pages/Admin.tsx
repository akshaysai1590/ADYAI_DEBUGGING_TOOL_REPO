import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import {
  Play, Square, Eye, Users, Trash2, LogOut,
  Download, ChevronDown, ChevronUp,
  Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  UserPlus, Layers, Shield, Plus, Activity
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const isTeamOnline = (team: any) => {
  if (!team.last_seen_at) return false;
  const lastSeen = new Date(team.last_seen_at).getTime();
  const now = Date.now();
  const diff = Math.abs(now - lastSeen) / 1000;
  return diff <= 90 && team.current_page && team.current_page !== 'offline';
};

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
};

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(255,184,77,0.15)', color: '#FFB84D', label: 'PENDING' },
    active:  { bg: 'rgba(0,204,136,0.15)',  color: '#00CC88', label: '● LIVE'  },
    ended:   { bg: 'rgba(255,76,76,0.15)',   color: '#FF4C4C', label: 'ENDED'   },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem',
      fontWeight: 700, letterSpacing: '0.5px',
      backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap'
    }}>
      {s.label}
    </span>
  );
};

// ─── Toast ───────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        padding: '0.75rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500,
        backgroundColor: t.type === 'success' ? '#00CC88' : t.type === 'error' ? '#FF4C4C' : '#6C63FF',
        color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        animation: 'slideIn 0.25s ease',
        maxWidth: '320px'
      }}>
        {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✗ ' : 'ℹ '}{t.msg}
      </div>
    ))}
  </div>
);

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmProps { msg: string; onConfirm: () => void; onCancel: () => void }
const ConfirmModal = ({ msg, onConfirm, onCancel }: ConfirmProps) => (
  <div style={{
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998
  }}>
    <div className="card" style={{ maxWidth: '400px', width: '90%', padding: '2rem', textAlign: 'center' }}>
      <AlertTriangle size={40} color="#FFB84D" style={{ marginBottom: '1rem' }} />
      <p style={{ marginBottom: '1.5rem', fontSize: '1rem', lineHeight: 1.6 }}>{msg}</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={onCancel} style={{
          padding: '0.6rem 1.5rem', borderRadius: '6px', border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer'
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          padding: '0.6rem 1.5rem', borderRadius: '6px', border: 'none',
          background: '#FF4C4C', color: '#fff', cursor: 'pointer', fontWeight: 600
        }}>Confirm</button>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuthStore();
  const [tab, setTab] = useState<'rounds' | 'questions' | 'teams' | 'monitor' | 'scoreboard'>('rounds');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<{ msg: string; cb: () => void } | null>(null);
  const toastId = useRef(0);
  const lastGeneratedRef = useRef<{ team_id: string; pin: string; display_name: string }[]>([]);

  // Data
  const [rounds, setRounds]     = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [teams, setTeams]       = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Rounds form
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [newRound, setNewRound] = useState({ name: '', duration: 1800 });

  // Questions form
  const [newQ, setNewQ] = useState({
    round_id: '', language: 'python', title: '',
    buggy_code: '', editable_lines: '[[3,5]]', expected_output: '', marks: 10
  });

  // Teams form
  const [bulkCount, setBulkCount]   = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState('DBG');
  const [singleTeam, setSingleTeam] = useState({ team_id: '', pin: '', display_name: '' });
  const [loadingOp, setLoadingOp]   = useState<string | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const toast = (msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) { navigate('/admin/login'); return; }
    fetchAll();
    const timer = setInterval(fetchAll, 10000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  // ── Fetch all data (server-side via the admin function) ──────────────────
  const fetchAll = async () => {
    try {
      const data = await api.admin({ action: 'list' });
      if (data.rounds) setRounds(data.rounds);
      if (data.questions) setQuestions(data.questions);
      if (data.teams) setTeams(data.teams);
      if (data.violations) setViolations(data.violations);
      if (data.submissions) setSubmissions(data.submissions);
    } catch (e) {
      console.error('Admin list error:', e);
    }
  };

  // ── Ask confirm ───────────────────────────────────────────────────────────
  const askConfirm = (msg: string, cb: () => void) => setConfirm({ msg, cb });

  // ══════════════════════════════════════════════════════════════════════════
  //  ROUNDS
  // ══════════════════════════════════════════════════════════════════════════

  const addRound = async () => {
    if (!newRound.name.trim()) { toast('Round name is required', 'error'); return; }
    setLoadingOp('addRound');
    try {
      const res = await api.admin({ action: 'add_round', payload: { name: newRound.name.trim(), duration: newRound.duration } });
      if (res.round) setRounds(prev => [...prev, res.round].sort((a, b) => a.round_number - b.round_number));
      setNewRound({ name: '', duration: 1800 });
      toast(`Round "${newRound.name}" added!`);
    } catch (e: any) {
      toast('Failed to add round: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const deleteRound = async (id: string, name: string) => {
    askConfirm(
      `Delete round "${name}"? All its questions and submissions will be permanently removed.`,
      async () => {
        setLoadingOp('delRound-' + id);
        try {
          await api.admin({ action: 'delete_round', payload: { id } });
          setRounds(prev => prev.filter(r => r.id !== id));
          toast(`Round "${name}" deleted.`);
        } catch (e: any) {
          toast('Failed to delete: ' + (e?.message || 'error'), 'error');
        } finally {
          setLoadingOp(null);
          setConfirm(null);
        }
      }
    );
  };

  const startRound = async (id: string, name: string) => {
    setLoadingOp('toggle-' + id);
    try {
      await api.admin({ action: 'start_round', payload: { id } });
      setRounds(prev => prev.map(r => r.id === id ? { ...r, status: 'active' } : { ...r, status: r.status === 'active' ? 'ended' : r.status }));
      toast(`🟢 "${name}" is now LIVE!`);
    } catch (e: any) {
      toast('Failed to start: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const stopRound = async (id: string, name: string) => {
    setLoadingOp('toggle-' + id);
    try {
      await api.admin({ action: 'stop_round', payload: { id } });
      setRounds(prev => prev.map(r => r.id === id ? { ...r, status: 'ended' } : r));
      toast(`🔴 "${name}" ended.`);
    } catch (e: any) {
      toast('Failed to end: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const revealScores = async (id: string) => {
    try {
      await api.admin({ action: 'reveal_scores', payload: { id } });
      setRounds(prev => prev.map(r => r.id === id ? { ...r, scores_revealed: true } : r));
      toast('Scores revealed to participants!');
    } catch (e: any) {
      toast('Failed: ' + (e?.message || 'error'), 'error');
    }
  };

  const resetRound = async (id: string, name: string) => {
    askConfirm(
      `Reset round "${name}" back to PENDING? (Does not delete questions or submissions)`,
      async () => {
        try {
          await api.admin({ action: 'reset_round', payload: { id } });
          setRounds(prev => prev.map(r => r.id === id ? { ...r, status: 'pending', scores_revealed: false } : r));
          toast(`Round reset to pending.`, 'info');
        } catch (e: any) {
          toast('Failed: ' + (e?.message || 'error'), 'error');
        } finally {
          setConfirm(null);
        }
      }
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  QUESTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const addQuestion = async () => {
    if (!newQ.round_id) { toast('Select a round first', 'error'); return; }
    if (!newQ.title.trim()) { toast('Title is required', 'error'); return; }
    if (!newQ.buggy_code.trim()) { toast('Buggy code is required', 'error'); return; }
    if (!newQ.expected_output.trim()) { toast('Expected output is required', 'error'); return; }

    setLoadingOp('addQ');
    try {
      const res = await api.admin({
        action: 'add_question',
        payload: {
          round_id: newQ.round_id,
          language: newQ.language,
          title: newQ.title.trim(),
          buggy_code: newQ.buggy_code,
          editable_line_ranges: newQ.editable_lines,
          marks: newQ.marks,
          expected_output: newQ.expected_output,
        },
      });
      if (res.question) setQuestions(prev => [...prev, res.question].sort((a, b) => a.display_order - b.display_order));
      setNewQ({ ...newQ, title: '', buggy_code: '', editable_lines: '[[3,5]]', expected_output: '', marks: 10 });
      toast('Question + hidden answer saved!');
    } catch (e: any) {
      toast('Error: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const deleteQuestion = async (id: string, title: string) => {
    askConfirm(`Delete question "${title}"?`, async () => {
      try {
        await api.admin({ action: 'delete_question', payload: { id } });
        setQuestions(prev => prev.filter(q => q.id !== id));
        toast(`Question deleted.`);
      } catch (e: any) {
        toast('Failed: ' + (e?.message || 'error'), 'error');
      } finally {
        setConfirm(null);
      }
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  TEAMS
  // ══════════════════════════════════════════════════════════════════════════

  const downloadCsv = (rows: { team_id: string; pin?: string; display_name: string }[], filename: string) => {
    const withPin = rows.some(r => typeof r.pin === 'string');
    const header = withPin ? 'Team ID,PIN,Display Name' : 'Team ID,Display Name';
    const lines = rows.map(r => withPin ? `${r.team_id},${r.pin},${r.display_name}` : `${r.team_id},${r.display_name}`);
    const csv = header + '\n' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const addSingleTeam = async () => {
    if (!singleTeam.team_id.trim() || !singleTeam.pin.trim()) {
      toast('Team ID and PIN are required', 'error'); return;
    }
    setLoadingOp('addTeam');
    try {
      const res = await api.admin({ action: 'add_team', payload: { team_id: singleTeam.team_id, pin: singleTeam.pin, display_name: singleTeam.display_name } });
      setSingleTeam({ team_id: '', pin: '', display_name: '' });
      toast(`Team ${res.team.team_id} added — PIN ${res.team.pin}`);
      fetchAll();
    } catch (e: any) {
      toast('Error: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const generateTeams = async () => {
    if (bulkCount < 1 || bulkCount > 200) { toast('Count must be between 1 and 200', 'error'); return; }
    setLoadingOp('bulk');
    try {
      const res = await api.admin({ action: 'generate_teams', payload: { prefix: bulkPrefix, count: bulkCount } });
      if (res.teams?.length) {
        lastGeneratedRef.current = res.teams;
        downloadCsv(res.teams, `adhyant-teams-${Date.now()}.csv`);
        toast(`${res.teams.length} teams generated — CSV downloaded!`);
      }
      fetchAll();
    } catch (e: any) {
      toast('Error generating: ' + (e?.message || 'error'), 'error');
    } finally {
      setLoadingOp(null);
    }
  };

  const exportTeams = () => {
    if (lastGeneratedRef.current.length > 0) {
      downloadCsv(lastGeneratedRef.current, `adhyant-teams-${Date.now()}.csv`);
      toast('CSV downloaded!');
    } else {
      downloadCsv(teams.map(t => ({ team_id: t.team_id, display_name: t.display_name })), `adhyant-teams-${Date.now()}.csv`);
      toast('CSV downloaded (PINs are only shown right after generation).', 'info');
    }
  };

  const deleteTeam = async (id: string, teamId: string) => {
    askConfirm(`Delete team "${teamId}"? This cannot be undone.`, async () => {
      try {
        await api.admin({ action: 'delete_team', payload: { id } });
        setTeams(prev => prev.filter(t => t.id !== id));
        toast(`Team ${teamId} deleted.`);
      } catch (e: any) {
        toast('Failed: ' + (e?.message || 'error'), 'error');
      } finally {
        setConfirm(null);
      }
    });
  };

  const deleteAllTeams = async () => {
    askConfirm(
      `DELETE ALL ${teams.length} TEAMS? This is permanent and cannot be undone!`,
      async () => {
        setLoadingOp('delAll');
        try {
          await api.admin({ action: 'delete_all_teams' });
          setTeams([]);
          lastGeneratedRef.current = [];
          toast('All teams deleted.', 'info');
        } catch (e: any) {
          toast('Failed: ' + (e?.message || 'error'), 'error');
        } finally {
          setLoadingOp(null);
          setConfirm(null);
        }
      }
    );
  };

  const disqualifyTeam = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disqualified' : 'active';
    try {
      await api.admin({ action: 'toggle_disqualify', payload: { id, status: currentStatus } });
      setTeams(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      toast(newStatus === 'disqualified' ? 'Team disqualified.' : 'Team reinstated.', 'info');
    } catch (e: any) {
      toast('Failed: ' + (e?.message || 'error'), 'error');
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '0.7rem 1.5rem', cursor: 'pointer', border: 'none',
    borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
    fontWeight: tab === t ? 700 : 400, fontSize: '0.95rem',
    transition: 'all 0.2s',
  });

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '0.65rem 0.85rem',
    borderRadius: '6px', fontSize: '0.9rem', width: '100%',
  };

  const roundsForTab = rounds;
  const teamsCount = teams.length;
  const activeRound = rounds.find(r => r.status === 'active');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'auto' }}>
      {/* CSS */}
      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(30px) } to { opacity:1; transform:translateX(0) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        .row-hover:hover { background-color: rgba(108,99,255,0.05) !important; }
        .icon-btn { background:transparent; border:none; cursor:pointer; padding:0.35rem; border-radius:4px; display:flex; align-items:center; transition:background 0.15s; }
        .icon-btn:hover { background: rgba(255,255,255,0.08); }
        select.input-field option { background: #2D2D2D; }
      `}</style>

      <ToastContainer toasts={toasts} />
      {confirm && <ConfirmModal msg={confirm.msg} onConfirm={confirm.cb} onCancel={() => setConfirm(null)} />}

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={22} color="var(--accent-primary)" />
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Adhyant Admin
          </span>
          {activeRound && (
            <span style={{
              backgroundColor: 'rgba(0,204,136,0.15)', color: '#00CC88',
              padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.75rem',
              fontWeight: 700, animation: 'pulse 2s infinite'
            }}>
              ● {activeRound.name} LIVE
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Refresh indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#00CC88' }}>
            <RefreshCw size={14} /> Auto-refresh 10s
          </div>

          <button onClick={fetchAll} title="Refresh" className="icon-btn" style={{ color: 'var(--text-secondary)' }}>
            <RefreshCw size={16} />
          </button>

          <button onClick={() => { logout(); navigate('/'); }} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '0.4rem 0.85rem',
            borderRadius: '6px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem'
          }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ── STAT BAR ────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px', backgroundColor: 'var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Total Rounds',    value: rounds.length,                          icon: <Layers size={18} color="#6C63FF" /> },
          { label: 'Active Round',    value: activeRound?.name ?? '—',               icon: <Play size={18} color="#00CC88" /> },
          { label: 'Total Questions', value: questions.length,                        icon: <CheckCircle2 size={18} color="#FFB84D" /> },
          { label: 'Teams',           value: teamsCount,                              icon: <Users size={18} color="#6C63FF" /> },
        ].map(stat => (
          <div key={stat.label} style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            {stat.icon}
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', paddingLeft: '1.5rem', overflowX: 'auto' }}>
        <button style={tabStyle('rounds')} onClick={() => setTab('rounds')}>Rounds ({rounds.length})</button>
        <button style={tabStyle('questions')} onClick={() => setTab('questions')}>Questions ({questions.length})</button>
        <button style={tabStyle('teams')} onClick={() => setTab('teams')}>Teams ({teamsCount})</button>
        <button style={tabStyle('monitor')} onClick={() => setTab('monitor')}>Live Monitor</button>
        <button style={tabStyle('scoreboard')} onClick={() => setTab('scoreboard')}>Scoreboard</button>
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────────── */}
      <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

        {/* ═══════════════ ROUNDS TAB ═══════════════ */}
        {tab === 'rounds' && (
          <div>

            {/* Add Round form */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Add New Round
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px auto', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={labelStyle}>Round Name</label>
                  <input style={inputStyle} placeholder="e.g. Round 1 — Easy" value={newRound.name} onChange={e => setNewRound({ ...newRound, name: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Duration (seconds)</label>
                  <input style={inputStyle} type="number" min={60} step={60} value={newRound.duration} onChange={e => setNewRound({ ...newRound, duration: parseInt(e.target.value) || 1800 })} />
                </div>
                <button onClick={addRound} disabled={loadingOp === 'addRound'} style={actionBtn('var(--accent-primary)')}>
                  <Plus size={15} /> Add Round
                </button>
              </div>
            </div>

            {/* Rounds list */}
            {roundsForTab.length === 0 ? (
              <EmptyState icon={<Layers size={48} />} msg="No rounds yet — add your first round above." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {roundsForTab.map(r => {
                  const qCount = questions.filter(q => q.round_id === r.id).length;
                  const isExpanded = expandedRound === r.id;
                  const isLoading = loadingOp === 'toggle-' + r.id || loadingOp === 'delRound-' + r.id;
                  return (
                    <div key={r.id} style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: `1px solid ${r.status === 'active' ? 'rgba(0,204,136,0.4)' : 'var(--border)'}`,
                      borderRadius: '10px', overflow: 'hidden',
                      boxShadow: r.status === 'active' ? '0 0 20px rgba(0,204,136,0.1)' : 'none',
                    }}>
                      {/* Round header row */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: '36px 1fr 100px 120px 130px auto',
                        alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                      }}>
                        {/* Round # */}
                        <span style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          backgroundColor: 'var(--bg-tertiary)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)'
                        }}>{r.round_number}</span>

                        {/* Name & meta */}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                            {fmtDuration(r.duration_seconds)} · {qCount} question{qCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {/* Status badge */}
                        {statusBadge(r.status)}

                        {/* Scores */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {r.scores_revealed
                            ? <span style={{ color: '#00CC88' }}>✓ Scores revealed</span>
                            : <span>Scores hidden</span>}
                        </div>

                        {/* Primary action */}
                        <div>
                          {r.status === 'pending' && (
                            <button onClick={() => startRound(r.id, r.name)} disabled={isLoading} style={actionBtn('#00CC88')}>
                              <Play size={14} /> Start Round
                            </button>
                          )}
                          {r.status === 'active' && (
                            <button onClick={() => stopRound(r.id, r.name)} disabled={isLoading} style={actionBtn('#FF4C4C')}>
                              <Square size={14} /> End Round
                            </button>
                          )}
                          {r.status === 'ended' && !r.scores_revealed && (
                            <button onClick={() => revealScores(r.id)} style={actionBtn('#FFB84D')}>
                              <Eye size={14} /> Reveal Scores
                            </button>
                          )}
                          {r.status === 'ended' && r.scores_revealed && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completed</span>
                          )}
                        </div>

                        {/* More actions */}
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          <button
                            className="icon-btn"
                            title="Expand questions"
                            onClick={() => setExpandedRound(isExpanded ? null : r.id)}
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          {r.status === 'ended' && (
                            <button className="icon-btn" title="Reset to pending" onClick={() => resetRound(r.id, r.name)} style={{ color: '#FFB84D' }}>
                              <RefreshCw size={15} />
                            </button>
                          )}
                          <button className="icon-btn" title="Delete round" onClick={() => deleteRound(r.id, r.name)} style={{ color: '#FF4C4C' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: questions for this round */}
                      {isExpanded && (
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          backgroundColor: 'var(--bg-primary)',
                          padding: '1rem 1.25rem',
                        }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Questions in this round
                          </div>
                          {questions.filter(q => q.round_id === r.id).length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                              No questions yet. Go to the Questions tab to add some.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {questions.filter(q => q.round_id === r.id).map(q => (
                                <div key={q.id} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-secondary)',
                                  borderRadius: '6px', border: '1px solid var(--border)'
                                }}>
                                  <span style={{ fontWeight: 500 }}>{q.title}</span>
                                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{q.language}</span>
                                    <span>{q.marks} pts</span>
                                    <button className="icon-btn" onClick={() => deleteQuestion(q.id, q.title)} style={{ color: '#FF4C4C' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ QUESTIONS TAB ═══════════════ */}
        {tab === 'questions' && (
          <div>

            {/* Add Question form */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={16} /> Add Question
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Round</label>
                  <select style={inputStyle} value={newQ.round_id} onChange={e => setNewQ({ ...newQ, round_id: e.target.value })}>
                    <option value="">Select round…</option>
                    {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Language</label>
                  <select style={inputStyle} value={newQ.language} onChange={e => setNewQ({ ...newQ, language: e.target.value })}>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Title</label>
                  <input style={inputStyle} placeholder="e.g. 1. Buggy Greeting" value={newQ.title} onChange={e => setNewQ({ ...newQ, title: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Marks</label>
                    <input style={inputStyle} type="number" min={1} value={newQ.marks} onChange={e => setNewQ({ ...newQ, marks: parseInt(e.target.value) || 10 })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Editable Lines (JSON)</label>
                    <input style={inputStyle} placeholder="[[3,5]]" value={newQ.editable_lines} onChange={e => setNewQ({ ...newQ, editable_lines: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Buggy Code</label>
                  <textarea style={{ ...inputStyle, minHeight: '120px', fontFamily: 'monospace', resize: 'vertical' }} value={newQ.buggy_code} onChange={e => setNewQ({ ...newQ, buggy_code: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Expected Output (hidden)</label>
                  <textarea style={{ ...inputStyle, minHeight: '120px', fontFamily: 'monospace', resize: 'vertical' }} value={newQ.expected_output} onChange={e => setNewQ({ ...newQ, expected_output: e.target.value })} />
                </div>
              </div>
              <button onClick={addQuestion} disabled={loadingOp === 'addQ'} style={{ marginTop: '0.75rem', ...actionBtn('var(--accent-primary)') }}>
                <Plus size={15} /> Add Question
              </button>
            </div>

            {/* Questions table grouped by round */}
            {questions.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={48} />} msg="No questions yet — add one above." />
            ) : (
              rounds.map(r => {
                const rqs = questions.filter(q => q.round_id === r.id);
                if (rqs.length === 0) return null;
                return (
                  <div key={r.id} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      {statusBadge(r.status)}
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({rqs.length} question{rqs.length > 1 ? 's' : ''})</span>
                    </div>
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                            {['Title', 'Language', 'Marks', 'Editable Lines', ''].map(h => (
                              <th key={h} style={{ padding: '0.6rem 0.9rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rqs.map(q => (
                            <tr key={q.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.75rem 0.9rem', fontWeight: 500 }}>{q.title}</td>
                              <td style={{ padding: '0.75rem 0.9rem' }}>
                                <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace' }}>{q.language}</span>
                              </td>
                              <td style={{ padding: '0.75rem 0.9rem', color: 'var(--text-secondary)' }}>{q.marks}</td>
                              <td style={{ padding: '0.75rem 0.9rem', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{JSON.stringify(q.editable_line_ranges)}</td>
                              <td style={{ padding: '0.75rem 0.9rem' }}>
                                <button className="icon-btn" onClick={() => deleteQuestion(q.id, q.title)} style={{ color: '#FF4C4C' }}>
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══════════════ TEAMS TAB ═══════════════ */}
        {tab === 'teams' && (
          <div>
            {/* Two-column forms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

              {/* Single team add */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={16} /> Add Single Team
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <label style={labelStyle}>Team ID</label>
                    <input style={inputStyle} placeholder="e.g. DBG42" value={singleTeam.team_id} onChange={e => setSingleTeam({ ...singleTeam, team_id: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>PIN</label>
                    <input style={inputStyle} placeholder="4-digit PIN" value={singleTeam.pin} onChange={e => setSingleTeam({ ...singleTeam, pin: e.target.value })} maxLength={4} />
                  </div>
                  <div>
                    <label style={labelStyle}>Display Name (optional)</label>
                    <input style={inputStyle} placeholder="Team Alpha" value={singleTeam.display_name} onChange={e => setSingleTeam({ ...singleTeam, display_name: e.target.value })} />
                  </div>
                  <button onClick={addSingleTeam} disabled={loadingOp === 'addTeam'} style={{
                    marginTop: '0.25rem', padding: '0.65rem', borderRadius: '6px', border: 'none',
                    backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    opacity: loadingOp === 'addTeam' ? 0.6 : 1,
                  }}>
                    <Plus size={16} /> Add Team
                  </button>
                </div>
              </div>

              {/* Bulk generate */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={16} /> Bulk Generate Teams
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <label style={labelStyle}>Prefix</label>
                    <input style={inputStyle} value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} placeholder="DBG" />
                  </div>
                  <div>
                    <label style={labelStyle}>Count (1–200)</label>
                    <input style={inputStyle} type="number" value={bulkCount} min={1} max={200} onChange={e => setBulkCount(parseInt(e.target.value) || 1)} />
                  </div>
                  <div style={{ padding: '0.6rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Preview: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bulkPrefix.toUpperCase()}01</strong> … <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bulkPrefix.toUpperCase()}{String(bulkCount).padStart(2, '0')}</strong> with random PINs
                  </div>
                  <button onClick={generateTeams} disabled={loadingOp === 'bulk'} style={{
                    padding: '0.65rem', borderRadius: '6px', border: 'none',
                    backgroundColor: '#3b82f6', color: '#fff', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    opacity: loadingOp === 'bulk' ? 0.6 : 1,
                  }}>
                    <Users size={16} /> Generate {bulkCount} Teams
                  </button>
                </div>
              </div>
            </div>

            {/* Actions bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{teamsCount} team{teamsCount !== 1 ? 's' : ''} registered</span>
              <div style={{ flex: 1 }} />
              <button onClick={exportTeams} disabled={teamsCount === 0} style={{
                padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem',
                opacity: teamsCount === 0 ? 0.4 : 1,
              }}>
                <Download size={14} /> Export CSV
              </button>
              <button onClick={deleteAllTeams} disabled={teamsCount === 0 || loadingOp === 'delAll'} style={{
                padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #FF4C4C',
                background: 'transparent', color: '#FF4C4C', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem',
                opacity: teamsCount === 0 ? 0.4 : 1,
              }}>
                <Trash2 size={14} /> Delete All
              </button>
            </div>

            {/* Teams table */}
            {teams.length === 0 ? (
              <EmptyState icon={<Users size={48} />} msg="No teams yet — add or generate some above." />
            ) : (
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      {['Team ID', 'PIN', 'Display Name', 'Status', ''].map(h => (
                        <th key={h} style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => (
                      <tr key={t.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.5px' }}>
                          <span style={{
                            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                            backgroundColor: isTeamOnline(t) ? '#00CC88' : '#333333',
                            marginRight: '8px'
                          }} title={isTeamOnline(t) ? 'Online' : 'Offline'} />
                          {t.team_id}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>••••</td>
                        <td style={{ padding: '0.7rem 1rem' }}>{t.display_name}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                            backgroundColor: t.status === 'active' ? 'rgba(0,204,136,0.15)' : 'rgba(255,76,76,0.15)',
                            color: t.status === 'active' ? '#00CC88' : '#FF4C4C'
                          }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="icon-btn" title={t.status === 'active' ? 'Disqualify' : 'Reinstate'}
                              onClick={() => disqualifyTeam(t.id, t.status)}
                              style={{ color: t.status === 'active' ? '#FFB84D' : '#00CC88' }}>
                              {t.status === 'active' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                            </button>
                            <button className="icon-btn" title="Delete team" onClick={() => deleteTeam(t.id, t.team_id)} style={{ color: '#FF4C4C' }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ MONITOR TAB ═══════════════ */}
        {tab === 'monitor' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Online Teams</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#00CC88' }}>
                  {teams.filter(isTeamOnline).length} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 400 }}>/ {teams.length}</span>
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Violations</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFB84D' }}>
                  {violations.length}
                </div>
              </div>
            </div>

            {teams.length === 0 ? (
              <EmptyState icon={<Activity size={48} />} msg="No teams to monitor." />
            ) : (
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Team</th>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Page</th>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Language</th>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Violations</th>
                      <th style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Submissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => {
                      const online = isTeamOnline(t);
                      const teamViolations = violations.filter(v => v.team_id === t.id).length;
                      
                      return (
                        <tr key={t.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.7rem 1rem', fontWeight: 600 }}>{t.display_name}</td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            <span style={{
                              padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                              backgroundColor: online ? 'rgba(0,204,136,0.15)' : 'rgba(255,255,255,0.05)',
                              color: online ? '#00CC88' : 'var(--text-secondary)'
                            }}>
                              {online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}>{t.current_page || '-'}</td>
                          <td style={{ padding: '0.7rem 1rem', fontSize: '0.85rem' }}>{t.selected_language || '-'}</td>
                          <td style={{ padding: '0.7rem 1rem' }}>
                            {teamViolations > 0 ? (
                              <span style={{ color: '#FFB84D', fontWeight: 600 }}>{teamViolations}</span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)' }}>0</span>
                            )}
                          </td>
                          <td style={{ padding: '0.7rem 1rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {!activeRound ? (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No active round</span>
                            ) : (
                              questions.filter(q => q.round_id === activeRound.id).map(q => {
                                const sub = submissions.find(s => s.team_id === t.id && s.question_id === q.id);
                                let icon = <span key={q.id} title={q.title} style={{ color: 'var(--border)' }}>⚪</span>;
                                if (sub) {
                                  if (sub.is_correct) icon = <span key={q.id} title={`${q.title}: Correct`} style={{ color: '#00CC88' }}>✅</span>;
                                  else icon = <span key={q.id} title={`${q.title}: Attempted (${sub.run_attempt_count} runs)`} style={{ color: '#FFB84D' }}>🏃</span>;
                                }
                                return icon;
                              })
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SCOREBOARD TAB ═══════════════ */}
        {tab === 'scoreboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                🏆 Live Standings
              </h2>
            </div>
            {teams.length === 0 ? (
              <EmptyState icon={<Layers size={48} />} msg="No teams to rank." />
            ) : (
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Rank</th>
                      <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Team</th>
                      <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Score</th>
                      <th style={{ padding: '0.8rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Correct Subs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...teams]
                      .map(t => {
                        const teamSubs = submissions.filter(s => s.team_id === t.id && s.is_correct);
                        const score = teamSubs.reduce((acc, curr) => acc + (curr.marks_awarded || 0) + (curr.time_bonus || 0), 0);
                        return { ...t, score, correct: teamSubs.length };
                      })
                      .sort((a, b) => b.score - a.score || b.correct - a.correct)
                      .map((t, idx) => (
                        <tr key={t.id} className="row-hover" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, fontSize: '1.1rem', color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'var(--text-primary)' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>{t.display_name} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>({t.team_id})</span></td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{t.score}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--success)' }}>{t.correct}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Small shared components ───────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)',
  marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px'
};

const actionBtn = (bg: string): React.CSSProperties => ({
  padding: '0.45rem 0.9rem', borderRadius: '6px', border: 'none',
  backgroundColor: bg, color: bg === '#FFB84D' ? '#000' : '#fff',
  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap'
});

const EmptyState = ({ icon, msg }: { icon: React.ReactNode; msg: string }) => (
  <div style={{
    textAlign: 'center', padding: '3rem 1rem',
    color: 'var(--text-secondary)', opacity: 0.6
  }}>
    <div style={{ marginBottom: '0.75rem' }}>{icon}</div>
    <p style={{ margin: 0, fontSize: '0.95rem' }}>{msg}</p>
  </div>
);
