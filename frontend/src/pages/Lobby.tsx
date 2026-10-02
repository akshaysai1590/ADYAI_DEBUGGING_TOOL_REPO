import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { Clock, Users, PlayCircle, LogOut, ArrowRight, Trophy, AlertCircle } from 'lucide-react';

const HEARTBEAT_INTERVAL = 15_000; // 15 seconds
const TEAM_COUNT_INTERVAL = 10_000; // 10 seconds — the count must poll, not
// rely on realtime: anon clients cannot subscribe to the locked-down teams
// table, so a realtime-only count goes stale and reads as "not updating".

export const Lobby = () => {
  const navigate = useNavigate();
  const { teamId, teamDbId, displayName, sessionToken, logout } = useAuthStore();
  
  const [activeRound, setActiveRound] = useState<any>(null);
  const [connectedTeamsCount, setConnectedTeamsCount] = useState<number>(0);
  const [revealedRounds, setRevealedRounds] = useState<any[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teamId) {
      navigate('/join');
      return;
    }
    
    // Mark current page as lobby
    updatePresence('lobby');

    // Initial data fetch
    fetchLobbyState();

    // Start heartbeat (updates last_seen_at every 15s)
    heartbeatRef.current = setInterval(() => {
      updatePresence('lobby');
    }, HEARTBEAT_INTERVAL);

    // Poll the online-team count: realtime on `teams` is dead for anon
    // clients after the RLS lockdown, so without this the number freezes.
    const countInterval = setInterval(() => {
      fetchTeamCount();
    }, TEAM_COUNT_INTERVAL);

    // Set up realtime subscription for rounds (anon can still read rounds)
    const channel = supabase
      .channel('lobby-rounds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => {
        fetchLobbyState();
      })
      .subscribe();

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      clearInterval(countInterval);
      supabase.removeChannel(channel);
    };
  }, [teamId, navigate]);

  // ── Presence heartbeat ────────────────────────────────────────────────────
  const updatePresence = useCallback(async (page: string) => {
    if (!teamDbId || !sessionToken) return;
    try {
      await api.participant({
        action: 'heartbeat',
        team_id: teamDbId,
        session_token: sessionToken,
        current_page: page,
      });
    } catch (err) {
      console.error('Presence update error:', err);
    }
  }, [teamDbId, sessionToken]);

  // ── Fetch lobby data ────────────────────────────────────────────────────
  const fetchLobbyState = async () => {
    try {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .order('round_number', { ascending: true });

      if (rounds) {
        const live = rounds.find(r => r.status === 'active');
        setActiveRound(live || null);
        setRevealedRounds(rounds.filter(r => r.scores_revealed));
      }

      await fetchTeamCount();
    } catch (err) {
      console.error('Lobby fetch error:', err);
    }
  };

  const fetchTeamCount = async () => {
    try {
      const res = await api.participant({
        action: 'team_count',
        team_id: teamDbId,
        session_token: sessionToken,
      });
      if (typeof res.count === 'number') setConnectedTeamsCount(res.count);
    } catch (err) {
      console.error('Team count error:', err);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    // Clear presence on logout
    if (teamDbId && sessionToken) {
      api.participant({
        action: 'logout',
        team_id: teamDbId,
        session_token: sessionToken,
      }).catch(() => {});
    }
    logout();
    navigate('/join');
  };

  const handleEnterContest = () => {
    // Clear language choice so a fresh picker shows
    useAuthStore.getState().setSelectedLanguage('');
    navigate('/contest');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2.5rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--accent-primary)', fontWeight: 800 }}>Adhyant Debugging</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.95rem' }}>
            <Users size={16} /> Team: <strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong> 
            <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {teamId}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/scoreboard')} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            <Trophy size={16} /> Scoreboard
          </button>
          <button 
            onClick={handleLogout} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', flex: 1 }}>
        
        {/* Left: Active Contest Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          
          {activeRound ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.3s ease-in' }}>
              <div style={{ 
                width: '72px', height: '72px', borderRadius: '50%', 
                backgroundColor: 'rgba(0, 204, 136, 0.15)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.5rem',
                border: '2px solid var(--success)'
              }}>
                <PlayCircle size={40} color="var(--success)" />
              </div>
              <span style={{ 
                color: 'var(--success)', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '1.5px', 
                fontSize: '0.85rem',
                marginBottom: '0.5rem'
              }}>
                ● Round {activeRound.round_number} is LIVE!
              </span>
              <h2 style={{ fontSize: '2.4rem', margin: '0 0 1rem 0' }}>{activeRound.name}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '460px', marginBottom: '2.5rem' }}>
                The round has started! Enter the editor now. Anti-cheat protections are active.
              </p>
              
              <button 
                onClick={handleEnterContest} 
                className="btn" 
                style={{ 
                  backgroundColor: 'var(--success)', 
                  color: '#000', 
                  fontSize: '1.2rem', 
                  padding: '1rem 2.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  fontWeight: 800,
                  boxShadow: '0 0 24px rgba(0, 204, 136, 0.4)',
                  cursor: 'pointer'
                }}
              >
                Enter Debugging Sandbox <ArrowRight size={22} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Clock size={68} color="var(--accent-primary)" style={{ marginBottom: '1.5rem', opacity: 0.8 }} />
              <h2 style={{ fontSize: '2.2rem', margin: '0 0 1rem 0' }}>Waiting for Next Round</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '440px', lineHeight: '1.6' }}>
                The organizer is preparing the questions. Keep this window open — this screen will automatically update the moment the round goes live.
              </p>
              
              <div style={{ 
                marginTop: '2.5rem', 
                padding: '0.85rem 1.75rem', 
                backgroundColor: 'rgba(108, 99, 255, 0.1)', 
                border: '1px solid var(--accent-primary)',
                borderRadius: '8px',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.95rem'
              }}>
                <span className="spin" style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent' }} />
                <strong>Connected — listening for admin broadcast…</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right: Info / Scoreboard Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Users size={20} color="var(--accent-primary)"/> Live Participants
            </h3>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {connectedTeamsCount}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Teams online now (updates every 10s)</div>
          </div>
          
          <div className="card" style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Trophy size={20} color="var(--warning)"/> Round Results
            </h3>
            {revealedRounds.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                <p>No round scores have been revealed yet.</p>
                <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Organizers will reveal standings after each round concludes.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {revealedRounds.map(r => (
                  <div key={r.id} style={{ padding: '0.75rem', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{r.name}</span>
                    <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>Scores Revealed</span>
                  </div>
                ))}
                <button onClick={() => navigate('/scoreboard')} className="btn-outline" style={{ marginTop: '0.5rem', width: '100%', padding: '0.6rem' }}>
                  View Full Standings
                </button>
              </div>
            )}
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(255, 184, 77, 0.05)', border: '1px solid rgba(255, 184, 77, 0.2)' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
              <AlertCircle size={16} /> Contest Rules
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li>1 computer per team.</li>
              <li>Only modify lines inside the editable block.</li>
              <li>Switching tabs or exiting fullscreen is monitored.</li>
              <li>Final submission permanently locks the question.</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};
