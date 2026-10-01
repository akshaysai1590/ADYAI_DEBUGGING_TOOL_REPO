import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Code2, KeyRound, Users, UserCircle, Shield, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';

export const Join = () => {
  const navigate = useNavigate();
  const setTeamLogin = useAuthStore(state => state.setTeamLogin);
  
  const [teamId, setTeamId] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanTeamId = teamId.trim().toUpperCase();
      const cleanPin = pin.trim();

      // Check Supabase teams table
      const { data: team, error: dbError } = await supabase
        .from('teams')
        .select('*')
        .ilike('team_id', cleanTeamId)
        .maybeSingle();

      if (team && !dbError) {
        if (team.status === 'disqualified') {
          setError('This team has been disqualified.');
          setLoading(false);
          return;
        }

        if (team.pin_hash === cleanPin) {
          const finalName = displayName.trim() || team.display_name || cleanTeamId;
          
          // Optionally update display_name in DB if provided
          if (displayName.trim() && displayName.trim() !== team.display_name) {
            await supabase.from('teams').update({ display_name: finalName }).eq('id', team.id);
          }

          setTeamLogin('team-session-token', team.team_id, finalName, team.id);
          navigate('/lobby');
          return;
        } else {
          setError('Incorrect PIN for this Team ID.');
          setLoading(false);
          return;
        }
      }

      // Demo fallback if team is not in DB yet
      if (cleanPin === '1234') {
        setTeamLogin('demo-token', cleanTeamId, displayName.trim() || cleanTeamId, '33333333-3333-3333-3333-333333333333');
        navigate('/lobby');
        return;
      }

      setError('Team ID not found. Please check with the organizers or use PIN 1234 for demo.');
      setLoading(false);
    } catch (err: any) {
      console.error('Join error:', err);
      // Fallback
      if (pin.trim() === '1234') {
        setTeamLogin('demo-token', teamId.toUpperCase(), displayName || teamId, '33333333-3333-3333-3333-333333333333');
        navigate('/lobby');
      } else {
        setError(err.message || 'Failed to verify team credentials');
        setLoading(false);
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: '1rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', backgroundColor: 'rgba(108, 99, 255, 0.1)', marginBottom: '1rem' }}>
            <Code2 size={42} color="var(--accent-primary)" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Adhyant Debugging</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Enter your team credentials to participate
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(255, 76, 76, 0.12)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              <Users size={16} /> Team ID
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. DBG42 or DBG01" 
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              required
              style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              <KeyRound size={16} /> PIN
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="4-digit PIN" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              required
              maxLength={6}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              <UserCircle size={16} /> Display Name (Optional)
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Team Alpha" 
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
            {loading ? 'Verifying Credentials...' : 'Enter Contest Lobby'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <Link to="/scoreboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={14} /> Scoreboard
          </Link>
          <Link to="/admin/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Shield size={14} /> Admin Portal
          </Link>
        </div>
      </div>
    </div>
  );
};
