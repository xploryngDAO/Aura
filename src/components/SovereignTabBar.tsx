import React from 'react';
import { Network, Clock, FolderKanban, MessageSquare, Plus } from 'lucide-react';

export type SovereignTab = 'graph' | 'timeline' | 'vaults' | 'chat';

interface Props {
  activeTab: SovereignTab;
  onTabChange: (tab: SovereignTab) => void;
  onOpenCapture: () => void;
  pendingDecisionCount?: number;
}

export const SovereignTabBar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  onOpenCapture,
  pendingDecisionCount = 0,
}) => {
  return (
    <nav className="h-14 px-6 bg-[#070A12]/90 backdrop-blur-xl border-t border-white/[0.06] flex items-center justify-between max-w-md mx-auto w-full z-30 shrink-0">
      <button
        onClick={() => onTabChange('graph')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeTab === 'graph'
            ? 'text-white bg-white/[0.08]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Network className="w-4 h-4" />
        <span>Grafo</span>
      </button>

      <button
        onClick={() => onTabChange('timeline')}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeTab === 'timeline'
            ? 'text-white bg-white/[0.08]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span>Timeline</span>
        {pendingDecisionCount > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        )}
      </button>

      <button
        onClick={onOpenCapture}
        className="w-8 h-8 rounded-full bg-white text-black hover:bg-slate-200 flex items-center justify-center transition-all active:scale-95 shadow-sm"
        title="Nova Captura"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
      </button>

      <button
        onClick={() => onTabChange('vaults')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeTab === 'vaults'
            ? 'text-white bg-white/[0.08]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <FolderKanban className="w-4 h-4" />
        <span>Vaults</span>
      </button>

      <button
        onClick={() => onTabChange('chat')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeTab === 'chat'
            ? 'text-white bg-white/[0.08]'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>Diálogo</span>
      </button>
    </nav>
  );
};
