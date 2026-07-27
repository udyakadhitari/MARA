import { CitedSources } from './CitedSources';
import type { CitedSource } from './CitedSources';

// Robust, lightweight markdown parser to format bold text, headers, links, and lists
const parseMarkdown = (text: string) => {
  if (!text) return '';
  
  let cleanedText = text.trim();
  if (cleanedText.startsWith('```markdown')) {
    cleanedText = cleanedText.slice(11).trim();
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3).trim();
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3).trim();
  }
  
  const blocks = cleanedText.split('\n');
  let inList = false;
  const parsedHtml: string[] = [];
  
  const formatLine = (line: string) => {
    return line
      // Bold **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-on-surface font-bold">$1</strong>')
      // Clickable markdown links [Title](URL)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold inline-flex items-center gap-0.5">$1<span class="material-symbols-outlined text-[10px] inline-block align-middle select-none">open_in_new</span></a>')
      // Citations [1]
      .replace(/\[(\d+)\]/g, '<sup class="text-primary font-bold cursor-pointer hover:underline mx-0.5">[$1]</sup>')
      // Inline code `code`
      .replace(/`([^`]+)`/g, '<code class="font-code-md text-xs bg-surface-variant/40 border border-white/5 px-1.5 py-0.5 rounded text-tertiary font-medium">$1</code>');
  };

  for (let line of blocks) {
    let trimmed = line.trim();
    if (trimmed === '```markdown' || trimmed === '```') {
      continue;
    }
    
    // Handle lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        inList = true;
        parsedHtml.push('<ul class="list-disc pl-6 space-y-2 text-on-surface-variant my-4">');
      }
      let content = trimmed.substring(2);
      parsedHtml.push(`<li>${formatLine(content)}</li>`);
      continue;
    } else {
      if (inList) {
        inList = false;
        parsedHtml.push('</ul>');
      }
    }
    
    // Handle headers
    if (trimmed.startsWith('### ')) {
      parsedHtml.push(`<h3 class="text-base font-bold text-on-surface mt-6 mb-3 flex items-center gap-2 border-b border-white/5 pb-1">${formatLine(trimmed.substring(4))}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      parsedHtml.push(`<h2 class="text-lg font-bold text-primary mt-8 mb-4 flex items-center gap-2 border-b border-white/5 pb-2">${formatLine(trimmed.substring(3))}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      parsedHtml.push(`<h1 class="text-xl font-bold text-primary mt-10 mb-5 pb-2 border-b border-white/10">${formatLine(trimmed.substring(2))}</h1>`);
    } else if (trimmed === '') {
      continue;
    } else {
      // Plain paragraph
      parsedHtml.push(`<p class="my-3 leading-relaxed text-on-surface-variant">${formatLine(line)}</p>`);
    }
  }
  
  if (inList) {
    parsedHtml.push('</ul>');
  }
  
  return parsedHtml.join('\n');
};

export const convertMarkdownToPrintHtml = (text: string): string => {
  if (!text) return '';

  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) cleaned = cleaned.slice(11).trim();
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3).trim();
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3).trim();

  const lines = cleaned.split('\n');
  const htmlResult: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let inBlockquote = false;

  const inlineFormat = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>')
      .replace(/\[(\d+)\]/g, '<sup style="color: #2563eb; font-weight: bold;">[$1]</sup>')
      .replace(/`([^`]+)`/g, '<code style="font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 4px;">$1</code>')
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '');
  };

  const closeListIfNeeded = () => {
    if (inList) {
      htmlResult.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
  };

  const closeBlockquoteIfNeeded = () => {
    if (inBlockquote) {
      htmlResult.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (let line of lines) {
    let trimmed = line.trim();

    if (trimmed === '```markdown' || trimmed === '```') continue;

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      closeListIfNeeded();
      closeBlockquoteIfNeeded();
      htmlResult.push('<hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;"/>');
      continue;
    }

    if (trimmed.startsWith('>')) {
      closeListIfNeeded();
      const quoteText = trimmed.replace(/^>\s*/, '');
      if (!inBlockquote) {
        inBlockquote = true;
        htmlResult.push('<blockquote style="border-left: 4px solid #2563eb; background: #f0f9ff; padding: 12px 18px; margin: 16px 0; border-radius: 0 8px 8px 0; color: #1e40af; font-size: 0.95rem;">');
      }
      htmlResult.push(`<p style="margin: 4px 0; line-height: 1.6;">${inlineFormat(quoteText)}</p>`);
      continue;
    } else {
      closeBlockquoteIfNeeded();
    }

    if (trimmed.startsWith('#')) {
      closeListIfNeeded();
      let level = 0;
      while (trimmed.startsWith('#')) {
        level++;
        trimmed = trimmed.substring(1);
      }
      trimmed = trimmed.trim();
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        trimmed = trimmed.slice(2, -2).trim();
      }
      const cleanHeadingText = inlineFormat(trimmed);

      if (level === 1) {
        htmlResult.push(`<h1 style="font-size: 1.8rem; font-weight: 800; color: #111827; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${cleanHeadingText}</h1>`);
      } else if (level === 2) {
        htmlResult.push(`<h2 style="font-size: 1.4rem; font-weight: 700; color: #1f2937; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px;">${cleanHeadingText}</h2>`);
      } else {
        htmlResult.push(`<h3 style="font-size: 1.15rem; font-weight: 600; color: #374151; margin-top: 20px; margin-bottom: 10px;">${cleanHeadingText}</h3>`);
      }
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemContent = trimmed.substring(2).trim();
      if (!inList || listType !== 'ul') {
        closeListIfNeeded();
        inList = true;
        listType = 'ul';
        htmlResult.push('<ul style="padding-left: 24px; margin: 12px 0; color: #374151;">');
      }
      htmlResult.push(`<li style="margin-bottom: 6px; line-height: 1.6;">${inlineFormat(itemContent)}</li>`);
      continue;
    }

    const matchNumbered = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (matchNumbered) {
      const itemContent = matchNumbered[2].trim();
      if (!inList || listType !== 'ol') {
        closeListIfNeeded();
        inList = true;
        listType = 'ol';
        htmlResult.push('<ol style="padding-left: 24px; margin: 12px 0; color: #374151;">');
      }
      htmlResult.push(`<li style="margin-bottom: 6px; line-height: 1.6;">${inlineFormat(itemContent)}</li>`);
      continue;
    }

    closeListIfNeeded();

    if (trimmed === '') {
      continue;
    }

    htmlResult.push(`<p style="margin-bottom: 12px; line-height: 1.7; color: #374151;">${inlineFormat(line)}</p>`);
  }

  closeListIfNeeded();
  closeBlockquoteIfNeeded();

  return htmlResult.join('\n');
};


export interface ChatTurn {
  query: string;
  answer: string;
  sources: CitedSource[];
}

import { useClerk, useUser } from '@clerk/clerk-react';
import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, Mic, ArrowUp, Sparkles, Activity, Copy, Download, Printer, 
  RotateCw, ShieldCheck, HelpCircle, ArrowRight, 
  BatteryCharging, TrendingUp, X, LogOut, User as UserIcon, 
  Settings, AlertTriangle, Brain, Loader2, Sun, Moon
} from 'lucide-react';
import emblemImg from '../assets/emblem_clean.png';
import logoCleanImg from '../assets/logo_clean.png';

interface WorkspaceProps {
  activeQuery: string | null;
  onSubmitQuery: (query: string) => void;
  isLoading: boolean;
  isHistoryLoading: boolean;
  streamingText: string;
  sources: CitedSource[];
  error: string | null;
  onRetryError: () => void;
  onToggleTrace: () => void;
  isTraceOpen: boolean;
  progressText?: string;
  inputValue: string;
  setInputValue: (val: string) => void;
  followUps: string[];
  isListening: boolean;
  onToggleListen: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
  onViewTrace: () => void;
  activeTaskId: string | null;
  chatHistory: ChatTurn[];
}

export const Workspace: React.FC<WorkspaceProps> = ({
  activeQuery,
  onSubmitQuery,
  isLoading,
  isHistoryLoading,
  streamingText,
  sources,
  error,
  onRetryError,
  onToggleTrace,
  isTraceOpen,
  progressText = "4/5 sub-queries answered",
  inputValue,
  setInputValue,
  followUps,
  isListening,
  onToggleListen,
  onExportMarkdown,
  onExportPDF,
  onViewTrace,
  activeTaskId,
  chatHistory
}) => {
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('mara_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('mara_theme', theme);
  }, [theme]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Compute effective follow-up questions
  const effectiveFollowUps = (followUps && followUps.length > 0)
    ? followUps
    : (activeQuery ? [
        `What are the key technical challenges in ${activeQuery}?`,
        `How does ${activeQuery} compare to current industry standards?`,
        `What are the future developments expected for ${activeQuery}?`
      ] : []);

  // Auto-scroll to bottom of streaming text as it updates
  useEffect(() => {
    if (isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, isLoading]);

  // Skeleton loading UI when fetching history turns
  if (isHistoryLoading) {
    return (
      <div className="flex-grow flex flex-col h-screen overflow-hidden bg-surface-container-lowest relative">
        <header className="bg-background/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center h-16 px-gutter w-full shrink-0">
          <div className="h-6 w-32 bg-surface-variant/20 rounded animate-pulse" />
          <div className="h-8 w-8 bg-surface-variant/20 rounded-full animate-pulse" />
        </header>
        <main className="flex-grow p-container-padding overflow-y-auto flex flex-col gap-8 max-w-4xl mx-auto w-full mt-10">
          <div className="space-y-3">
            <div className="h-4 bg-surface-variant/30 rounded w-1/3 animate-pulse" />
            <div className="h-8 bg-surface-variant/30 rounded w-2/3 animate-pulse" />
          </div>
          <div className="glass-panel p-8 rounded-3xl space-y-4 bg-surface-container-low border border-white/5 h-64 animate-pulse">
            <div className="h-4 bg-surface-variant/20 rounded w-full animate-pulse" />
            <div className="h-4 bg-surface-variant/20 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-surface-variant/20 rounded w-4/6 animate-pulse" />
            <div className="h-4 bg-surface-variant/20 rounded w-full animate-pulse" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-3 bg-surface-variant/10 rounded w-24 animate-pulse" />
            <div className="h-10 bg-surface-variant/10 rounded w-full animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputValue.trim()) {
      onSubmitQuery(inputValue.trim());
    }
  };

  const handleSuggestionClick = (query: string) => {
    setInputValue(query);
    onSubmitQuery(query);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(streamingText);
    alert('Research findings copied to clipboard!');
  };

  return (
    <>
      <div className="flex-grow flex flex-col h-screen overflow-hidden bg-surface-container-lowest relative">
      {/* Top App Bar Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 flex justify-between items-center h-16 px-gutter w-full z-40 shrink-0">
        <div className="flex items-center gap-3">
          <img src={emblemImg} alt="MARA Emblem" className="w-7 h-7 object-contain flex-shrink-0" />
          <span className="font-headline-sm text-lg tracking-widest text-primary font-extrabold leading-none">
            MARA
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pl-6">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-on-surface-variant hover:text-primary transition-all rounded-lg border border-white/5 hover:bg-surface-variant/30 active:scale-90 cursor-pointer flex items-center justify-center group"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500 group-hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>
            <button 
              onClick={onToggleTrace}
              className={`text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer ${
                isTraceOpen ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/5 hover:bg-surface-variant/30'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span className="text-xs font-semibold">Trace</span>
            </button>
            <img 
              onClick={() => setIsProfileOpen(true)}
              alt={user?.firstName || 'User Profile'}
              className="w-8 h-8 rounded-full border border-primary/30 cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/50 transition-all select-none"
              src={user?.imageUrl}
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow overflow-hidden flex flex-col relative">
        {!activeQuery ? (
          /* Landing/Welcome View (Empty State) */
          <div className="flex-grow overflow-y-auto p-container-padding flex flex-col items-center justify-center max-w-3xl mx-auto w-full pb-32">
            <div className="text-center mb-8">
              <img src={logoCleanImg} alt="MARA Logo" className="h-28 object-contain mx-auto mb-6 filter drop-shadow-[0_0_20px_rgba(75,142,255,0.35)] animate-pulse" />
              <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">
                What would you like to research today?
              </h2>
              <p className="text-sm text-on-surface-variant max-w-lg mx-auto leading-relaxed">
                Enter your research topic. MARA will decompose your query, scrape academic and web sources, and synthesize verified findings.
              </p>
            </div>

            {/* Centered Search Bar */}
            <form onSubmit={handleSubmit} className="w-full relative flex items-center bg-surface-container border border-outline-variant rounded-[32px] p-2.5 shadow-xl hover:border-primary/30 transition-all focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 max-w-2xl">
              <div className="absolute left-5 text-on-surface-variant flex items-center">
                <Search className="w-5 h-5 opacity-70" />
              </div>
              <input
                type="text"
                placeholder="Search research topics..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full bg-transparent border-none py-3 pl-10 pr-24 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-0 placeholder:text-on-surface-variant/40"
              />
              <div className="absolute right-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleListen}
                  className={`p-2.5 transition-colors rounded-full hover:bg-surface-variant/40 cursor-pointer ${
                    isListening ? 'text-error bg-error/15 animate-pulse' : 'text-on-surface-variant hover:text-primary'
                  }`}
                  title={isListening ? "Listening... click to stop" : "Start voice search"}
                >
                  <Mic className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-primary text-slate-950 w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 shadow-md active:scale-95 cursor-pointer"
                >
                  <ArrowUp className="w-5 h-5 font-extrabold text-slate-950" />
                </button>
              </div>
            </form>

            {/* Example Chips */}
            <div className="flex flex-wrap gap-3 justify-center mt-6 max-w-xl">
              <button
                onClick={() => handleSuggestionClick('Latest breakthroughs in solid-state batteries')}
                className="px-4 py-2 rounded-full border border-primary/30 bg-primary-container/10 text-primary font-medium text-xs flex items-center gap-2 hover:bg-primary-container/20 transition-all shadow-[0_0_12px_rgba(75,142,255,0.05)] border-solid active:scale-95 cursor-pointer"
              >
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>Latest breakthroughs in solid-state batteries</span>
              </button>
              <button
                onClick={() => handleSuggestionClick('Impact of LLMs on urban planning')}
                className="px-4 py-2 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Impact of LLMs on urban planning</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Query View (Results State) */
          <div className="flex-grow overflow-y-auto p-container-padding flex flex-col gap-10 pb-40">
            <div className="w-full max-w-4xl mx-auto mt-4 flex flex-col gap-8">
              
              {/* Past Turns History */}
              {chatHistory && chatHistory.map((turn, index) => (
                <div key={`turn-${index}`} className="flex flex-col gap-6 border-b border-slate-200 dark:border-white/5 pb-10">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-2">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Research Aspect</span>
                      <h2 className="text-lg font-bold text-on-surface mt-0.5">{turn.query}</h2>
                    </div>
                  </div>
                  <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-slate-200 dark:border-white/5 bg-surface-container-low">
                    <div className="font-body-lg text-body-lg text-on-surface-variant space-y-6 leading-relaxed"
                         dangerouslySetInnerHTML={{ __html: parseMarkdown(turn.answer) }}
                    />
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 w-fit mt-5 select-none animate-fadeIn">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Critic Verdict: Passed</span>
                    </div>
                  </div>
                  
                  {/* Action buttons for past turns */}
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(turn.answer);
                        alert('Research findings copied to clipboard!');
                      }}
                      className="text-xs font-bold bg-surface-variant/40 hover:bg-surface-bright text-on-surface py-2 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([turn.answer], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `research_${turn.query.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs font-bold bg-surface-variant/40 hover:bg-surface-bright text-on-surface py-2 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Markdown</span>
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          const formattedHtml = convertMarkdownToPrintHtml(turn.answer);
                          printWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                              <head>
                                <title>MARA Research Report: ${turn.query}</title>
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
                                <h1 style="color: #2563eb;">Research Topic: ${turn.query}</h1>
                                <hr/>
                                <div>${formattedHtml}</div>
                                ${turn.sources && turn.sources.length > 0 ? `
                                  <div class="sources">
                                    <h2 style="font-size: 1.2rem; font-weight: 700; color: #111827;">Cited Sources</h2>
                                    ${turn.sources.map(s => `
                                      <div class="source-item">
                                        <div class="source-title">[${s.id}] ${s.title}</div>
                                        <a class="source-url" href="${s.url}" target="_blank">${s.url}</a>
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
                        }
                      }}
                      className="text-xs font-bold bg-surface-variant/40 hover:bg-surface-bright text-on-surface py-2 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print PDF</span>
                    </button>
                  </div>

                  <CitedSources sources={turn.sources} />

                  {/* Follow-Up Question Cards for Completed Turn */}
                  {index === chatHistory.length - 1 && !isLoading && !streamingText && effectiveFollowUps.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/5 animate-fadeIn">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                          Suggested Follow-Up Research
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {effectiveFollowUps.map((q, qIdx) => (
                          <button
                            key={`turn-followup-${qIdx}`}
                            onClick={() => {
                              setInputValue('');
                              onSubmitQuery(q);
                            }}
                            className="group flex flex-col justify-between p-4 rounded-2xl bg-surface-container/80 hover:bg-surface-container-high border border-white/5 hover:border-primary/40 transition-all text-left cursor-pointer active:scale-[0.98] shadow-sm hover:shadow-md min-h-[100px]"
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <HelpCircle className="w-4 h-4 text-primary/80 group-hover:text-primary flex-shrink-0 mt-0.5" />
                              <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </div>
                            <p className="text-xs font-semibold text-on-surface-variant group-hover:text-on-surface line-clamp-3 leading-relaxed">
                              {q}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Currently Streaming Turn */}
              {(isLoading || streamingText) && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-4">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Active Query</span>
                      <h2 className="text-xl font-bold text-on-surface mt-0.5">{activeQuery}</h2>
                    </div>
                  </div>

                  {/* Synthesizing / Loading Indicator */}
                  {isLoading && (
                    <div className="flex items-center gap-3 text-secondary font-bold text-sm bg-secondary-container/10 p-4 rounded-2xl w-fit shadow-sm border border-secondary/10 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span>Synthesizing findings...</span>
                      <span className="ml-6 text-xs font-normal text-on-surface-variant">
                        {progressText}
                      </span>
                    </div>
                  )}

                  {/* Streaming Text Content */}
                  {streamingText ? (
                    <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-slate-200 dark:border-white/5">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl"></div>
                      <div className={`font-body-lg text-body-lg text-on-surface-variant space-y-6 leading-relaxed ${isLoading ? 'typing-cursor' : ''}`}
                           dangerouslySetInnerHTML={{ __html: parseMarkdown(streamingText) }}
                      />
                      {!isLoading && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 w-fit mt-5 select-none animate-fadeIn">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Critic Verdict: Passed</span>
                        </div>
                      )}
                    </div>
                  ) : isLoading ? (
                    <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-white/5 flex flex-col items-center justify-center h-64 text-center mt-4 bg-surface-container-lowest/50">
                      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
                      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse"></div>
                      <Brain className="w-12 h-12 text-primary/40 animate-bounce mb-4" />
                      <h3 className="text-lg font-bold text-on-surface mb-2 tracking-wide">Analyzing your query...</h3>
                      <p className="text-sm text-on-surface-variant/70 max-w-sm">
                        Our multi-agent system is currently searching, scraping, and verifying real-time information across the web.
                      </p>
                    </div>
                  ) : null}

              {/* Cited Sources section */}
              <CitedSources sources={sources} />

              {/* Follow-up Suggested Questions */}
              {followUps && followUps.length > 0 && !isLoading && (
                <div className="mt-10 flex flex-col gap-4 animate-fadeIn">
                  <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">assistant</span>
                    <span>Suggested Follow-up Questions</span>
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {followUps.slice(0, 3).map((question, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setInputValue('');
                          onSubmitQuery(question);
                        }}
                        className="text-left p-5 rounded-2xl bg-surface-container hover:bg-surface-variant/30 border border-white/5 text-sm text-on-surface-variant hover:text-primary transition-all flex flex-col justify-between group active:scale-[0.98] border-solid relative overflow-hidden shadow-md hover:shadow-lg min-h-[120px]"
                      >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        <p className="font-semibold text-xs leading-relaxed group-hover:text-on-surface transition-colors pr-2 mb-4">
                          {question}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary opacity-80 group-hover:opacity-100 mt-auto">
                          <span>Search topic</span>
                          <span className="material-symbols-outlined text-[14px] transform group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Failure Indicator (Partial Error) */}
              {error && (
                <div className="bg-error-container/10 border border-error/20 rounded-2xl p-4 flex items-center justify-between mt-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-error flex-shrink-0" />
                    <span className="text-sm text-on-surface-variant font-code-md">
                      {error}
                    </span>
                  </div>
                  <button
                    onClick={onRetryError}
                    className="text-xs text-error hover:bg-error/10 border border-error/30 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold active:scale-95 cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Post-Answer Actions */}
              {streamingText && !isLoading && (
                <div className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t border-slate-200 dark:border-white/5">
                  <button
                    onClick={handleCopyText}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={onExportMarkdown}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Markdown</span>
                  </button>
                  <button
                    onClick={onExportPDF}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print PDF</span>
                  </button>
                  {activeTaskId && onViewTrace && (
                    <button
                      onClick={onViewTrace}
                      className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-primary py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-primary/20 cursor-pointer"
                    >
                      <Activity className="w-4 h-4" />
                      <span>View Trace</span>
                    </button>
                  )}
                  <button
                    onClick={() => onSubmitQuery(activeQuery!)}
                    className="text-xs font-bold text-primary hover:bg-primary-container/10 py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all ml-auto active:scale-95 border border-primary/20 cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Regenerate</span>
                  </button>
                </div>
              )}

              {/* Bottom Input Area */}
              {activeQuery && (
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/95 to-transparent p-8 pt-16 z-30 shrink-0">
                  <div className="w-full max-w-3xl mx-auto">
                    <form 
                      onSubmit={handleSubmit}
                      className="relative flex items-center w-full bg-surface-container rounded-[32px] p-2.5 shadow-lg border border-white/5 focus-within:ring-2 focus-within:ring-primary/50 transition-all"
                    >
                       <input
                        type="text"
                        placeholder="Ask a follow up or start new research..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full bg-transparent border-none py-3 px-4 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-0 placeholder:text-on-surface-variant/40"
                      />
                      <div className="flex items-center gap-2 flex-shrink-0 pr-1.5">
                        <button 
                          type="button" 
                          onClick={onToggleListen}
                          className={`p-3 transition-colors rounded-full hover:bg-surface-variant/30 cursor-pointer ${
                            isListening ? 'text-error bg-error/15 animate-pulse' : 'text-on-surface-variant hover:text-primary'
                          }`}
                          title={isListening ? "Listening... click to stop" : "Start voice input"}
                        >
                          <Mic className="w-5 h-5" />
                        </button>
                        <button
                          type="submit"
                          disabled={!inputValue.trim() || isLoading}
                          className="bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-fixed transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-md active:scale-95 cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ArrowUp className="w-5 h-5 font-bold" />
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Interactive Follow-Up Question Cards */}
              {!isLoading && effectiveFollowUps.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5 animate-fadeIn">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      auto_awesome
                    </span>
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Suggested Follow-Up Research
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {effectiveFollowUps.map((q, idx) => (
                      <button
                        key={`followup-card-${idx}`}
                        onClick={() => onSubmitQuery(q)}
                        className="group flex flex-col justify-between p-4 rounded-2xl bg-surface-container/60 hover:bg-surface-container-high border border-white/5 hover:border-primary/40 transition-all text-left cursor-pointer active:scale-[0.98] shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="material-symbols-outlined text-primary/80 group-hover:text-primary text-[18px] flex-shrink-0 mt-0.5">
                            help_outline
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            arrow_forward
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-on-surface-variant group-hover:text-on-surface line-clamp-3 leading-relaxed">
                          {q}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

              {/* Dummy anchor to scroll to */}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {/* Bottom Input Area (ChatGPT Style, Screen B) - only visible when a query has been started */}
        {activeQuery && (
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/95 to-transparent p-8 pt-16 z-30 shrink-0">
            <div className="w-full max-w-3xl mx-auto">
              <form 
                onSubmit={handleSubmit}
                className="relative flex items-center w-full bg-surface-container rounded-[32px] p-2.5 shadow-lg border border-slate-300 dark:border-white/10 focus-within:ring-2 focus-within:ring-primary/50 transition-all"
              >
                 <input
                  type="text"
                  placeholder="Ask a follow up or start new research..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-transparent border-none py-3 px-4 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-0 placeholder:text-on-surface-variant/40"
                />
                <div className="flex items-center gap-2 flex-shrink-0 pr-1.5">
                  <button 
                    type="button" 
                    onClick={onToggleListen}
                    className={`p-3 transition-colors rounded-full hover:bg-surface-variant/30 cursor-pointer ${
                      isListening ? 'text-error bg-error/15 animate-pulse' : 'text-on-surface-variant hover:text-primary'
                    }`}
                    title={isListening ? "Listening... click to stop" : "Start voice input"}
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-primary text-slate-950 w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 shadow-md active:scale-95 cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                    ) : (
                      <ArrowUp className="w-5 h-5 font-extrabold text-slate-950" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>

      {isProfileOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-fadeIn">
          <div className="bg-surface-container-low border border-white/10 w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl flex flex-col p-6 text-on-surface">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <span>User Profile Settings</span>
              </h3>
              <button 
                onClick={() => setIsProfileOpen(false)}
                className="p-1.5 hover:bg-surface-variant/40 rounded-full text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Info Card */}
            <div className="flex items-center gap-4 p-4 bg-surface-container rounded-2xl border border-white/5 mb-6">
              {user?.imageUrl && (
                <img src={user.imageUrl} className="w-12 h-12 rounded-full ring-2 ring-primary/20" alt="Avatar" />
              )}
              <div className="min-w-0 flex-grow">
                <h4 className="font-bold text-base truncate">{user?.fullName || user?.firstName || 'Researcher'}</h4>
                <p className="text-xs text-on-surface-variant/80 truncate mt-0.5">{user?.primaryEmailAddress?.emailAddress || ''}</p>
              </div>
            </div>

            {/* Clerk Account Manager Buttons */}
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => {
                  setIsProfileOpen(false);
                  openUserProfile();
                }}
                className="w-full py-3 px-4 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] border border-primary/20 cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>Manage Clerk Account</span>
              </button>
              <button 
                onClick={() => {
                  setIsProfileOpen(false);
                  signOut();
                }}
                className="w-full py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] border border-red-500/30 cursor-pointer shadow-sm"
              >
                <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Theme Selector */}
            <div className="mb-5">
              <label className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest mb-2.5">Theme Selector</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setTheme('dark')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    theme === 'dark' 
                      ? 'bg-surface-container-high border border-primary text-primary' 
                      : 'bg-surface-container/40 border border-white/5 hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  Dark
                </button>
                <button 
                  onClick={() => setTheme('light')}
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    theme === 'light' 
                      ? 'bg-surface-container-high border border-primary text-primary' 
                      : 'bg-surface-container/40 border border-white/5 hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  Light
                </button>
                <button 
                  onClick={() => {
                    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    setTheme(isDark ? 'dark' : 'light');
                  }}
                  className="py-2.5 px-3 rounded-lg bg-surface-container/40 border border-white/5 hover:bg-surface-container-high text-xs font-medium text-on-surface-variant transition-all cursor-pointer"
                >
                  System
                </button>
              </div>
            </div>

            {/* Model settings (Minimal / Non-working) */}
            <div className="mb-5">
              <label className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest mb-2.5">Model Settings</label>
              <select disabled className="w-full bg-surface-container/40 border border-white/5 text-on-surface-variant rounded-xl p-3 text-xs font-semibold focus:outline-none opacity-80 cursor-not-allowed">
                <option>GPT-4o-Mini (Research Default)</option>
                <option>Gemini 2.5 Flash</option>
                <option>Claude Sonnet 3.5</option>
              </select>
            </div>

            {/* API Key settings (Minimal / Non-working) */}
            <div>
              <label className="block text-[10px] font-bold text-on-surface-variant/70 uppercase tracking-widest mb-2.5">Custom API Keys</label>
              <input 
                type="password" 
                disabled 
                placeholder="sk-proj-••••••••••••••••" 
                className="w-full bg-surface-container/40 border border-white/5 text-on-surface-variant rounded-xl p-3 text-xs font-code-md focus:outline-none opacity-80 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default Workspace;
