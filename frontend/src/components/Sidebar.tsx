import React from 'react';
import { UserButton, useUser } from '@clerk/clerk-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewResearch: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onNewResearch
}) => {
  return (
    <nav className="bg-surface-dim/80 backdrop-blur-xl w-sidebar-width h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col p-gutter z-50">
      {/* Header / Branding */}
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold shadow-sm">
          <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            biotech
          </span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-primary">Research Lab</h1>
          <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mt-0.5 tracking-wider">
            Multi-Agent Orchestrator
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col gap-2 flex-grow">
        {/* New Research CTA */}
        <button
          onClick={onNewResearch}
          className="flex items-center gap-3 p-3.5 text-on-surface bg-surface-variant/20 hover:bg-surface-variant/40 active:scale-[0.98] rounded-2xl cursor-pointer transition-all mb-4 text-left font-semibold border border-white/5"
        >
          <span className="material-symbols-outlined text-[20px] text-primary">edit_square</span>
          <span>New Research</span>
        </button>

        {/* Tab Items */}
        <button
          onClick={() => setActiveTab('workspace')}
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left font-medium active:scale-[0.98] ${
            activeTab === 'workspace'
              ? 'text-primary bg-primary-container/20 border border-primary/10 shadow-[0_0_12px_rgba(75,142,255,0.05)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">biotech</span>
          <span>Workspace</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left font-medium active:scale-[0.98] ${
            activeTab === 'history'
              ? 'text-primary bg-primary-container/20 border border-primary/10 shadow-[0_0_12px_rgba(75,142,255,0.05)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
          <span>History</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left font-medium active:scale-[0.98] ${
            activeTab === 'library'
              ? 'text-primary bg-primary-container/20 border border-primary/10 shadow-[0_0_12px_rgba(75,142,255,0.05)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">book</span>
          <span>Library</span>
        </button>

        {/* Settings Tab (Pinned to bottom) */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left font-medium active:scale-[0.98] mt-auto ${
            activeTab === 'settings'
              ? 'text-primary bg-primary-container/20 border border-primary/10 shadow-[0_0_12px_rgba(75,142,255,0.05)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span>Settings</span>
        </button>

        {/* User Account - Clerk UserButton */}
        <UserAccountFooter />
      </div>
    </nav>
  );
};

const UserAccountFooter: React.FC = () => {
  const { user } = useUser();
  return (
    <div className="flex items-center gap-3 p-3 mt-3 rounded-2xl bg-surface-variant/20 border border-white/5">
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'w-8 h-8 ring-2 ring-primary/30',
          }
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface truncate">
          {user?.firstName || user?.username || 'Researcher'}
        </p>
        <p className="text-[10px] text-on-surface-variant truncate">
          {user?.primaryEmailAddress?.emailAddress || ''}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
