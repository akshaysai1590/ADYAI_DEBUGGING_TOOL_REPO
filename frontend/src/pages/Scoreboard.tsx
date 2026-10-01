import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowLeft, RefreshCw, Maximize2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TeamScore {
  team_id_str: string;
  display_name: string;
  score: number;
  solved_count: number;
  last_submission_time: string | null;
  status: string;
}

export const Scoreboard = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('overall');
  const [leaderboard, setLeaderboard] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchScores();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRound, autoRefresh]);

  const fetchScores = async () => {
    try {
      // 1. Fetch rounds
      const { data: roundData } = await supabase.from('rounds').select('*').order('round_number');
      if (roundData) setRounds(roundData);

      // 2. Fetch all teams
      const { data: teamsData } = await supabase.from('teams').select('*');
      if (!teamsData) return;

      // 3. Fetch submissions
      let subQuery = supabase.from('submissions').select('*, questions(round_id)');
      const { data: subData } = await subQuery;

      // 4. Calculate scores per team
      const scoresMap: Record<string, TeamScore> = {};

      teamsData.forEach(t => {
        scoresMap[t.id] = {
          team_id_str: t.team_id,
          display_name: t.display_name || t.team_id,
          score: 0,
          solved_count: 0,
          last_submission_time: null,
          status: t.status || 'active',
        };
      });

      if (subData) {
        subData.forEach(sub => {
          // If a specific round is selected, filter submissions for that round
          if (selectedRound !== 'overall') {
            const qRoundId = sub.questions?.round_id;
            if (qRoundId !== selectedRound) return;
          }

          if (scoresMap[sub.team_id]) {
            if (sub.is_correct) {
              scoresMap[sub.team_id].score += (sub.marks_awarded || 10);
              scoresMap[sub.team_id].solved_count += 1;

              // Track latest correct submission timestamp for tie breaking
              const currentSubTime = sub.submitted_at;
              if (
                !scoresMap[sub.team_id].last_submission_time ||
                (currentSubTime && new Date(currentSubTime) > new Date(scoresMap[sub.team_id].last_submission_time!))
              ) {
                scoresMap[sub.team_id].last_submission_time = currentSubTime;
              }
            }
          }
        });
      }

      // 5. Convert to array and sort:
      // High score first; if tie, earlier last_submission_time wins!
      const sorted = Object.values(scoresMap).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.solved_count !== a.solved_count) return b.solved_count - a.solved_count;
        if (a.last_submission_time && b.last_submission_time) {
          return new Date(a.last_submission_time).getTime() - new Date(b.last_submission_time).getTime();
        }
        return 0;
      });

      setLeaderboard(sorted);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching scoreboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--bg-primary)', 
      color: 'var(--text-primary)',
      padding: isFullscreen ? '2rem 4rem' : '2rem',
      maxWidth: isFullscreen ? '100%' : '1300px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Top Bar */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/lobby')} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem' }}
          >
            <ArrowLeft size={16} /> Lobby
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Trophy size={28} color="gold" /> Live Leaderboard
            </h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Auto-refreshing • Last updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)} 
            className="btn-outline" 
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
              backgroundColor: autoRefresh ? 'rgba(0, 204, 136, 0.1)' : 'transparent',
              color: autoRefresh ? 'var(--success)' : 'var(--text-secondary)'
            }}
          >
            ● Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <button 
            onClick={() => fetchScores()} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button 
            onClick={toggleFullscreen} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <Maximize2 size={14} /> Projector Mode
          </button>
        </div>
      </header>

      {/* Round Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setSelectedRound('overall')}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.95rem',
            backgroundColor: selectedRound === 'overall' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: selectedRound === 'overall' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          🏆 Overall Standings
        </button>
        {rounds.map(r => (
          <button 
            key={r.id}
            onClick={() => setSelectedRound(r.id)}
            style={{
              padding: '0.6rem 1.4rem',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              backgroundColor: selectedRound === r.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: selectedRound === r.id ? '#fff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {r.name} {r.scores_revealed ? '🔓' : ''}
          </button>
        ))}
      </div>

      {/* Top 3 Podium Showcase */}
      {leaderboard.length >= 3 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1.15fr 1fr', 
          gap: '1.5rem', 
          marginBottom: '2.5rem', 
          alignItems: 'end' 
        }}>
          {/* 2nd Place */}
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: '1.75rem 1rem', 
            borderTop: '4px solid #C0C0C0', 
            backgroundColor: 'rgba(192,192,192,0.04)' 
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥈</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{leaderboard[1].display_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{leaderboard[1].team_id_str}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#C0C0C0', marginTop: '0.75rem' }}>{leaderboard[1].score} pts</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{leaderboard[1].solved_count} solved</div>
          </div>

          {/* 1st Place */}
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: '2.5rem 1.5rem', 
            borderTop: '5px solid #FFD700', 
            backgroundColor: 'rgba(255,215,0,0.06)',
            boxShadow: '0 0 30px rgba(255,215,0,0.15)',
            transform: 'translateY(-10px)'
          }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.25rem' }}>👑</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFD700' }}>{leaderboard[0].display_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'monospace' }}>{leaderboard[0].team_id_str}</div>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#FFD700', marginTop: '0.75rem' }}>{leaderboard[0].score} pts</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{leaderboard[0].solved_count} solved</div>
          </div>

          {/* 3rd Place */}
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: '1.75rem 1rem', 
            borderTop: '4px solid #CD7F32', 
            backgroundColor: 'rgba(205,127,50,0.04)' 
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🥉</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{leaderboard[2].display_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{leaderboard[2].team_id_str}</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#CD7F32', marginTop: '0.75rem' }}>{leaderboard[2].score} pts</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{leaderboard[2].solved_count} solved</div>
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '1rem 1.5rem', width: '80px' }}>Rank</th>
              <th style={{ padding: '1rem' }}>Team</th>
              <th style={{ padding: '1rem', width: '120px' }}>ID</th>
              <th style={{ padding: '1rem', width: '140px', textAlign: 'center' }}>Solved</th>
              <th style={{ padding: '1rem 1.5rem', width: '160px', textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No participants or scores recorded yet.
                </td>
              </tr>
            ) : (
              leaderboard.map((team, index) => {
                const rank = index + 1;
                const isTop3 = rank <= 3;
                return (
                  <tr 
                    key={team.team_id_str}
                    style={{ 
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: rank === 1 ? 'rgba(255,215,0,0.03)' : rank % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 800, fontSize: isTop3 ? '1.15rem' : '1rem' }}>
                      {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 700, fontSize: '1.05rem' }}>
                      {team.display_name}
                      {team.status === 'disqualified' && (
                        <span style={{ marginLeft: '0.5rem', color: 'var(--error)', fontSize: '0.75rem', border: '1px solid var(--error)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                          DISQUALIFIED
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {team.team_id_str}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {team.solved_count} solved
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 900, fontSize: '1.25rem', color: rank === 1 ? '#FFD700' : 'var(--text-primary)' }}>
                      {team.score} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>pts</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
