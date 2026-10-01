import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Code2, KeyRound, Users, UserCircle, Shield, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

export const Join = () => {
  const navigate = useNavigate();
  const { setTeamLogin, setSessionToken } = useAuthStore();
  
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
      const data = await api.join({
        team_id: teamId.trim().toUpperCase(),
        pin: pin.trim(),
        display_name: displayName.trim(),
      });
      setTeamLogin('team-session-token', data.teamId, data.displayName, data.teamDbId);
      setSessionToken(data.sessionToken);
      navigate('/lobby');
    } catch (err: any) {
      setError(err?.message || 'Failed to verify team credentials');
    } finally {
      setLoading(false);
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
