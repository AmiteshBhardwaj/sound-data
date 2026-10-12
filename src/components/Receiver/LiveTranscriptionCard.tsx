import React, { useState } from 'react';
import type { DecodedPacket, ReceiverState } from '../../types/protocol';
import { Radio, Copy, Check, Sparkles } from 'lucide-react';

interface Props {
  receiverState: ReceiverState;
  partialText: string;
  partialProgress: number;
  latestPacket: DecodedPacket | null;
  isListening: boolean;
}

export const LiveTranscriptionCard: React.FC<Props> = ({
  receiverState,
  partialText,
  partialProgress,
  latestPacket,
  isListening
}) => {
  const [copied, setCopied] = useState(false);

  const isReceiving =
    receiverState === 'sync_locked' ||
    receiverState === 'receiving_header' ||
    receiverState === 'receiving_payload';

  const isPreamble = receiverState === 'preamble_detected';

  const displayText = isReceiving
    ? partialText
    : latestPacket
    ? latestPacket.payloadText
    : '';

  const handleCopy = () => {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`glass-card relative p-4 sm:p-5 transition-all duration-300 overflow-hidden ${
        isReceiving
          ? 'glow-emerald border-emerald-400/40'
          : isPreamble
          ? 'border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : 'border-white/10'
      }`}
    >
      {/* Ambient background glow while receiving */}
      {isReceiving && (
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isReceiving
                ? 'bg-emerald-400 text-black shadow-[0_0_12px_rgba(0,255,136,0.6)]'
                : 'bg-cyan-500/15 text-cyan-400 border border-cyan-400/30'
            }`}
          >
            {isReceiving ? (
              <Radio className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-white tracking-wide flex items-center gap-2 flex-wrap">
              <span>Live Acoustic Transcription</span>
              {isReceiving && (
                <span className="badge badge-emerald text-[9px] animate-pulse">LIVE DECODING</span>
              )}
              {isPreamble && (
                <span className="badge badge-amber text-[9px] animate-pulse">SYNCING</span>
              )}
            </h3>
          </div>
        </div>
      </div>

      {/* Live Text Body */}
      <div className="my-3.5">
        <div className="glass-inset p-4 sm:p-5 min-h-[95px] flex flex-col justify-center">
          {displayText ? (
            <div className="space-y-3">
              <div className="text-cyan-100 font-mono text-base sm:text-lg font-semibold tracking-wide leading-relaxed break-words max-h-48 overflow-y-auto">
                <span>{displayText}</span>
                {isReceiving && (
                  <span className="inline-block w-2 h-5 ml-1.5 bg-emerald-400 animate-pulse align-middle" />
                )}
              </div>

              {/* Progress bar during live symbol reception */}
              {isReceiving && (
                <div className="space-y-1.5 pt-1">
                  <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100"
                      style={{ width: `${Math.max(10, Math.round(partialProgress * 100))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 text-center flex items-center justify-center min-h-[60px]">
              {isPreamble ? (
                <Radio className="w-5 h-5 text-amber-400 animate-spin" />
              ) : isListening ? (
                <div className="flex items-center justify-center gap-1.5 h-6 opacity-40">
                  <span className="wave-bar" style={{ animationDelay: '0ms' }} />
                  <span className="wave-bar" style={{ animationDelay: '150ms' }} />
                  <span className="wave-bar" style={{ animationDelay: '300ms' }} />
                  <span className="wave-bar" style={{ animationDelay: '450ms' }} />
                  <span className="wave-bar" style={{ animationDelay: '600ms' }} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      {(latestPacket || displayText) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs font-mono text-slate-400">
          <div className="min-w-0">
            {latestPacket && (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold truncate">
                ✓ Last received: {new Date(latestPacket.timestamp).toLocaleTimeString()} ({latestPacket.snrDb} dB SNR)
              </span>
            )}
          </div>

          {displayText && (
            <button
              onClick={handleCopy}
              className="btn btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 whitespace-nowrap ml-auto"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Transcribed Text
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
