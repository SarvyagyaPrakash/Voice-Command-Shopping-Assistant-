import React from 'react';
import { Loader2, Server, RefreshCw } from 'lucide-react';

interface BackendStatusNoteProps {
  isBackendReady: boolean;
  onRetry?: () => void;
}

export const BackendStatusNote: React.FC<BackendStatusNoteProps> = ({ isBackendReady, onRetry }) => {
  // As soon as backend is loaded / ready, remove the message
  if (isBackendReady) {
    return null;
  }

  return (
    <aside
      aria-live="polite"
      aria-label="Backend status notice"
      className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[340px] sm:max-w-sm w-[calc(100%-2rem)] sm:w-auto bg-palette-deep/95 text-white p-4 rounded-2xl shadow-card-elevated border border-palette-soft/40 backdrop-blur-md animate-fadeIn"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-palette-primary/20 border border-palette-soft/30 text-palette-soft shrink-0 relative mt-0.5">
          <Loader2 className="w-5 h-5 text-palette-soft animate-spin" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-palette-soft">
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Server Connecting
            </span>
          </div>

          <p className="text-xs font-semibold leading-snug text-white">
            Please wait, the backend might take time to load
          </p>

          <p className="text-[11px] text-palette-light/80 leading-relaxed font-normal">
            Waking up server services and fetching your list. This note will disappear automatically as soon as the backend responds.
          </p>

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-palette-soft hover:text-white transition-all cursor-pointer border border-white/10"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry now</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default BackendStatusNote;
