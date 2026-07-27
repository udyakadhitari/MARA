import React, { useState } from 'react';
import { Activity, X, Check, Loader2, AlertCircle, ChevronUp, ChevronDown, Link } from 'lucide-react';

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

  const toggleExpand = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  return (
    <aside className={`w-[340px] bg-surface-container-low flex flex-col h-full flex-shrink-0 relative z-10 shadow-2xl border-l border-white/5 transition-all duration-300 ease-in-out ${
      isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full -mr-[340px] opacity-0 pointer-events-none'
    }`}>
      {/* Header */}
      <div className="p-6 pb-4 flex justify-between items-center bg-surface-container-low">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <span>Agent Trace</span>
        </h3>
        <div className="flex items-center gap-4">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
          </span>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center p-1.5 rounded-full hover:bg-surface-variant/30 active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stepper Content */}
      <div className="flex-grow overflow-y-auto p-6 pt-2">
        <div className="relative space-y-8">
          {/* Continuous Theme Blue Connecting Line running behind nodes */}
          <div className="absolute left-[13px] top-3 bottom-3 w-0.5 bg-blue-600 dark:bg-blue-400/80 pointer-events-none z-0" />

          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            const isRunning = step.status === 'running';
            const isFailed = step.status === 'failed';
            const isPending = step.status === 'pending';
            const isExpanded = expandedStepId === step.id;

            return (
              <div key={step.id} className="relative flex items-start group">
                {/* Stepper Icon Node */}
                <div className={`flex items-center justify-center w-7 h-7 rounded-full absolute left-0 top-0 shadow-sm z-10 border bg-white dark:bg-surface-container ${
                  isCompleted 
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                    : isRunning 
                    ? 'border-blue-600 text-blue-600 dark:text-primary shadow-[0_0_12px_rgba(75,142,255,0.3)]'
                    : isFailed 
                    ? 'border-red-500 text-red-500' 
                    : 'border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300'
                }`}>
                  {isCompleted && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 font-bold" />
                  )}
                  {isRunning && (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-primary" />
                  )}
                  {isFailed && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {isPending && (
                    <span className="block w-2.5 h-2.5 bg-slate-700 dark:bg-slate-300 rounded-full"></span>
                  )}
                </div>

                {/* Step Details */}
                <div className="w-full pl-10 pt-0.5">
                  <div
                    onClick={() => (step.urls || isRunning) && toggleExpand(step.id)}
                    className={`font-bold text-sm flex items-center justify-between cursor-pointer transition-colors ${
                      isRunning ? 'text-primary' : 'text-on-surface hover:text-primary'
                    }`}
                  >
                    <span>{step.agent}</span>
                    {step.urls && (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-on-surface-variant" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />
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
                          <Link className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{url}</span>
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
