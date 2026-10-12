import React from 'react';
import type { AudioBand, DecodedPacket, ReceiverState } from '../../types/protocol';
import { LiveTranscriptionCard } from './LiveTranscriptionCard';
import { Mic, MicOff, Radio, CheckCircle2, AlertTriangle, Volume2 } from 'lucide-react';

interface Props {
  isListening: boolean;
  receiverState: ReceiverState;
  packets: DecodedPacket[];
  onClearPackets?: () => void;
  onToggleListening: () => void;
  partialText: string;
  partialProgress: number;
  band: AudioBand;
  onBandChange: (band: AudioBand) => void;
}

export const ReceiverPanel: React.FC<Props> = ({
  isListening,
  receiverState,
  packets,
  onToggleListening,
  partialText,
  partialProgress,
  band,
  onBandChange
}) => {
  const latestPacket = packets.length > 0 ? packets[0] : null;

  const getStatusBadge = () => {
    switch (receiverState) {
      case 'idle':
        return <span className="badge badge-secondary">MIC OFF</span>;
      case 'listening':
        return (
          <span className="badge badge-cyan flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            LISTENING FOR SOUND
          </span>
        );
      case 'preamble_detected':
        return (
          <span className="badge badge-amber flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            PREAMBLE DETECTED
          </span>
        );
      case 'sync_locked':
      case 'receiving_header':
      case 'receiving_payload':
        return (
          <span className="badge badge-emerald flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            DEMODULATING SYMBOLS
          </span>
        );
      case 'packet_received':
        return (
          <span className="badge badge-emerald flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PACKET DECODED
          </span>
        );
      case 'crc_error':
        return (
          <span className="badge badge-crimson flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            CORRUPTED PACKET
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`glass-panel p-5 sm:p-7 space-y-6 transition-all ${
        receiverState === 'sync_locked' || receiverState === 'receiving_payload'
          ? 'glow-emerald'
          : ''
      }`}
    >
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(0,255,136,0.15)]">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white tracking-tight">Receive & Transcribe Sound</h2>
            <p className="text-xs text-slate-400">Listen to acoustic signals & transcribe text in real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">{getStatusBadge()}</div>
      </div>

      {/* Primary Feature: Live Transcription Display */}
      <LiveTranscriptionCard
        receiverState={receiverState}
        partialText={partialText}
        partialProgress={partialProgress}
        latestPacket={latestPacket}
        isListening={isListening}
      />

      {/* Controls Bar: Start Listening Button & Audio Range Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-1">
        <button
          onClick={onToggleListening}
          className={`btn px-6 py-3 text-sm font-bold tracking-wider uppercase transition-all shadow-md shrink-0 whitespace-nowrap ${
            isListening
              ? 'btn-danger shadow-[0_0_20px_rgba(255,51,102,0.25)]'
              : 'btn-emerald shadow-[0_0_20px_rgba(0,255,136,0.25)]'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-4 h-4 shrink-0" />
              <span>STOP LISTENING</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 shrink-0" />
              <span>START LISTENING</span>
            </>
          )}
        </button>

        {/* Sliding Window Audio Range Selector */}
        <div className="audio-range-container shrink-0">
          <span className="audio-range-label">
            <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Audio Range:</span>
          </span>

          {/* Sliding Window Track */}
          <div
            className="audio-range-track"
            role="radiogroup"
            aria-label="Audio Range Selection"
          >
            {/* The Animated Sliding Window Pill */}
            <div className={`audio-range-pill ${band}`} />

            {/* Option 1: Audible */}
            <button
              type="button"
              onClick={() => onBandChange('audible')}
              className={`audio-range-btn ${band === 'audible' ? 'active-audible' : 'inactive'}`}
            >
              <span>Audible</span>
              <span className="audio-range-freq">(1.6–3.4 kHz)</span>
            </button>

            {/* Option 2: Inaudible */}
            <button
              type="button"
              onClick={() => onBandChange('ultrasonic')}
              className={`audio-range-btn ${band === 'ultrasonic' ? 'active-ultrasonic' : 'inactive'}`}
            >
              <span>Inaudible</span>
              <span className="audio-range-freq">(18.2–19.7 kHz)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
