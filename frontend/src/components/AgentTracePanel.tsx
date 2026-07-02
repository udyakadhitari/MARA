import React, { useState } from 'react';

export interface AgentStep {
  id: string;
  agent: string;
  message: string;
  status: 'completed' | 'running' | 'pending' | 'failed';
  percentage?: number;
  urls?: string[];
}

interface AgentTracePanelProps {
  steps: AgentStep[];
  isOpen: boolean;
  onClose: () => void;
}

export const AgentTracePanel: React.FC<AgentTracePanelProps> = ({
  steps,
  isOpen,
  onClose
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>('step-search'); // Default expand search to match design

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  return (
    <aside className="w-[340px] bg-surface-container-low flex flex-col h-full flex-shrink-0 relative z-10 shadow-2xl border-l border-white/5">
      {/* Header */}
      <div className="p-6 pb-4 flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">route</span>
          <span>Agent Trace</span>
        </h3>
        <div className="flex items-center gap-4">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
          </span>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center p-1.5 rounded-full hover:bg-surface-variant/30 active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      </div>

      {/* Stepper Content */}
      <div className="flex-grow overflow-y-auto p-6 pt-2">
        <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-gradient-to-b before:from-secondary before:via-primary before:to-white/10">
          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            const isRunning = step.status === 'running';
            const isFailed = step.status === 'failed';
            const isPending = step.status === 'pending';
            const isExpanded = expandedStepId === step.id;

            return (
              <div key={step.id} className={`relative flex items-start group ${isPending ? 'opacity-60' : ''}`}>
                {/* Stepper Icon */}
                <div className={`flex items-center justify-center w-7 h-7 rounded-full absolute -left-[1.5rem] shadow-sm z-10 border ${
                  isCompleted 
                    ? 'bg-secondary-container/20 border-secondary text-secondary' 
                    : isRunning 
                    ? 'bg-primary-container/20 border-primary text-primary shadow-[0_0_12px_rgba(75,142,255,0.3)]'
                    : isFailed 
                    ? 'bg-error-container/20 border-error text-error' 
                    : 'bg-surface-container border-outline-variant text-on-surface-variant'
                }`}>
                  {isCompleted && (
                    <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                  )}
                  {isRunning && (
                    <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                  )}
                  {isFailed && (
                    <span className="material-symbols-outlined text-[15px] font-bold">close</span>
                  )}
                  {isPending && (
                    <span className="block w-2 h-2 bg-on-surface-variant/50 rounded-full"></span>
                  )}
                </div>

                {/* Step Details */}
                <div className="w-full pl-5">
                  <div
                    onClick={() => (step.urls || isRunning) && toggleExpand(step.id)}
                    className={`font-bold text-sm flex items-center justify-between cursor-pointer transition-colors ${
                      isRunning ? 'text-primary' : 'text-on-surface hover:text-primary'
                    }`}
                  >
                    <span>{step.agent}</span>
                    {step.urls && (
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant select-none">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-on-surface-variant font-code-md mt-1">
                    {step.message}
                  </div>

                  {/* Progress Bar for Running Step */}
                  {isRunning && typeof step.percentage === 'number' && (
                    <div className="w-full bg-surface-variant h-1.5 rounded-full mt-3 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500 relative overflow-hidden"
                        style={{ width: `${step.percentage}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-[translateX_1s_infinite]"></div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Content (e.g. URLs for Search) */}
                  {step.urls && isExpanded && (
                    <div className="bg-surface-container rounded-2xl p-3 text-[11px] space-y-2 mt-2 max-h-40 overflow-y-auto shadow-inner border border-white/5 animate-fadeIn">
                      {step.urls.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-on-surface-variant hover:text-primary cursor-pointer truncate p-1 transition-colors">
                          <span className="material-symbols-outlined text-[14px]">link</span>
                          <span>{url}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
export default AgentTracePanel;
