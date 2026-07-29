import React, { useState, useEffect, useRef } from 'react';
import { SquarePlus, LayoutGrid, PanelLeftClose, PanelLeft, Pin, MessageSquare, MoreVertical, Edit3, Trash2, X } from 'lucide-react';
import emblemImg from '../assets/emblem_clean.png';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewResearch: () => void;
  sessionsList: any[];
  currentSessionId: string;
  onSelectSession: (sid: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sidebarWidth: number;
  onResizeStart: (e: React.MouseEvent) => void;
  isResizing?: boolean;
  isHistoryLoading?: boolean;
  pinnedSessions: string[];
  onPinSession: (sid: string) => void;
  onRenameSession: (sid: string) => void;
  onDeleteSession: (sid: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onNewResearch,
  sessionsList,
  currentSessionId,
  onSelectSession,
  isCollapsed,
  onToggleCollapse,
  sidebarWidth,
  onResizeStart,
  isResizing = false,
  isHistoryLoading = false,
  pinnedSessions,
  onPinSession,
  onRenameSession,
  onDeleteSession,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isMobileView, setIsMobileView] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenuSessionId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuSessionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuSessionId]);

  const handleOpenMenu = (e: React.MouseEvent, sid: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
    setActiveMenuSessionId(sid);
  };

  // Sort sessions list: pinned first, then by date descending
  const sortedSessions = [...sessionsList].sort((a, b) => {
    const aPinned = pinnedSessions.includes(a.session_id);
    const bPinned = pinnedSessions.includes(b.session_id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      {/* Mobile Backdrop Blur Overlay */}
      <div 
        onClick={onCloseMobile}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-45 md:hidden transition-opacity duration-700 ease-in-out ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <nav 
        className={`bg-surface-dim/95 backdrop-blur-xl h-screen fixed left-0 top-0 border-r border-white/5 flex flex-col z-50 will-change-transform ${
          isResizing ? 'select-none' : ''
        } ${
          isMobileView
            ? `w-[280px] max-w-[85vw] p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] ${
                isMobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
              }`
            : 'translate-x-0 pointer-events-auto'
        }`}
        style={{ 
          transition: isMobileView ? 'transform 800ms cubic-bezier(0.16, 1, 0.3, 1)' : (isResizing ? 'none' : 'all 300ms ease-in-out'),
          width: !isMobileView ? (isCollapsed ? 72 : sidebarWidth) : undefined, 
          padding: !isMobileView ? (isCollapsed ? '8px' : '16px') : undefined 
        }}
      >
        {/* Drag Resize Handle (only active on desktop when expanded) */}
        {!isCollapsed && (
          <div 
            onMouseDown={onResizeStart}
            className="hidden md:block absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors select-none z-50"
            title="Drag to resize sidebar"
          />
        )}

      {/* Header / Branding */}
      <div className={`flex items-center justify-between mb-8 ${!isMobileView && isCollapsed ? 'flex-col gap-4' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden min-w-0 h-8">
          <img
            src={emblemImg}
            alt="MARA Emblem"
            className="w-8 h-8 flex-shrink-0 object-contain"
          />
          {(!isCollapsed || isMobileView) && (
            <div className="animate-fadeIn min-w-0 flex items-center h-8">
              <h1 className="font-headline-sm text-xl font-extrabold text-primary truncate tracking-widest leading-none my-auto">MARA</h1>
            </div>
          )}
        </div>
        {isMobileView ? (
          <button
            onClick={onCloseMobile}
            className="p-2 hover:bg-surface-variant/30 rounded-xl text-on-surface-variant hover:text-on-surface transition-all active:scale-95 flex-shrink-0 cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-surface-variant/30 rounded-xl text-on-surface-variant hover:text-on-surface transition-all active:scale-95 flex-shrink-0 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-col gap-2">
        {/* New Research CTA */}
        <button
          onClick={() => {
            onNewResearch();
            onCloseMobile?.();
          }}
          className={`flex items-center gap-3 text-on-surface bg-surface-variant/20 hover:bg-surface-variant/40 active:scale-[0.98] rounded-2xl cursor-pointer transition-all mb-4 text-left font-semibold border border-white/5 ${
            !isMobileView && isCollapsed ? 'p-3 justify-center' : 'p-3.5'
          }`}
          title="New Research"
        >
          <SquarePlus className="w-5 h-5 text-primary flex-shrink-0" />
          {(!isCollapsed || isMobileView) && <span className="animate-fadeIn truncate">New Research</span>}
        </button>

        {/* Tab Items */}
        <button
          onClick={() => {
            setActiveTab('workspace');
            onCloseMobile?.();
          }}
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all text-left font-medium active:scale-[0.98] cursor-pointer ${
            activeTab === 'workspace'
              ? 'text-primary bg-primary-container/20 border border-primary/10 shadow-[0_0_12px_rgba(75,142,255,0.05)]'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
          } ${!isMobileView && isCollapsed ? 'justify-center' : ''}`}
          title="Workspace"
        >
          <LayoutGrid className="w-5 h-5 flex-shrink-0" />
          {(!isCollapsed || isMobileView) && <span className="animate-fadeIn truncate">Workspace</span>}
        </button>
      </div>

      {/* Separating Line */}
      <hr className="border-white/5 my-6" />

      {/* History Chat Thread Section */}
      <div className="flex-grow flex flex-col min-h-0">
        {(!isCollapsed || isMobileView) && (
          <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest px-3 mb-3 block animate-fadeIn">
            Research History
          </span>
        )}
        <div className="flex-grow overflow-y-auto hide-scrollbar space-y-2 pr-1">
          {isHistoryLoading && sortedSessions.length === 0 ? (
            (!isCollapsed || isMobileView) && (
              <div className="space-y-2.5 animate-pulse px-2.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-10 bg-white/5 rounded-xl w-full" />
                ))}
              </div>
            )
          ) : sortedSessions.length === 0 ? (
            (!isCollapsed || isMobileView) && (
              <div className="text-[11px] text-on-surface-variant/40 text-center py-4 border border-dashed border-white/5 rounded-xl animate-fadeIn">
                No past sessions.
              </div>
            )
          ) : (
            sortedSessions.map(session => {
              const isSelected = currentSessionId === session.session_id;
              const isPinned = pinnedSessions.includes(session.session_id);
              return (
                <div key={session.session_id} className="relative group w-full flex items-center">
                  <button
                    onClick={() => {
                      onSelectSession(session.session_id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left cursor-pointer active:scale-[0.99] border border-solid ${
                      !isMobileView && isCollapsed ? 'justify-center' : 'pr-10'
                    } ${
                      isSelected
                        ? 'bg-primary/10 border-primary/20 text-primary'
                        : 'bg-transparent border-transparent hover:bg-surface-variant/20 text-on-surface-variant hover:text-on-surface'
                    }`}
                    title={session.running_summary || `Session (${session.session_id.substring(0, 8)})`}
                  >
                    {isPinned ? (
                      <Pin className="w-4 h-4 text-primary flex-shrink-0" />
                    ) : (
                      <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-70" />
                    )}
                    {(!isCollapsed || isMobileView) && (
                      <div className="min-w-0 flex-grow animate-fadeIn">
                        <p className="text-xs font-semibold truncate leading-tight">
                          {session.running_summary || `Session (${session.session_id.substring(0, 8)})`}
                        </p>
                        <p className="text-[9px] text-on-surface-variant/60 truncate mt-0.5 font-code-md">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                      <button
                        onClick={(e) => handleOpenMenu(e, session.session_id)}
                        className="p-1 hover:bg-white/10 rounded text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3-Dot Context Menu */}
      {activeMenuSessionId && menuPosition && (
        <div 
          ref={menuRef}
          className="fixed bg-surface-container rounded-xl border border-white/10 shadow-2xl p-1.5 z-[100] min-w-[120px] animate-fadeIn flex flex-col gap-0.5"
          style={{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }}
        >
          <button
            onClick={() => {
              onPinSession(activeMenuSessionId);
              setActiveMenuSessionId(null);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs font-semibold text-on-surface flex items-center gap-2 cursor-pointer"
          >
            <Pin className="w-3.5 h-3.5 text-primary" />
            <span>{pinnedSessions.includes(activeMenuSessionId) ? 'Unpin' : 'Pin'}</span>
          </button>
          
          <button
            onClick={() => {
              onRenameSession(activeMenuSessionId);
              setActiveMenuSessionId(null);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs font-semibold text-on-surface flex items-center gap-2 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>Rename</span>
          </button>
          
          <hr className="border-white/5 my-1" />
          
          <button
            onClick={() => {
              onDeleteSession(activeMenuSessionId);
              setActiveMenuSessionId(null);
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-error/15 hover:text-error text-xs font-semibold text-on-surface-variant flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-error" />
            <span>Delete</span>
          </button>
        </div>
      )}
    </nav>
  </>
  );
};

export default Sidebar;
