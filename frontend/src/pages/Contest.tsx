import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Play, RotateCcw, Send, AlertTriangle, CheckCircle2, ShieldAlert, ArrowLeft, Clock, Code2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { SupportedLanguage, MultiLangQuestion } from '../lib/questionTemplates';
import { 
  DEFAULT_QUESTIONS, 
  LANGUAGE_OPTIONS, 
  resolveMultiLangQuestion 
} from '../lib/questionTemplates';

export const Contest = () => {
  const navigate = useNavigate();
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const { teamId, teamDbId, displayName, selectedLanguage, setSelectedLanguage, sessionToken } = useAuthStore();

  const [questions, setQuestions] = useState<MultiLangQuestion[]>(DEFAULT_QUESTIONS);
  const [activeQuestion, setActiveQuestion] = useState<MultiLangQuestion>(DEFAULT_QUESTIONS[0]);
  const [code, setCode] = useState<string>('');
  const [output, setOutput] = useState<{ status: 'idle' | 'running' | 'pass' | 'fail' | 'error', details?: string, actual?: string }>({ status: 'idle' });
  const [timeLeft, setTimeLeft] = useState<number>(1800);
  const [roundName, setRoundName] = useState<string>('Live Round');
  const [tabViolations, setTabViolations] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [showLangPicker, setShowLangPicker] = useState<boolean>(!selectedLanguage);
  const [timesUp, setTimesUp] = useState<boolean>(false);

  // 1. Initial Load: Fetch active round & questions
  useEffect(() => {
    fetchActiveRoundAndQuestions();
  }, []);

  // Restore previously-submitted (locked) questions after a reload
  useEffect(() => {
    if (!teamDbId || !sessionToken) return;
    api.participant({ action: 'get_my_submissions', team_id: teamDbId, session_token: sessionToken })
      .then((res) => {
        if (res.submissions?.length) {
          setSubmittedQuestions(new Set(res.submissions.map((s: any) => s.question_id)));
        }
      })
      .catch(() => {});
  }, [teamDbId, sessionToken]);

  const fetchActiveRoundAndQuestions = async () => {
    try {
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();

      if (rounds) {
        setRoundName(rounds.name);

        if (rounds.starts_at && rounds.duration_seconds) {
          const startTime = new Date(rounds.starts_at).getTime();
          const elapsedSecs = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, rounds.duration_seconds - elapsedSecs);
          setTimeLeft(remaining);
        } else {
          setTimeLeft(rounds.duration_seconds || 1800);
        }

        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('round_id', rounds.id)
          .order('display_order', { ascending: true });

        if (qData && qData.length > 0) {
          const parsed = qData.map(resolveMultiLangQuestion);
          setQuestions(parsed);
          setActiveQuestion(parsed[0]);
          if (selectedLanguage) {
            loadCodeForQuestion(parsed[0], selectedLanguage as SupportedLanguage);
          }
        }
      } else {
        // No active round
        handleRoundEnd();
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };

  const handleRoundEnd = () => {
    setTimesUp(true);
    setTimeout(() => {
      navigate('/lobby');
    }, 10000);
  };

  // 2. Load Drafts from DB / LocalStorage
  const loadCodeForQuestion = async (q: MultiLangQuestion, lang: SupportedLanguage) => {
    const variant = q.variants[lang] || q.variants.python;
    
    if (teamDbId && sessionToken) {
      try {
        const res = await api.participant({ action: 'get_draft', team_id: teamDbId, session_token: sessionToken, question_id: q.id });
        if (res.code) {
          setCode(res.code);
          setOutput({ status: 'idle' });
          return;
        }
      } catch (e) {
        console.error('load draft error:', e);
      }
    }

    const saved = localStorage.getItem(`draft_${teamId}_${q.id}_${lang}`);
    if (saved) {
      setCode(saved);
    } else {
      setCode(variant.buggy_code);
    }
    setOutput({ status: 'idle' });
  };

  // Save Draft to DB Debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeQuestion && code && teamDbId && sessionToken && selectedLanguage) {
        api.participant({
          action: 'save_draft',
          team_id: teamDbId,
          session_token: sessionToken,
          question_id: activeQuestion.id,
          code,
        }).catch(() => {});
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [code, activeQuestion, teamDbId, sessionToken, selectedLanguage]);

  const handleCodeChange = (newVal: string | undefined) => {
    const updated = newVal || '';
    setCode(updated);
    if (activeQuestion && selectedLanguage) {
      localStorage.setItem(`draft_${teamId}_${activeQuestion.id}_${selectedLanguage}`, updated);
    }
  };

  const confirmLanguage = async (langId: string) => {
    setSelectedLanguage(langId);
    setShowLangPicker(false);
    
    if (teamDbId && sessionToken) {
      api.participant({ action: 'set_language', team_id: teamDbId, session_token: sessionToken, language: langId }).catch(() => {});
    }
    
    if (activeQuestion) {
      loadCodeForQuestion(activeQuestion, langId as SupportedLanguage);
    }
  };

  // 3. Server-synced countdown timer and Realtime listener
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRoundEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const channel = supabase.channel('public:rounds')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds' }, (payload) => {
        if (payload.new.status !== 'active') {
          handleRoundEnd();
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 4. Anti-Cheat & Heartbeat
  useEffect(() => {
    if (!teamDbId || !sessionToken) return;

    // Heartbeat
    const sendHeartbeat = () => {
      api.participant({
        action: 'heartbeat',
        team_id: teamDbId,
        session_token: sessionToken,
        current_page: 'contest',
      }).catch(() => {});
    };
    sendHeartbeat();
    const hbInterval = setInterval(sendHeartbeat, 30000);

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        setTabViolations(prev => {
          const next = prev + 1;
          setShowWarningModal(true);
          
          api.participant({
            action: 'log_violation',
            team_id: teamDbId,
            session_token: sessionToken,
            violation_type: 'tab_switch',
            details: { violation_number: next, timestamp: new Date().toISOString() },
          }).catch(() => {});
          return next;
        });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the contest? Your progress is saved.';
      return e.returnValue;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(hbInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [teamDbId, sessionToken]);

  const activeLang = (selectedLanguage as SupportedLanguage) || 'python';
  const currentVariant = activeQuestion.variants[activeLang] || activeQuestion.variants.python;

  // Real-time refs to completely eliminate stale closure bugs
  const editableRangesRef = useRef<number[][]>(currentVariant.editable_line_ranges);
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    editableRangesRef.current = currentVariant.editable_line_ranges;
    if (editorRef.current && monaco) {
      applyLockedLineDecorations(editorRef.current, monaco, currentVariant.editable_line_ranges);
    }
  }, [currentVariant, monaco]);

  const applyLockedLineDecorations = (editor: any, monacoInstance: any, ranges: number[][]) => {
    const model = editor.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const newDecorations: any[] = [];
    let currentLine = 1;

    ranges.forEach(([start, end]) => {
      if (currentLine < start) {
        newDecorations.push({
          range: new monacoInstance.Range(currentLine, 1, start - 1, 1),
          options: { isWholeLine: true, className: 'locked-line' }
        });
      }
      newDecorations.push({
        range: new monacoInstance.Range(start, 1, end, 1),
        options: { isWholeLine: true, className: 'editable-line-active' }
      });
      currentLine = end + 1;
    });

    if (currentLine <= lineCount) {
      newDecorations.push({
        range: new monacoInstance.Range(currentLine, 1, lineCount, 1),
        options: { isWholeLine: true, className: 'locked-line' }
      });
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  // 5. Monaco Editor Lock Lines & Anti-Cheat
  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    applyLockedLineDecorations(editor, monacoInstance, editableRangesRef.current);

    editor.onKeyDown((e: any) => {
      const ranges = editableRangesRef.current || [];
      if (ranges.length === 0) return;

      const selections = editor.getSelections();
      if (!selections || selections.length === 0) return;

      let isAllowed = true;
      for (let selection of selections) {
        let inRange = false;
        for (let [start, end] of ranges) {
          if (selection.startLineNumber >= start && selection.endLineNumber <= end) {
            inRange = true;
            break;
          }
        }
        if (!inRange) {
          isAllowed = false;
          break;
        }
      }

      if (!isAllowed) {
        const allowedNavigationKeys = [
          monacoInstance.KeyCode.UpArrow, monacoInstance.KeyCode.DownArrow,
          monacoInstance.KeyCode.LeftArrow, monacoInstance.KeyCode.RightArrow,
          monacoInstance.KeyCode.PageUp, monacoInstance.KeyCode.PageDown,
          monacoInstance.KeyCode.Home, monacoInstance.KeyCode.End,
          monacoInstance.KeyCode.Escape
        ];
        if (!allowedNavigationKeys.includes(e.keyCode)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    editor.onDidPaste(() => {
      alert('⚠️ Pasting is strictly monitored during the contest.');
    });
  };

  // 6. Execute / Submit Code
  const executeCode = async (action: 'run' | 'submit') => {
    setOutput({ status: 'running' });

    try {
      const data = await api.evaluate({
        question_id: activeQuestion.id,
        team_id: teamDbId,
        session_token: sessionToken,
        code,
        language: selectedLanguage,
        action,
      });

      if (data.is_correct === true) {
        setOutput({ status: 'pass', actual: data.actual_output });
        if (action === 'submit') {
          setSubmittedQuestions(prev => new Set(prev).add(activeQuestion.id));
          alert(`🎉 SUCCESS! [${currentVariant.label}] Question "${activeQuestion.title}" submitted and locked!`);
        } else {
          alert(`✅ SUCCESS! Your ${currentVariant.label} code passed the test case!`);
        }
      } else {
        const errMsg = data.error_details || data.error || data.message || 'Output did not match expected result.';
        setOutput({ status: 'fail', details: errMsg, actual: data.actual_output });
        if (action === 'run') {
          alert('❌ FAILED: ' + errMsg);
        }
      }

    } catch (err: any) {
      console.error('Execute error:', err);
      setOutput({ status: 'error', details: err?.message || 'Network error' });
    }
  };

  const handleReset = () => {
    if (confirm(`Reset ${currentVariant.label} code back to original version? All unsaved edits will be lost.`)) {
      setCode(currentVariant.buggy_code);
      localStorage.removeItem(`draft_${teamId}_${activeQuestion.id}_${selectedLanguage}`);
      if (teamDbId && sessionToken) {
        api.participant({ action: 'delete_draft', team_id: teamDbId, session_token: sessionToken, question_id: activeQuestion.id }).catch(() => {});
      }
      setOutput({ status: 'idle' });
    }
  };

  const handleQuestionSelect = (q: MultiLangQuestion) => {
    setActiveQuestion(q);
    loadCodeForQuestion(q, activeLang);
  };

  const isQuestionLocked = submittedQuestions.has(activeQuestion.id);

  if (showLangPicker) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)', justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', padding: '2.5rem', textAlign: 'center' }}>
          <Code2 size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.8rem' }}>Choose Your Language</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            Select the programming language you will use for this round. <br />
            <strong style={{ color: 'var(--warning)' }}>This choice is final and cannot be changed once the round begins.</strong>
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.id}
                onClick={() => confirmLanguage(lang.id)}
                className="btn-outline"
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
                  padding: '1.5rem', border: '2px solid var(--border)', borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.2s',
                  color: 'var(--text-primary)'
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-primary)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-secondary)';
                }}
              >
                <span style={{ fontSize: '2rem' }}>{lang.icon}</span>
                <span style={{ fontWeight: 700 }}>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      
      {/* Time's Up Modal */}
      {timesUp && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000,
          display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column'
        }}>
          <Clock size={80} color="var(--error)" style={{ marginBottom: '2rem', animation: 'pulse 2s infinite' }} />
          <h1 style={{ margin: '0 0 1rem 0', color: 'var(--error)', fontSize: '4rem', fontWeight: 900, textTransform: 'uppercase' }}>Time's Up!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>
            The round has concluded. You are being redirected to the lobby...
          </p>
        </div>
      )}

      {/* Anti-cheat Warning Modal */}
      {showWarningModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div className="card" style={{ maxWidth: '460px', textAlign: 'center', padding: '2.5rem 2rem', border: '2px solid var(--error)' }}>
            <ShieldAlert size={56} color="var(--error)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--error)' }}>Tab Switch Detected!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Warning #{tabViolations}: You navigated away from the contest window. Switching tabs or opening external resources is strictly forbidden. 
              <br/><br/>
              <strong style={{ color: 'var(--text-primary)' }}>This incident has been logged. Disqualification is at the discretion of the admin.</strong>
            </p>
            <button 
              className="btn" 
              onClick={() => setShowWarningModal(false)}
              style={{ marginTop: '1.5rem', width: '100%', backgroundColor: 'var(--error)' }}
            >
              I Understand — Return to Contest
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '0.75rem 2rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button 
            onClick={() => navigate('/lobby')} 
            className="btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={14} /> Lobby
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
              {roundName}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Team: <strong style={{ color: 'var(--text-primary)' }}>{displayName || teamId}</strong> ({teamId})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {tabViolations > 0 && (
            <span style={{ color: 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
              <ShieldAlert size={14} /> {tabViolations} violation{tabViolations > 1 ? 's' : ''} logged
            </span>
          )}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '1.6rem', fontWeight: 800, fontFamily: 'monospace', 
            color: timeLeft < 300 ? 'var(--error)' : 'var(--text-primary)',
            backgroundColor: 'var(--bg-tertiary)', padding: '0.3rem 0.8rem', borderRadius: '6px'
          }}>
            <Clock size={20} color={timeLeft < 300 ? 'var(--error)' : 'var(--text-secondary)'} />
            {formatTimer(timeLeft)}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar: Question List */}
        <div style={{ width: '260px', backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h3 style={{ marginTop: 0, color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Questions ({questions.length})
          </h3>
          {questions.map((q) => {
            const isSelected = activeQuestion.id === q.id;
            const isDone = submittedQuestions.has(q.id);
            return (
              <button 
                key={q.id}
                onClick={() => handleQuestionSelect(q)}
                style={{ 
                  width: '100%', textAlign: 'left', padding: '0.85rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                  fontWeight: isSelected ? 700 : 500,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.9rem', transition: 'all 0.15s'
                }}
              >
                <span>{q.title}</span>
                {isDone ? (
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--success)', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '3px', fontWeight: 700 }}>
                    LOCKED
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{q.marks} pts</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          {/* Action Toolbar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '0.65rem 1.25rem', 
            borderBottom: '1px solid var(--border)', 
            backgroundColor: 'var(--bg-tertiary)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Language:</span>
                <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}>
                  {LANGUAGE_OPTIONS.find(l => l.id === activeLang)?.icon} {LANGUAGE_OPTIONS.find(l => l.id === activeLang)?.label}
                </strong>
              </div>

              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Editable lines: <strong style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {currentVariant.editable_line_ranges.map(r => `${r[0]}-${r[1]}`).join(', ')}
                </strong>
              </span>
            </div>

            {/* Run / Reset / Submit buttons */}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button 
                onClick={handleReset} 
                disabled={isQuestionLocked}
                className="btn-outline" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', fontSize: '0.9rem' }}
              >
                <RotateCcw size={15} /> Reset
              </button>
              <button 
                onClick={() => executeCode('run')} 
                disabled={output.status === 'running' || isQuestionLocked}
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1.1rem', backgroundColor: '#3b82f6', fontSize: '0.9rem' }}
              >
                <Play size={15} /> Run Code
              </button>
              <button 
                onClick={() => {
                  if (confirm(`Final Submit in ${currentVariant.label}? Once submitted, this question is permanently locked and graded!`)) {
                    executeCode('submit');
                  }
                }} 
                disabled={output.status === 'running' || isQuestionLocked}
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1.1rem', backgroundColor: 'var(--success)', fontSize: '0.9rem', color: '#000', fontWeight: 700 }}
              >
                <Send size={15} /> Submit Final
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Editor
              height="100%"
              theme="vs-dark"
              language={currentVariant.monacoLang}
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 16,
                wordWrap: 'on',
                contextmenu: false,
                readOnly: isQuestionLocked,
                lineNumbers: 'on',
              }}
            />
          </div>

          {/* Execution Result Drawer */}
          {output.status !== 'idle' && (
            <div style={{ height: '140px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Execution Output ({currentVariant.label})
              </h4>
              <div style={{ 
                flex: 1, borderRadius: '6px', padding: '0.75rem 1.25rem', 
                display: 'flex', alignItems: 'center', gap: '1rem', 
                border: '1px solid var(--border)',
                backgroundColor: output.status === 'pass' ? 'rgba(0, 204, 136, 0.1)' : output.status === 'fail' ? 'rgba(255, 76, 76, 0.1)' : 'var(--bg-tertiary)'
              }}>
                {output.status === 'running' && (
                  <>
                    <span className="spin" style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--accent-primary)', borderTopColor: 'transparent' }} />
                    <span>Executing {currentVariant.label} code in isolated Docker sandbox...</span>
                  </>
                )}
                {output.status === 'pass' && (
                  <>
                    <CheckCircle2 size={24} color="var(--success)" />
                    <div>
                      <strong style={{ color: 'var(--success)', display: 'block' }}>ACCEPTED! Output matched expected testcase.</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click "Submit Final" when you are ready to lock in your score.</span>
                    </div>
                  </>
                )}
                {output.status === 'fail' && (
                  <>
                    <AlertTriangle size={24} color="var(--error)" />
                    <div style={{ overflow: 'auto', maxHeight: '80px' }}>
                      <strong style={{ color: 'var(--error)', display: 'block' }}>TEST FAILED</strong>
                      <pre style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {output.details}
                      </pre>
                    </div>
                  </>
                )}
                {output.status === 'error' && (
                  <>
                    <AlertTriangle size={24} color="var(--error)" />
                    <div>
                      <strong style={{ color: 'var(--error)', display: 'block' }}>EXECUTION ERROR</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{output.details}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
