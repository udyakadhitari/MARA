import { useState, useEffect } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn, useUser, useAuth } from '@clerk/clerk-react';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import AgentTracePanel from './components/AgentTracePanel';
import type { AgentStep } from './components/AgentTracePanel';
import type { CitedSource } from './components/CitedSources';

const INITIAL_STEPS: AgentStep[] = [
  { id: 'step-orchestrator', agent: 'Orchestrator', message: 'Awaiting research query...', status: 'pending' },
  { id: 'step-search', agent: 'Search', message: 'Awaiting query...', status: 'pending' },
  { id: 'step-scrape', agent: 'Scrape', message: 'Awaiting search results...', status: 'pending' },
  { id: 'step-verify', agent: 'Verify', message: 'Awaiting content extraction...', status: 'pending' },
  { id: 'step-synthesize', agent: 'Synthesize', message: 'Awaiting verification...', status: 'pending' }
];

// (Removed unused HistoryItem)

function App() {
  // Clerk auth hooks
  const { user } = useUser();
  const { getToken } = useAuth();
  const clerkUserId = user?.id || '';

  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [sources, setSources] = useState<CitedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTraceOpen, setIsTraceOpen] = useState(true);
  const [traceSteps, setTraceSteps] = useState<AgentStep[]>(INITIAL_STEPS);
  const [progressText, setProgressText] = useState('0/5 sub-queries answered');
  // Session is keyed per Clerk user ID so different users don't share sessions
  const [sessionId, setSessionId] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runTrace, setRunTrace] = useState<any | null>(null);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    searchDepth: 'DEEP',
    maxResults: 10
  });

  // Speech Recognition configuration (Web Speech API)
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = 'en-US';
      rec.interimResults = false;
      
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => {
          const space = prev.trim() ? ' ' : '';
          return prev + space + transcript;
        });
        setIsListening(false);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const handleToggleListen = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please try Google Chrome.');
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  const handleExportMarkdown = () => {
    if (!streamingText) return;
    const blob = new Blob([streamingText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeQuery?.replace(/\s+/g, '_') || 'research'}_report.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Parse markdown styling roughly for printing
    const formattedHtml = streamingText
      .split('\n\n')
      .map(p => {
        if (p.startsWith('# ')) return `<h1>${p.replace('# ', '')}</h1>`;
        if (p.startsWith('## ')) return `<h2>${p.replace('## ', '')}</h2>`;
        if (p.startsWith('### ')) return `<h3>${p.replace('### ', '')}</h3>`;
        if (p.includes('σ = (L / A)')) return `<pre><code>${p}</code></pre>`;
        return `<p>${p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
      })
      .join('\n');

    printWindow.document.write(`
      <html>
        <head>
          <title>${activeQuery || 'MARA Research Report'}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 50px; color: #1f2937; line-height: 1.7; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 2.25rem; font-weight: 800; color: #111827; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            h2 { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin-top: 30px; }
            h3 { font-size: 1.25rem; font-weight: 600; color: #374151; margin-top: 25px; }
            p { margin-bottom: 15px; }
            pre { background: #f3f4f6; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; border: 1px solid #e5e7eb; }
            code { font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
            hr { border: 0; border-top: 1px solid #e5e7eb; margin: 40px 0; }
            .sources { margin-top: 50px; border-top: 3px solid #111827; padding-top: 20px; }
            .source-item { margin-bottom: 20px; font-size: 0.95rem; }
            .source-title { font-weight: 700; color: #111827; }
            .source-url { font-size: 0.85em; color: #2563eb; text-decoration: none; word-break: break-all; }
            .source-summary { color: #4b5563; font-style: italic; margin-top: 4px; }
          </style>
        </head>
        <body>
          <h1>${activeQuery}</h1>
          <hr/>
          <div>${formattedHtml}</div>
          ${sources.length > 0 ? `
            <div class="sources">
              <h2>Cited Sources</h2>
              ${sources.map(s => `
                <div class="source-item">
                  <div class="source-title">[${s.id}] ${s.title}</div>
                  <a class="source-url" href="${s.url}" target="_blank">${s.url}</a>
                  <div class="source-summary">${s.summary}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleViewTrace = async () => {
    if (!activeTaskId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/research/trace/${activeTaskId}`);
      if (res.ok) {
        const data = await res.json();
        setRunTrace(data);
        setIsTraceModalOpen(true);
      } else {
        alert('Trace data is still compiling or unavailable.');
      }
    } catch (err) {
      console.error('Failed to retrieve run trace:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const token = await getToken();
      const res = await fetch('http://localhost:8000/api/sessions', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSessionMessages = async (sid: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:8000/api/sessions/${sid}/messages`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const turns = data.map((t: any) => ({
          query: t.query,
          answer: t.answer,
          sources: (t.sources || []).map((url: string, idx: number) => ({
            id: (idx + 1).toString(),
            title: 'Cited Source',
            publication: 'Web Scrape',
            summary: 'Verified factual reference',
            url: url,
            relevance: 100
          }))
        }));
        setChatHistory(turns);
        if (turns.length > 0) {
          setActiveQuery(turns[turns.length - 1].query);
        }
      }
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  // Fetch history, sessions, and settings on mount
  useEffect(() => {
    fetchSessions();
    fetchSettings();
    const storedSession = localStorage.getItem('mara_session_id');
    if (storedSession) {
      loadSessionMessages(storedSession);
    }
  }, []);

// (Removed unused fetchHistory)

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          model: data.default_model || 'gemini-2.5-flash-lite',
          temperature: data.temperature ?? 0.2,
          searchDepth: data.search_depth || 'DEEP',
          maxResults: data.max_search_results ?? 10
        });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_model: settings.model,
          temperature: settings.temperature,
          search_depth: settings.searchDepth
        })
      });
      if (res.ok) {
        alert('Configuration saved to backend successfully.');
      } else {
        alert('Failed to save configuration.');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Network error while saving settings.');
    }
  };

  const handleNewResearch = () => {
    setActiveTab('workspace');
    setActiveQuery(null);
    setStreamingText('');
    setSources([]);
    setError(null);
    setTraceSteps(INITIAL_STEPS);
    setIsLoading(false);
    setSessionId('');
    setChatHistory([]);
    localStorage.removeItem('mara_session_id');
  };

  const handleRunResearch = async (query: string) => {
    setActiveQuery(query);
    setIsLoading(true);
    setStreamingText('');
    setSources([]);
    setError(null);
    setProgressText('Submitting task...');

    // Initialize steps to pending
    setTraceSteps([
      { id: 'step-orchestrator', agent: 'Orchestrator', message: 'Decomposing query...', status: 'running' },
      { id: 'step-search', agent: 'Search', message: 'Awaiting sub-queries...', status: 'pending' },
      { id: 'step-scrape', agent: 'Scrape', message: 'Awaiting search results...', status: 'pending' },
      { id: 'step-verify', agent: 'Verify', message: 'Awaiting content...', status: 'pending' },
      { id: 'step-synthesize', agent: 'Synthesize', message: 'Awaiting verification...', status: 'pending' }
    ]);

    try {
      // 1. Get auth token and submit query to start research task
      const token = await getToken();
      const response = await fetch('http://localhost:8000/api/research/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query, session_id: sessionId || null, user_id: clerkUserId || null })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize task: ${response.statusText}`);
      }

      const taskData = await response.json();
      const taskId = taskData.task_id;
      const returnedSessionId = taskData.session_id;
      
      setActiveTaskId(taskId);
      setFollowUps([]);
      setSessionId(returnedSessionId);

      // Update sessions list immediately
      fetchSessions();

      // 2. Open EventSource for SSE streaming
      const eventSource = new EventSource(`http://localhost:8000/api/research/stream/${taskId}`);

      eventSource.addEventListener('orchestrator-done', (event) => {
        try {
          const data = JSON.parse(event.data);
          const subQueries = data.sub_queries || [];
          setProgressText('Active Stage: SEARCH');
          setTraceSteps(prev => prev.map(s => {
            if (s.id === 'step-orchestrator') {
              return { 
                ...s, 
                status: 'completed', 
                message: `Decomposed query into ${subQueries.length} sub-aspects.` 
              };
            }
            if (s.id === 'step-search') {
              return { ...s, status: 'running', message: 'Performing web search...' };
            }
            return s;
          }));
        } catch (e) {
          console.error('Error parsing orchestrator-done:', e);
        }
      });

      eventSource.addEventListener('search-done', (event) => {
        try {
          const data = JSON.parse(event.data);
          const urls = data.urls || [];
          setProgressText('Active Stage: SCRAPE');
          setTraceSteps(prev => prev.map(s => {
            if (s.id === 'step-search') {
              return { 
                ...s, 
                status: 'completed', 
                message: `Web search complete. Found ${urls.length} URLs.`, 
                urls 
              };
            }
            if (s.id === 'step-scrape') {
              return { ...s, status: 'running', message: 'Scraping web pages...' };
            }
            return s;
          }));
        } catch (e) {
          console.error('Error parsing search-done:', e);
        }
      });

      eventSource.addEventListener('scrape-done', (event) => {
        try {
          const data = JSON.parse(event.data);
          const results = data.results || {};
          const total = Object.keys(results).length;
          const successCount = Object.values(results).filter((r: any) => r.status === 'success').length;
          
          setProgressText('Active Stage: SYNTHESIZE');
          setTraceSteps(prev => prev.map(s => {
            if (s.id === 'step-scrape') {
              return { 
                ...s, 
                status: 'completed', 
                message: `Scraped ${successCount}/${total} pages successfully.` 
              };
            }
            if (s.id === 'step-synthesize') {
              return { ...s, status: 'running', message: 'Streaming report contents...' };
            }
            return s;
          }));
        } catch (e) {
          console.error('Error parsing scrape-done:', e);
        }
      });

      eventSource.addEventListener('critic-verdict', (event) => {
        try {
          const data = JSON.parse(event.data);
          const verdict = data.verdict;
          const feedback = data.feedback || '';
          
          setProgressText('Active Stage: CRITIC');
          setTraceSteps(prev => prev.map(s => {
            if (s.id === 'step-verify') {
              if (verdict === 'fail') {
                return { 
                  ...s, 
                  status: 'running', 
                  message: `Factual check: FAIL. Feedback: ${feedback.substring(0, 100)}... Requesting correction.` 
                };
              } else {
                return { 
                  ...s, 
                  status: 'completed', 
                  message: 'Fact-check passed. All claims verified.' 
                };
              }
            }
            return s;
          }));
        } catch (e) {
          console.error('Error parsing critic-verdict:', e);
        }
      });

      eventSource.addEventListener('synthesizer-token-stream', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data.done) {
            const chunk = data.chunk;
            setStreamingText(prev => prev + chunk);
            setTraceSteps(prev => prev.map(s => 
              s.id === 'step-synthesize' ? { ...s, status: 'running', message: 'Streaming report contents...' } : s
            ));
          } else {
            const claims = data.claims || [];
            const confidence = data.confidence || 0.0;
            const followUpsList = data.follow_ups || [];
            
            setFollowUps(followUpsList);
            
            // Map claims to CitedSource objects
            const newSources: CitedSource[] = claims.map((c: any, idx: number) => ({
              id: (idx + 1).toString(),
              title: c.claim_text.substring(0, 60) + '...',
              publication: 'Scraped Web Source',
              summary: c.claim_text,
              url: c.source_url,
              relevance: Math.round(confidence * 100)
            }));
            
            setSources(newSources);
            setTraceSteps(prev => prev.map(s => {
              if (s.id === 'step-synthesize') {
                return { ...s, status: 'completed', message: 'Structured report finalized.' };
              }
              if (s.id === 'step-verify' && s.status !== 'completed') {
                return { ...s, status: 'completed', message: 'Fact-check audit complete.' };
              }
              return s;
            }));
          }
        } catch (e) {
          console.error('Error parsing synthesizer-token-stream:', e);
        }
      });

      let errorOccurred = false;

      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE Stream Completed:', data);
          setIsLoading(false);
          errorOccurred = true; // prevent onerror from firing
          eventSource.close();
          
          // Mark all steps as completed
          setTraceSteps(prev => prev.map(s => ({ ...s, status: 'completed' })));
          setProgressText('Research complete.');
          
          // Refresh sessions list
          fetchSessions();
          if (returnedSessionId) {
            loadSessionMessages(returnedSessionId);
          }
          setStreamingText('');
        } catch (e) {
          console.error('Error parsing complete event:', e);
        }
      });

      eventSource.addEventListener('error', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          errorOccurred = true;
          setError(data.message || 'An error occurred during synthesis.');
          setIsLoading(false);
          eventSource.close();
        } catch (e) {
          console.error('Error parsing error event:', e);
        }
      });

      eventSource.onerror = (err) => {
        if (errorOccurred) return;
        console.error('EventSource connection lost:', err);
        setError('Connection lost or server rate limit reached.');
        setIsLoading(false);
        eventSource.close();
      };

    } catch (err: any) {
      console.error('Network initialization failed:', err);
      setError(err.message || 'Failed to initialize connection with FastAPI server.');
      setIsLoading(false);
    }
  };

  const handleRetryError = () => {
    setError(null);
    if (activeQuery) {
      handleRunResearch(activeQuery);
    }
  };

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background">
      {/* Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onNewResearch={handleNewResearch} 
      />

      {/* Main Workspace Layout Wrapper */}
      <div className="flex-grow flex h-full overflow-hidden pl-sidebar-width">
        {activeTab === 'workspace' && (
          <Workspace
            activeQuery={activeQuery}
            onSubmitQuery={handleRunResearch}
            isLoading={isLoading}
            streamingText={streamingText}
            sources={sources}
            error={error}
            onRetryError={handleRetryError}
            onToggleTrace={() => setIsTraceOpen(!isTraceOpen)}
            isTraceOpen={isTraceOpen}
            progressText={progressText}
            inputValue={inputValue}
            setInputValue={setInputValue}
            followUps={followUps}
            isListening={isListening}
            onToggleListen={handleToggleListen}
            onExportMarkdown={handleExportMarkdown}
            onExportPDF={handleExportPDF}
            onViewTrace={handleViewTrace}
            activeTaskId={activeTaskId}
            chatHistory={chatHistory}
          />
        )}
        {/* History View */}
        {activeTab === 'history' && (
          <div className="flex-grow p-container-padding overflow-y-auto bg-surface-container-lowest max-w-4xl mx-auto w-full mt-10">
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[28px]">history</span>
              <span>Research History Sessions</span>
            </h2>
            <div className="space-y-4">
              {sessionsList.length === 0 ? (
                <div className="text-on-surface-variant text-sm py-8 text-center border border-dashed border-white/10 rounded-2xl">
                  No research sessions found in database.
                </div>
              ) : (
                sessionsList.map(session => (
                  <div 
                    key={session.session_id}
                    onClick={() => {
                      setSessionId(session.session_id);
                      localStorage.setItem('mara_session_id', session.session_id);
                      loadSessionMessages(session.session_id);
                      setActiveTab('workspace');
                    }}
                    className="bg-surface-container rounded-2xl p-5 hover:bg-surface-container-high border border-white/5 cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99] border-solid"
                  >
                    <div className="flex-grow pr-4">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px]">forum</span>
                        <h3 className="font-bold text-on-surface group-hover:text-primary transition-colors text-base">
                          {session.running_summary || `Session (${session.session_id.substring(0,8)})`}
                        </h3>
                      </div>
                      <div className="flex gap-4 mt-2 items-center">
                        <span className="text-xs text-on-surface-variant font-code-md block">
                          Created: {new Date(session.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors shrink-0">
                      arrow_forward
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Library View */}
        {activeTab === 'library' && (
          <div className="flex-grow p-container-padding overflow-y-auto bg-surface-container-lowest max-w-4xl mx-auto w-full mt-10">
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[28px]">book</span>
              <span>Library</span>
            </h2>
            <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
              Your saved documents, academic publications, and generated summaries. Click to read or download.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
                <span className="material-symbols-outlined text-secondary text-[32px] mb-3">description</span>
                <h3 className="font-bold text-on-surface text-base mb-1">solid_state_battery_review.pdf</h3>
                <span className="text-xs text-on-surface-variant font-code-md">Added: 2026-07-02 | 14.2 MB</span>
              </div>
              <div className="bg-surface-container rounded-2xl p-6 border border-white/5">
                <span className="material-symbols-outlined text-secondary text-[32px] mb-3">description</span>
                <h3 className="font-bold text-on-surface text-base mb-1">lithium_dendrites_study.pdf</h3>
                <span className="text-xs text-on-surface-variant font-code-md">Added: 2026-07-01 | 8.5 MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <div className="flex-grow p-container-padding overflow-y-auto bg-surface-container-lowest max-w-3xl mx-auto w-full mt-10">
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[28px]">settings</span>
              <span>Settings</span>
            </h2>
            
            <div className="bg-surface-container rounded-3xl p-8 border border-white/5 space-y-6">
              {/* Model selection */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Default LLM Model</label>
                <select 
                  value={settings.model} 
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full bg-surface-container-low border border-white/10 text-on-surface rounded-xl p-3 focus:outline-none focus:border-primary text-sm font-medium"
                >
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fast & Efficient)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Analytical & Precise)</option>
                </select>
              </div>

              {/* Temperature slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Temperature</label>
                  <span className="text-xs font-code-md text-primary font-bold">{settings.temperature}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-primary bg-surface-container-low h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Search depth */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Web Scraping Depth</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setSettings({ ...settings, searchDepth: 'STANDARD' })}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      settings.searchDepth === 'STANDARD' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-white/10 bg-surface-container-low hover:bg-surface-variant/30 text-on-surface-variant'
                    }`}
                  >
                    Standard (Fast)
                  </button>
                  <button 
                    onClick={() => setSettings({ ...settings, searchDepth: 'DEEP' })}
                    className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                      settings.searchDepth === 'DEEP' 
                        ? 'border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(75,142,255,0.05)]' 
                        : 'border-white/10 bg-surface-container-low hover:bg-surface-variant/30 text-on-surface-variant'
                    }`}
                  >
                    Deep Research (Thorough)
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end">
                <button 
                  onClick={handleSaveSettings}
                  className="bg-primary text-on-primary font-bold py-2.5 px-6 rounded-xl hover:bg-primary-fixed transition-all text-xs shadow-md active:scale-95"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Stepper Panel */}
        {activeTab === 'workspace' && activeQuery && (
          <AgentTracePanel
            steps={traceSteps}
            isOpen={isTraceOpen}
            onClose={() => setIsTraceOpen(false)}
          />
        )}
        {/* Observability Trace Modal */}
        {isTraceModalOpen && runTrace && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fadeIn">
            <div className="bg-surface-container rounded-3xl border border-white/10 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              <header className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">troubleshoot</span>
                  <h3 className="font-bold text-on-surface text-lg">Observability Run Trace</h3>
                  <span className="text-xs text-on-surface-variant font-code-md ml-3 bg-surface-container-high px-2.5 py-1 rounded-full border border-white/5">{runTrace.task_id}</span>
                </div>
                <button 
                  onClick={() => setIsTraceModalOpen(false)}
                  className="p-2 hover:bg-surface-variant/40 rounded-full text-on-surface-variant hover:text-on-surface transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>
              <div className="p-6 overflow-y-auto space-y-6 flex-grow">
                <div className="flex justify-between text-xs text-on-surface-variant font-code-md">
                  <span>Started: {new Date(runTrace.timestamp).toLocaleString()}</span>
                  <span>Query: "{runTrace.query}"</span>
                </div>
                <div className="space-y-4">
                  {runTrace.steps.map((step: any, index: number) => (
                    <div key={index} className="bg-surface-container-low rounded-2xl p-5 border border-white/5 animate-fadeIn">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                        <span className="font-bold text-on-surface text-sm uppercase tracking-wider">{step.node} Node</span>
                        <span className="text-[10px] text-on-surface-variant font-code-md ml-auto">{new Date(step.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <pre className="bg-surface-container-lowest p-4 rounded-xl font-code-sm text-code-sm text-on-surface/80 overflow-x-auto border border-white/5 shadow-inner select-text">
                        <code>{JSON.stringify(step.state_update, null, 2)}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
      </SignedIn>
    </>
  );
}

export default App;
