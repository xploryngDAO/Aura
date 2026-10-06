import React from 'react';
import { Search, Cpu, Plus, Bell } from 'lucide-react';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  screenshotCount: number;
  clusterCount: number;
  alertCount: number;
  onOpenSpecialist: () => void;
  onOpenCapture: () => void;
  onOpenAlerts: () => void;
}

export const HeaderNav: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  alertCount,
  onOpenSpecialist,
  onOpenCapture,
  onOpenAlerts,
}) => {
  return (
    <header className="h-14 px-4 sm:px-6 bg-[#070A12]/85 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between gap-4 z-30 shrink-0">
      {/* Quiet Brand Identity */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold tracking-tight text-white">AURA</span>
        <span className="text-slate-600 text-xs">/</span>
        <span className="text-xs text-slate-400 font-normal">sovereign brain</span>
      </div>

      {/* Calm, Minimalist Search */}
      <div className="flex-1 max-w-sm mx-auto">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar notas, áudios, capturas..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/20 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Restrained Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenAlerts}
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          title="Insights & Lembretes"
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
          )}
        </button>

        <button
          onClick={onOpenSpecialist}
          className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] text-xs font-medium transition-colors flex items-center gap-1.5"
          title="Aura Specialist (spec-aura)"
        >
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">Agente</span>
        </button>

        <button
          onClick={onOpenCapture}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-slate-200 text-xs font-semibold transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Capturar</span>
        </button>
      </div>
    </header>
  );
};
