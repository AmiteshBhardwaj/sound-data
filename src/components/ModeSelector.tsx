import React from 'react';
import type { AppMode, ReceiverState } from '../types/protocol';
import { Send, Mic, ArrowLeft } from 'lucide-react';

interface Props {
  mode: AppMode;
  onBackToPortal: () => void;
  isTransmitting: boolean;
  isListening: boolean;
  receiverState: ReceiverState;
}

export const ModeSelector: React.FC<Props> = ({
  mode,
  onBackToPortal,
  isTransmitting,
  isListening,
  receiverState
}) => {
  const isDemodulating =
    receiverState === 'sync_locked' ||
    receiverState === 'receiving_header' ||
    receiverState === 'receiving_payload';

  return (
    <div className="mode-nav-bar">
      {/* Back to Portal button */}
      <button
        onClick={onBackToPortal}
        className="mode-back-btn"
        title="Return to Portal Landing Screen"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Portal Home</span>
      </button>

      {/* Active Mode Indicator */}
      <div className="flex items-center">
        {mode === 'transmit' ? (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-mono font-semibold">
            <Send className="w-3.5 h-3.5 text-purple-400" />
            <span>Transmit View</span>
            {isTransmitting ? (
              <span className="flex items-center gap-1.5 text-amber-300 ml-1">
                <span className="mode-dot-amber" /> Emitting Sound
              </span>
            ) : (
              <span className="text-slate-400 ml-1">Ready</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-200 text-xs font-mono font-semibold">
            <Mic className="w-3.5 h-3.5 text-orange-400" />
            <span>Receive View</span>
            {isDemodulating ? (
              <span className="flex items-center gap-1.5 text-emerald-300 ml-1">
                <span className="mode-dot-emerald" /> Transcribing
              </span>
            ) : isListening ? (
              <span className="flex items-center gap-1.5 text-cyan-300 ml-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Listening
              </span>
            ) : (
              <span className="text-slate-400 ml-1">Mic Off</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
