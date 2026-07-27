import { useState, useEffect, useRef } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn, useUser, useAuth } from '@clerk/clerk-react';
import Sidebar from './components/Sidebar';
import Workspace, { convertMarkdownToPrintHtml } from './components/Workspace';
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

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

function App() {
  // Clerk auth hooks
  const { user } = useUser();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clerkUserId = user?.id || '';
  
  const [pinnedSessions, setPinnedSessions] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handlePinSession = (sid: string) => {
    let updatedPinned = [...pinnedSessions];
    if (pinnedSessions.includes(sid)) {
      updatedPinned = updatedPinned.filter(id => id !== sid);
      showToast("Session unpinned", "info");
    } else {
      if (pinnedSessions.length >= 5) {
        showToast("Maximum of 5 pinned chats allowed", "warning");
        return;
      }
      updatedPinned.push(sid);
      showToast("Session pinned to top", "success");
    }
    setPinnedSessions(updatedPinned);
    localStorage.setItem('mara_pinned_sessions', JSON.stringify(updatedPinned));
  };

  const handleRenameSession = async (sid: string) => {
    const session = sessionsList.find(s => s.session_id === sid);
    const currentName = session ? session.running_summary : "";
    const newName = prompt("Rename Research Session:", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      try {
        const token = await getToken();
        const res = await fetch(`http://localhost:8000/api/sessions/${sid}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ running_summary: newName.trim() })
        });
        if (res.ok) {
          showToast("Session renamed successfully", "success");
          setSessionsList(prev => prev.map(s => s.session_id === sid ? { ...s, running_summary: newName.trim() } : s));
        } else {
          showToast("Failed to rename session", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error renaming session", "error");
      }
    }
  };

  const handleDeleteSession = async (sid: string) => {
    if (confirm("Are you sure you want to delete this research session? This will remove all messages from this session.")) {
      try {
        const token = await getToken();
        const res = await fetch(`http://localhost:8000/api/sessions/${sid}`, {
          method: 'DELETE',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          showToast("Session deleted successfully", "success");
          setSessionsList(prev => prev.filter(s => s.session_id !== sid));
          if (sid === sessionId) {
            handleNewResearch();
          }
        } else {
          showToast("Failed to delete session", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error deleting session", "error");
      }
    }
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('workspace');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');
  const [sources, setSources] = useState<CitedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isTraceOpen, setIsTraceOpen] = useState(false);
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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Resize handler effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200;
      if (newWidth > 600) newWidth = 600;
      setSidebarWidth(newWidth);
      if (isSidebarCollapsed) {
        setIsSidebarCollapsed(false);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isSidebarCollapsed]);

  // Settings state
  const [, setSettings] = useState({
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
    
    const formattedHtml = convertMarkdownToPrintHtml(streamingText);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeQuery || 'MARA Research Report'}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1f2937; line-height: 1.7; max-width: 850px; margin: 0 auto; }
            h1 { font-size: 1.8rem; font-weight: 800; color: #111827; margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            h2 { font-size: 1.4rem; font-weight: 700; color: #1f2937; margin-top: 24px; margin-bottom: 12px; }
            h3 { font-size: 1.15rem; font-weight: 600; color: #374151; margin-top: 20px; margin-bottom: 10px; }
            p { margin-bottom: 12px; }
            blockquote { border-left: 4px solid #2563eb; background: #f0f9ff; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; color: #1e40af; }
            pre { background: #f3f4f6; padding: 16px; border-radius: 8px; font-family: monospace; overflow-x: auto; border: 1px solid #e5e7eb; }
            code { font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 4px; }
            hr { border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0; }
            .sources { margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 20px; }
            .source-item { margin-bottom: 16px; font-size: 0.9rem; }
            .source-title { font-weight: 700; color: #111827; }
            .source-url { color: #2563eb; text-decoration: none; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1 style="color: #2563eb;">Research Topic: ${activeQuery || 'Research Report'}</h1>
          <hr/>
          <div>${formattedHtml}</div>
          ${sources.length > 0 ? `
            <div class="sources">
              <h2 style="font-size: 1.2rem; font-weight: 700; color: #111827;">Cited Sources</h2>
              ${sources.map(s => `
                <div class="source-item">
                  <div class="source-title">[${s.id}] ${s.title}</div>
                  <a class="source-url" href="${s.url}" target="_blank">${s.url}</a>
                  <div style="color: #4b5563; font-style: italic; margin-top: 4px;">${s.summary}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
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

  const fetchFollowUpsSeparately = async (queryText: string, answerText: string) => {
    try {
      const res = await fetch('http://localhost:8000/api/research/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, answer: answerText })
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUps(data.follow_ups || []);
      }
    } catch (err) {
      console.error('Failed to fetch follow-ups separately:', err);
    }
  };

  const fetchSessions = async (retries = 5, showSkeleton = true) => {
    if (showSkeleton) {
      setIsHistoryLoading(true);
    }
    for (let i = 0; i < retries; i++) {
      try {
        const token = await getToken();
        if (!token) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        const res = await fetch('http://localhost:8000/api/sessions', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = await res.json();
        setSessionsList(data);
        if (showSkeleton) {
          setIsHistoryLoading(false);
        }
        return data;
      } catch (err) {
        console.error(`Failed to fetch sessions (attempt ${i + 1}):`, err);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (showSkeleton) {
      setIsHistoryLoading(false);
    }
    return [];
  };

  const loadSessionMessages = async (sid: string, showSkeleton = true, retries = 5) => {
    setSessionId(sid);
    localStorage.setItem('mara_session_id', sid);
    if (showSkeleton) {
      setIsHistoryLoading(true);
    }
    for (let i = 0; i < retries; i++) {
      try {
        const token = await getToken();
        if (!token) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        const res = await fetch(`http://localhost:8000/api/sessions/${sid}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
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
          
          // Clear transient states from previous queries
          setStreamingText('');
          setSources([]);
          setFollowUps([]);
          setIsLoading(false);
          setError(null);
          
          setChatHistory(turns);
          if (turns.length > 0) {
            const lastTurn = turns[turns.length - 1];
            setActiveQuery(lastTurn.query);
            fetchFollowUpsSeparately(lastTurn.query, lastTurn.answer);
          } else {
            setActiveQuery(null);
          }
          if (showSkeleton) {
            setIsHistoryLoading(false);
          }
          return;
      } catch (err) {
        console.error(`Failed to load messages (attempt ${i + 1}):`, err);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
    if (showSkeleton) {
      setIsHistoryLoading(false);
    }
  };

  // Fetch settings and pinned sessions on mount
  useEffect(() => {
    fetchSettings();
    const storedPinned = localStorage.getItem('mara_pinned_sessions');
    if (storedPinned) {
      setPinnedSessions(JSON.parse(storedPinned));
    }
  }, []);

  // Fetch history and sessions once Clerk user resolves
  useEffect(() => {
    if (isLoaded && isSignedIn && clerkUserId) {
      const loadInitialSessions = async () => {
        const sessions = await fetchSessions();
        const storedSession = localStorage.getItem('mara_session_id');
        
        if (storedSession && storedSession !== 'new') {
          const sessionExists = sessions && sessions.some((s: any) => s.session_id === storedSession);
          if (sessionExists) {
            setSessionId(storedSession);
            loadSessionMessages(storedSession);
            return;
          }
        }
        
        // Default to New Chat landing view if storedSession is 'new', empty, or not found
        setSessionId('');
        setActiveQuery(null);
        setChatHistory([]);
        setStreamingText('');
        setSources([]);
        setFollowUps([]);
        setIsLoading(false);
      };
      loadInitialSessions();
    }
  }, [isLoaded, isSignedIn, clerkUserId]);

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

  const handleNewResearch = () => {
    setActiveTab('workspace');
    setActiveQuery(null);
    setStreamingText('');
    setSources([]);
    setFollowUps([]);
    setInputValue('');
    setError(null);
    setTraceSteps(INITIAL_STEPS);
    setIsLoading(false);
    setSessionId('');
    setChatHistory([]);
    localStorage.setItem('mara_session_id', 'new');
    fetchSessions(3, false);
  };

  const handleRunResearch = async (query: string) => {
    setActiveQuery(query);
    setIsLoading(true);
    setStreamingText('');
    streamingTextRef.current = '';
    setInputValue('');
    setFollowUps([]);
    setIsTraceOpen(false);
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
      localStorage.setItem('mara_session_id', returnedSessionId);

      // Update sessions list immediately without showing skeleton loader
      fetchSessions(5, false);

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
          
          setProgressText('Active Stage: VERIFY');
          setTraceSteps(prev => prev.map(s => {
            if (s.id === 'step-scrape') {
              return { 
                ...s, 
                status: 'completed', 
                message: `Scraped ${successCount}/${total} pages successfully.` 
              };
            }
            if (s.id === 'step-verify') {
              return { ...s, status: 'running', message: 'Verifying claims and factual citations...' };
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
            if (s.id === 'step-synthesize') {
              if (verdict === 'pass') {
                return { ...s, status: 'running', message: 'Streaming report contents...' };
              } else {
                return { ...s, status: 'pending', message: 'Awaiting corrected draft...' };
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
            setStreamingText(prev => {
              const newVal = prev + chunk;
              streamingTextRef.current = newVal;
              return newVal;
            });
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
          
          // Immediately preserve completed research turn in chat history
          const completedTurn = {
            query: query,
            answer: streamingTextRef.current,
            sources: sources
          };
          setChatHistory(prev => {
            if (prev.some(t => t.query === query && t.answer === streamingTextRef.current)) {
              return prev;
            }
            return [...prev, completedTurn];
          });
          setStreamingText('');
          
          // Refresh sessions list silently
          fetchSessions(5, false);
          if (returnedSessionId) {
            setSessionId(returnedSessionId);
            localStorage.setItem('mara_session_id', returnedSessionId);
          }
          // Fetch follow up questions separately!
          fetchFollowUpsSeparately(query, streamingTextRef.current);
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
        sessionsList={sessionsList}
        currentSessionId={sessionId}
        onSelectSession={(sid) => {
          setSessionId(sid);
          localStorage.setItem('mara_session_id', sid);
          loadSessionMessages(sid);
          setActiveTab('workspace');
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        sidebarWidth={sidebarWidth}
        onResizeStart={handleMouseDown}
        isResizing={isResizing}
        isHistoryLoading={isHistoryLoading}
        pinnedSessions={pinnedSessions}
        onPinSession={handlePinSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Workspace Layout Wrapper */}
      <div 
        className={`flex-grow flex h-full overflow-hidden ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}`}
        style={{ paddingLeft: isSidebarCollapsed ? 72 : sidebarWidth }}
      >
        {activeTab === 'workspace' && (
          <Workspace
            activeQuery={activeQuery}
            onSubmitQuery={handleRunResearch}
            isLoading={isLoading}
            isHistoryLoading={isHistoryLoading}
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


        {/* Right Stepper Panel */}
        {activeTab === 'workspace' && (
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
      
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const iconMap = {
            success: 'check_circle',
            error: 'error',
            info: 'info',
            warning: 'warning'
          };
          const colorMap = {
            success: 'border-emerald-500/25 bg-emerald-950/80 text-emerald-300',
            error: 'border-red-500/25 bg-red-950/80 text-red-300',
            info: 'border-primary/25 bg-primary-container/20 text-primary',
            warning: 'border-amber-500/25 bg-amber-950/80 text-amber-300'
          };
          return (
            <div 
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl animate-slideIn select-none max-w-sm ${colorMap[toast.type]}`}
            >
              <span className="material-symbols-outlined text-[20px]">{iconMap[toast.type]}</span>
              <span className="text-xs font-semibold">{toast.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto p-1 hover:bg-white/10 rounded-full text-on-surface-variant/60 hover:text-on-surface transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
      </SignedIn>
    </>
  );
}

export default App;
