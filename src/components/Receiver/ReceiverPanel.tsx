import React from 'react';
import type { AudioBand, AudioStats, DecodedPacket, ReceiverState, SpeedPreset } from '../../types/protocol';
import { PRESET_CONFIGS } from '../../audio/constants';
import { LiveTranscriptionCard } from './LiveTranscriptionCard';
import { Mic, MicOff, Radio, CheckCircle2, AlertTriangle, Volume2, ShieldCheck, Zap, Sliders } from 'lucide-react';

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
  preset: SpeedPreset;
  onPresetChange: (preset: SpeedPreset) => void;
  sensitivity: number;
  onSensitivityChange: (sens: number) => void;
  stats: AudioStats;
}

export const ReceiverPanel: React.FC<Props> = ({
  isListening,
  receiverState,
  packets,
  onToggleListening,
  partialText,
  partialProgress,
  band,
  onBandChange,
  preset,
  onPresetChange,
  sensitivity,
  onSensitivityChange,
  stats
}) => {
  const latestPacket = packets.length > 0 ? packets[0] : null;
  const pilotSnr = stats.pilotSnrDb ?? 0;
  const isPilotTriggered = pilotSnr >= sensitivity;

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
            <Radio className="w-3.5 h-3.5 animate-spin" />
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

      {/* Real-Time Pilot Preamble Signal Gauge (Active when listening) */}
      {isListening && (
        <div className="bg-black/40 p-3.5 rounded-xl border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-2 text-slate-300">
              <Radio className={`w-3.5 h-3.5 ${isPilotTriggered ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
              <span>Pilot Tone SNR:</span>
              <strong className={isPilotTriggered ? 'text-emerald-400 font-bold' : 'text-cyan-300'}>
                {pilotSnr.toFixed(1)} dB
              </strong>
              <span className="text-slate-500 text-[11px]">(Threshold: {sensitivity.toFixed(1)} dB)</span>
            </span>
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isPilotTriggered ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`}>
              {isPilotTriggered ? 'PILOT ACTIVE (LOCKED)' : 'Awaiting Transmitter Pilot...'}
            </span>
          </div>

          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
            {/* Threshold marker line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
              style={{ left: `${Math.min(100, (sensitivity / 18) * 100)}%` }}
              title={`Trigger threshold: ${sensitivity} dB`}
            />
            {/* Live SNR fill */}
            <div
              className={`h-full transition-all duration-75 ${
                isPilotTriggered
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-300 shadow-[0_0_10px_rgba(0,255,136,0.5)]'
                  : 'bg-cyan-500/50'
              }`}
              style={{ width: `${Math.max(2, Math.min(100, (pilotSnr / 18) * 100))}%` }}
            />
          </div>
        </div>
      )}

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

      {/* Receiver Speed & Sensitivity Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10">
        {/* Speed Preset Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> Expected Speed Preset
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {PRESET_CONFIGS[preset].symbolDurationMs}ms symbols
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['robust', 'balanced', 'fast'] as SpeedPreset[]).map((pKey) => {
              const p = PRESET_CONFIGS[pKey];
              const isSelected = preset === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => onPresetChange(pKey)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-white/10 border-cyan-400 text-white shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1 font-semibold text-xs">
                    {pKey === 'robust' && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                    {pKey === 'balanced' && <Zap className="w-3 h-3 text-cyan-400" />}
                    {pKey === 'fast' && <Zap className="w-3 h-3 text-amber-400" />}
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.symbolDurationMs}ms</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Microphone Sensitivity Mode */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Mic Sensitivity
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Trigger at ≥{sensitivity.toFixed(1)} dB SNR
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 4.5, label: 'High', desc: 'Distant / Quiet' },
              { val: 6.0, label: 'Balanced', desc: 'Standard (rec)' },
              { val: 8.5, label: 'Low', desc: 'Noisy rooms' },
            ].map((s) => {
              const isSelected = Math.abs(sensitivity - s.val) < 0.2;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => onSensitivityChange(s.val)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-white/10 border-emerald-400 text-white shadow-[0_0_10px_rgba(0,255,136,0.2)]'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-xs text-emerald-300">{s.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

