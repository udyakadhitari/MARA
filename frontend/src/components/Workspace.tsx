import React, { useEffect, useRef } from 'react';
import { CitedSources } from './CitedSources';
import type { CitedSource } from './CitedSources';

export interface ChatTurn {
  query: string;
  answer: string;
  sources: CitedSource[];
}

interface WorkspaceProps {
  activeQuery: string | null;
  onSubmitQuery: (query: string) => void;
  isLoading: boolean;
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
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of streaming text as it updates
  useEffect(() => {
    if (isLoading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamingText, isLoading]);

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
    <div className="flex-grow flex flex-col h-screen overflow-hidden bg-surface-container-lowest relative">
      {/* Top App Bar Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-white/5 flex justify-between items-center h-16 px-gutter w-full z-40 shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-headline-sm text-headline-sm tracking-tight text-primary font-bold">
            Agentic Trace
          </span>
        </div>
        <div className="flex items-center gap-6">
          {/* Navigation Links */}
          <nav className="hidden md:flex gap-8">
            <a className="text-primary border-b-2 border-primary pb-1 font-body-md text-body-md transition-colors" href="#models">Models</a>
            <a className="text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-colors" href="#logs">Logs</a>
            <a className="text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-colors" href="#docs">Documentation</a>
          </nav>
          
          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            <button 
              onClick={onToggleTrace}
              className={`text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                isTraceOpen ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/5 hover:bg-surface-variant/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">route</span>
              <span className="text-xs font-semibold">Trace</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
            </button>
            <img 
              alt="Researcher Avatar" 
              className="w-8 h-8 rounded-full border border-white/10 cursor-pointer shadow-sm"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeuhXfsQKNq-HBDpp4o3XnHm-7jUh-PyNvnXszsgZwFTAg99zOvySiEXetOSDgMaPumOr6w-iaI28t9f7BgkDxsukx0EWI1WYf4pGV9ryduh14vpRt4JV3u2HoUGjZ4QSmBCeMcFJkm3yZcsrMmporiK1jeUfVH8cBzEEvGCkpjniKhoIvmcmLO3l70HDvrZYm22mQCuFmVzLuBXyHSSlGTJSFYlCBbHEL9V3OkvQdrIZNJwvaA5jxqA"
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
              <div className="w-16 h-16 rounded-3xl bg-primary-container/20 text-primary flex items-center justify-center font-bold shadow-lg border border-primary/10 mx-auto mb-4 animate-pulse">
                <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>biotech</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">
                What would you like to research today?
              </h2>
              <p className="text-sm text-on-surface-variant max-w-lg mx-auto leading-relaxed">
                Enter your research topic. Our multi-agent orchestrator will decompose your query, scrape academic and web sources, and synthesize verified findings.
              </p>
            </div>

            {/* Centered Search Bar */}
            <form onSubmit={handleSubmit} className="w-full relative flex items-center bg-surface-container border border-outline-variant rounded-[32px] p-2.5 shadow-xl hover:border-primary/30 transition-all focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50 max-w-2xl">
              <div className="absolute left-5 text-on-surface-variant flex items-center">
                <span className="material-symbols-outlined text-[22px]">search</span>
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
                  className={`p-2.5 transition-colors rounded-full hover:bg-surface-variant/40 ${
                    isListening ? 'text-error bg-error/15 animate-pulse' : 'text-on-surface-variant hover:text-primary'
                  }`}
                  title={isListening ? "Listening... click to stop" : "Start voice search"}
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-fixed transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-md active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_upward</span>
                </button>
              </div>
            </form>

            {/* Example Chips */}
            <div className="flex flex-wrap gap-3 justify-center mt-6 max-w-xl">
              <button
                onClick={() => handleSuggestionClick('Latest breakthroughs in solid-state batteries')}
                className="px-4 py-2 rounded-full border border-primary/30 bg-primary-container/10 text-primary font-medium text-xs flex items-center gap-2 hover:bg-primary-container/20 transition-all shadow-[0_0_12px_rgba(75,142,255,0.05)] border-solid active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">battery_charging_full</span>
                <span>Latest breakthroughs in solid-state batteries</span>
              </button>
              <button
                onClick={() => handleSuggestionClick('Impact of LLMs on urban planning')}
                className="px-4 py-2 rounded-full border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-medium text-xs flex items-center gap-2 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
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
                <div key={`turn-${index}`} className="flex flex-col gap-6 border-b border-white/5 pb-10">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Research Aspect</span>
                      <h2 className="text-lg font-bold text-on-surface mt-0.5">{turn.query}</h2>
                    </div>
                  </div>
                  <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-white/5 bg-surface-container-low">
                    <div className="font-body-lg text-body-lg text-on-surface-variant space-y-6 leading-relaxed">
                      {turn.answer.split('\n\n').map((paragraph, pIdx) => (
                        <p 
                          key={pIdx}
                          dangerouslySetInnerHTML={{
                            __html: paragraph
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\[(\d+)\]/g, '<sup class="text-primary font-bold cursor-pointer hover:underline">[$1]</sup>')
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <CitedSources sources={turn.sources} />
                </div>
              ))}

              {/* Currently Streaming Turn */}
              {(isLoading || streamingText) && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">Active Query</span>
                      <h2 className="text-xl font-bold text-on-surface mt-0.5">{activeQuery}</h2>
                    </div>
                  </div>

                  {/* Synthesizing / Loading Indicator */}
                  {isLoading && (
                    <div className="flex items-center gap-3 text-secondary font-bold text-sm bg-secondary-container/10 p-4 rounded-2xl w-fit shadow-sm border border-secondary/10 animate-pulse">
                      <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                      <span>Synthesizing findings...</span>
                      <span className="ml-6 text-xs font-normal text-on-surface-variant">
                        {progressText}
                      </span>
                    </div>
                  )}

                  {/* Streaming Text Content */}
                  {streamingText && (
                <div className="glass-panel p-8 rounded-3xl relative overflow-hidden border border-white/5">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl"></div>
                  
                  <div className="font-body-lg text-body-lg text-on-surface-variant space-y-6 leading-relaxed">
                    {/* Render paragraphs cleanly */}
                    {streamingText.split('\n\n').map((paragraph, index, array) => {
                      const isLast = index === array.length - 1;
                      
                      // Check if paragraph contains formulas/code
                      if (paragraph.includes('σ = (L / A)')) {
                        return (
                          <div key={index} className="my-6 bg-surface-container-low rounded-2xl p-6 font-code-md text-code-md text-on-surface/80 overflow-x-auto relative shadow-inner border border-white/5">
                            <div className="absolute top-3 right-4 text-on-surface-variant/40 text-[10px] uppercase font-bold tracking-wider select-none">Formula</div>
                            <code>σ = (L / A) * (1 / R)</code>
                            <span className="text-on-surface-variant/50 mt-2 block font-code-md">// Where σ is ionic conductivity, approaching 10^-2 S/cm for advanced sulfides.</span>
                          </div>
                        );
                      }
                      
                      return (
                        <p 
                          key={index}
                          className={`${isLast && isLoading ? 'typing-cursor' : ''}`}
                          dangerouslySetInnerHTML={{
                            // Super simple regex parser for bold text and citations
                            __html: paragraph
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\[(\d+)\]/g, '<sup class="text-primary font-bold cursor-pointer hover:underline">[$1]</sup>')
                              .replace(/`LiNbO3`/g, '<span class="font-code-md text-code-md bg-surface-variant px-2 py-1 rounded-lg text-tertiary">LiNbO3</span>')
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cited Sources section */}
              <CitedSources sources={sources} />

              {/* Follow-up Suggested Questions */}
              {followUps && followUps.length > 0 && !isLoading && (
                <div className="mt-8 flex flex-col gap-3 animate-fadeIn">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">help</span>
                    <span>Suggested Follow-up Questions</span>
                  </span>
                  <div className="flex flex-col gap-2">
                    {followUps.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => onSubmitQuery(question)}
                        className="text-left w-full p-4 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-white/5 text-sm text-on-surface-variant hover:text-primary transition-all flex items-center justify-between group active:scale-[0.99] border-solid"
                      >
                        <span>{question}</span>
                        <span className="material-symbols-outlined text-[18px] opacity-0 group-hover:opacity-100 transition-opacity text-primary">arrow_forward</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Failure Indicator (Partial Error) */}
              {error && (
                <div className="bg-error-container/10 border border-error/20 rounded-2xl p-4 flex items-center justify-between mt-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-error text-[24px]">warning</span>
                    <span className="text-sm text-on-surface-variant font-code-md">
                      {error}
                    </span>
                  </div>
                  <button
                    onClick={onRetryError}
                    className="text-xs text-error hover:bg-error/10 border border-error/30 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Post-Answer Actions */}
              {streamingText && !isLoading && (
                <div className="flex flex-wrap items-center gap-4 mt-8 pt-8 border-t border-white/5">
                  <button
                    onClick={handleCopyText}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={onExportMarkdown}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>Markdown</span>
                  </button>
                  <button
                    onClick={onExportPDF}
                    className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-on-surface py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-white/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                    <span>Print PDF</span>
                  </button>
                  {activeTaskId && onViewTrace && (
                    <button
                      onClick={onViewTrace}
                      className="text-xs font-bold bg-surface-variant hover:bg-surface-bright text-primary py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all active:scale-95 border border-primary/20"
                    >
                      <span className="material-symbols-outlined text-[18px]">troubleshoot</span>
                      <span>View Trace</span>
                    </button>
                  )}
                  <button
                    onClick={() => onSubmitQuery(activeQuery!)}
                    className="text-xs font-bold text-primary hover:bg-primary-container/10 py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all ml-auto active:scale-95 border border-primary/20"
                  >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                    <span>Regenerate</span>
                  </button>
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
                className="relative flex items-center w-full bg-surface-container rounded-[32px] p-2.5 shadow-lg border border-white/5 focus-within:ring-2 focus-within:ring-primary/50 transition-all"
              >
                <button 
                  type="button" 
                  onClick={() => { setInputValue(''); onSubmitQuery(''); }}
                  className="p-3 text-on-surface-variant hover:text-primary transition-colors rounded-full flex-shrink-0 hover:bg-surface-variant/30 active:scale-95"
                  title="Clear research"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
                <input
                  type="text"
                  placeholder="Ask a follow up or start new research..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-transparent border-none py-3 px-3 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-0 placeholder:text-on-surface-variant/40"
                />
                <div className="flex items-center gap-2 flex-shrink-0 pr-1.5">
                  <button 
                    type="button" 
                    onClick={onToggleListen}
                    className={`p-3 transition-colors rounded-full hover:bg-surface-variant/30 ${
                      isListening ? 'text-error bg-error/15 animate-pulse' : 'text-on-surface-variant hover:text-primary'
                    }`}
                    title={isListening ? "Listening... click to stop" : "Start voice input"}
                  >
                    <span className="material-symbols-outlined">mic</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center hover:bg-primary-fixed transition-all disabled:opacity-50 disabled:hover:bg-primary shadow-md active:scale-95"
                  >
                    {isLoading ? (
                      <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default Workspace;
