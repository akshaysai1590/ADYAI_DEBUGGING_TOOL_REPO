import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { api, setAdminSecret } from '../lib/api';

export const AdminLogin = () => {
  const navigate = useNavigate();
  const setAdminLogin = useAuthStore(s => s.setAdminLogin);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setAdminSecret(password);
    try {
      await api.admin({ action: 'ping' });
      setAdminLogin('admin-token');
      navigate('/admin');
    } catch {
      setAdminSecret(null);
      setError('Wrong password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Shield size={48} color="var(--accent-primary)" />
          <h1 style={{ margin: '1rem 0 0' }}>Admin Panel</h1>
        </div>
        {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="password" className="input-field" placeholder="Admin Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="btn" disabled={loading}>{loading ? 'Verifying...' : 'Enter Admin Dashboard'}</button>
        </form>
      </div>
    </div>
  );
};
