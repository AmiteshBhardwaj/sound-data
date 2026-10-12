import React, { useState } from 'react';
import { WaterfallSpectrogram } from './WaterfallSpectrogram';
import { Oscilloscope } from './Oscilloscope';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import type { AudioBand, AudioStats } from '../../types/protocol';
import { Activity, BarChart3, Radio } from 'lucide-react';

interface Props {
  band: AudioBand;
  stats: AudioStats;
}

type VisualizerTab = 'waterfall' | 'spectrum' | 'oscilloscope';

export const VisualizerContainer: React.FC<Props> = ({ band, stats }) => {
  const [activeTab, setActiveTab] = useState<VisualizerTab>('waterfall');

  return (
    <div className="glass-panel p-5 space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h2 className="font-semibold text-lg tracking-wide text-white">Acoustic Signal Visualizer</h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('waterfall')}
            className={`btn text-xs py-1.5 px-3 rounded-md transition-all ${
              activeTab === 'waterfall'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Waterfall
          </button>
          <button
            onClick={() => setActiveTab('spectrum')}
            className={`btn text-xs py-1.5 px-3 rounded-md transition-all ${
              activeTab === 'spectrum'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Carrier Bins
          </button>
          <button
            onClick={() => setActiveTab('oscilloscope')}
            className={`btn text-xs py-1.5 px-3 rounded-md transition-all ${
              activeTab === 'oscilloscope'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Oscilloscope
          </button>
        </div>
      </div>

      {/* Main Canvas View */}
      <div className="w-full">
        {activeTab === 'waterfall' && <WaterfallSpectrogram band={band} />}
        {activeTab === 'spectrum' && (
          <SpectrumAnalyzer band={band} activeSymbol={stats.activeSymbol} />
        )}
        {activeTab === 'oscilloscope' && <Oscilloscope />}
      </div>

      {/* Real-Time Acoustic Metrics HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">SNR Level</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl font-mono font-bold ${stats.snrDb > 10 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {Number.isFinite(stats.snrDb) ? stats.snrDb.toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-slate-500 font-mono">dB</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Peak Frequency</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-mono font-bold text-cyan-300">
              {Number.isFinite(stats.peakFrequency) && stats.peakFrequency > 0 ? Math.round(stats.peakFrequency) : '---'}
            </span>
            <span className="text-xs text-slate-500 font-mono">Hz</span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Active Symbol</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className={`text-xl font-mono font-bold ${stats.activeSymbol !== null ? 'text-emerald-400' : 'text-slate-500'}`}>
              {stats.activeSymbol !== null ? `0x${stats.activeSymbol.toString(16).toUpperCase()}` : 'IDLE'}
            </span>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
          <div className="text-[11px] font-mono text-slate-400 uppercase">Noise Floor</div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-mono font-bold text-slate-400">
              {Number.isFinite(stats.noiseFloor) ? stats.noiseFloor.toFixed(1) : '-80.0'}
            </span>
            <span className="text-xs text-slate-500 font-mono">dB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
