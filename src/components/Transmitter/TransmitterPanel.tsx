import React, { useState } from 'react';
import type { AudioBand, SpeedPreset } from '../../types/protocol';
import { PRESET_CONFIGS } from '../../audio/constants';
import { AudioEngine } from '../../audio/AudioEngine';
import { Send, Volume2, ShieldCheck, Zap, RefreshCw, ChevronDown, ChevronUp, Radio } from 'lucide-react';

interface Props {
  band: AudioBand;
  onBandChange: (band: AudioBand) => void;
  preset: SpeedPreset;
  onPresetChange: (preset: SpeedPreset) => void;
  isTransmitting: boolean;
  transmissionProgress: number;
}

export const TransmitterPanel: React.FC<Props> = ({
  band,
  onBandChange,
  preset,
  onPresetChange,
  isTransmitting,
  transmissionProgress
}) => {
  const [text, setText] = useState('');
  const [volume, setVolume] = useState(85);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastTransmittedMsg, setLastTransmittedMsg] = useState<string | null>(null);

  const engine = AudioEngine.getInstance();

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    engine.setVolume(newVol / 100);
  };

  const handleTransmit = async () => {
    if (!text.trim() || isTransmitting) return;
    setLastTransmittedMsg(text.trim());
    await engine.transmitMessage(text.trim(), false);
  };

  const currentPreset = PRESET_CONFIGS[preset];

  // Estimation
  const byteCount = new TextEncoder().encode(text).length;
  // 5 header + (FEC ? 2*bytes : bytes) + 2 CRC -> * 2 symbols
  const encodedPayloadBytes = currentPreset.useFEC ? byteCount * 2 : byteCount;
  const totalSymbols = (5 + encodedPayloadBytes + 2) * 2;
  const estimatedTimeSec = (
    (totalSymbols * (currentPreset.symbolDurationMs + currentPreset.guardDurationMs) + 200) /
    1000
  ).toFixed(1);

  return (
    <div className={`glass-panel p-5 sm:p-6 space-y-6 transition-all ${isTransmitting ? 'glow-cyan' : ''}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Transmit Sound</h2>
            <p className="text-xs text-slate-400">Broadcast text data through speaker sound waves</p>
          </div>
        </div>
        <span className={`badge ${isTransmitting ? 'badge-amber animate-pulse' : 'badge-cyan'}`}>
          {isTransmitting ? 'EMITTING SOUND' : 'TX READY'}
        </span>
      </div>

      {/* Step 1: Type Message */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-bold">1</span>
            Type Message to Transmit
          </label>
          <span className="text-xs text-slate-400 font-mono">
            {text.length} chars • {byteCount} bytes
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message here to transfer over sound waves..."
          disabled={isTransmitting}
          rows={3}
          className="input-field font-mono text-sm leading-relaxed"
        />
      </div>

      {/* Step 2: Transmit Audio Action */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-2 text-cyan-300 font-semibold uppercase">
            <span className="w-4 h-4 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[10px] font-bold">2</span>
            Transfer Audio Wave
          </span>
          <span>Duration: ~{estimatedTimeSec}s</span>
        </div>

        {/* Large Action Button */}
        <button
          onClick={handleTransmit}
          disabled={isTransmitting || !text.trim()}
          className={`w-full btn py-4 text-base font-bold tracking-wide transition-all shadow-lg ${
            band === 'ultrasonic' ? 'btn-violet' : 'btn-cyan'
          }`}
        >
          {isTransmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              EMITTING SOUND WAVE ({Math.round(transmissionProgress * 100)}%)
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              TRANSMIT AUDIO ({band === 'ultrasonic' ? 'ULTRASONIC 18-20k' : 'AUDIBLE 1.6-3.4k'})
            </>
          )}
        </button>

        {/* Active Transmission Waves Animation */}
        {isTransmitting && (
          <div className="space-y-2 bg-black/40 p-3.5 rounded-xl border border-cyan-500/30 animate-pulse">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-300 flex items-center gap-2">
                <Radio className="w-4 h-4 animate-spin text-cyan-400" />
                Playing acoustic carrier tones through speakers...
              </span>
              <span className="text-cyan-400 font-bold">{Math.round(transmissionProgress * 100)}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300 transition-all duration-75"
                style={{ width: `${Math.round(transmissionProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Confirmation banner after transmission */}
        {!isTransmitting && lastTransmittedMsg && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="text-slate-400">Last transmitted:</span>
            <span className="text-cyan-300 truncate max-w-xs font-bold">"{lastTransmittedMsg}"</span>
          </div>
        )}
      </div>

      {/* Advanced Sound Settings (Collapsible) */}
      <div className="border-t border-white/10 pt-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors py-1"
        >
          <span>Advanced Audio & Modulation Settings</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-3 mt-2 border-t border-white/5">
            {/* Frequency Band Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider">
                Acoustic Frequency Band
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onBandChange('audible')}
                  disabled={isTransmitting}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    band === 'audible'
                      ? 'bg-cyan-500/15 border-cyan-400'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-cyan-300">Audible Band</span>
                    <span className="badge badge-cyan text-[9px]">1.6 – 3.4 kHz</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Universal compatibility across all phone & laptop speakers.
                  </p>
                </button>

                <button
                  onClick={() => onBandChange('ultrasonic')}
                  disabled={isTransmitting}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    band === 'ultrasonic'
                      ? 'bg-violet-500/20 border-violet-400'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-purple-300">Near-Ultrasonic</span>
                    <span className="badge badge-violet text-[9px]">18.2 – 19.7 kHz</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Silent transmission inaudible to human ears.
                  </p>
                </button>
              </div>
            </div>

            {/* Speed & Modulation Mode */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Speed Mode & FEC</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentPreset.symbolDurationMs}ms / symbol {currentPreset.useFEC && '(FEC On)'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['robust', 'balanced', 'fast'] as SpeedPreset[]).map((pKey) => {
                  const p = PRESET_CONFIGS[pKey];
                  const isSelected = preset === pKey;
                  return (
                    <button
                      key={pKey}
                      onClick={() => onPresetChange(pKey)}
                      disabled={isTransmitting}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-white/10 border-cyan-400 text-white'
                          : 'bg-black/20 border-white/5 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-semibold text-xs">
                        {pKey === 'robust' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                        {pKey === 'balanced' && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                        {pKey === 'fast' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{p.symbolDurationMs}ms</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speaker Volume */}
            <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Speaker Volume
                </span>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                disabled={isTransmitting}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
