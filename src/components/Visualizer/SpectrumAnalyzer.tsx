import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';
import { BAND_CONFIGS, getFrequenciesForBand } from '../../audio/constants';
import type { AudioBand } from '../../types/protocol';

interface Props {
  band: AudioBand;
  activeSymbol: number | null;
}

export const SpectrumAnalyzer: React.FC<Props> = ({ band, activeSymbol }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = AudioEngine.getInstance();
  const bandConfig = BAND_CONFIGS[band];
  const freqs = getFrequenciesForBand(band);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const analyser = engine.getAnalyser();
    const binCount = analyser ? analyser.frequencyBinCount : 1024;
    const floatFreq = new Float32Array(binCount);

    const render = () => {
      engine.getFloatFrequencyData(floatFreq);

      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, width, height);

      // Range
      const startFreq = band === 'audible' ? 1000 : 17000;
      const endFreq = band === 'audible' ? 4000 : 20500;
      const maxFreq = engine.getSampleRate() / 2;

      const startBin = Math.floor((startFreq / maxFreq) * binCount);
      const endBin = Math.ceil((endFreq / maxFreq) * binCount);
      const spanBins = endBin - startBin;

      // Draw continuous spectrum curve
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';

      for (let x = 0; x < width; x++) {
        const binIdx = Math.floor(startBin + (x / width) * spanBins);
        const db = floatFreq[binIdx] || -120;
        // Map db (-110 to -20) to height
        const norm = Math.max(0, Math.min(1, (db + 110) / 90));
        const y = height - norm * (height - 20);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Highlight the 16 M-FSK carrier frequencies as vertical pins
      for (let s = 0; s < freqs.length; s++) {
        const f = freqs[s];
        const normX = (f - startFreq) / (endFreq - startFreq);
        if (normX >= 0 && normX <= 1) {
          const x = normX * width;
          const bin = Math.round((f / maxFreq) * binCount);
          const db = floatFreq[bin] || -120;
          const normY = Math.max(0, Math.min(1, (db + 110) / 90));
          const y = height - normY * (height - 20);

          const isActive = (activeSymbol === s);

          // Pin bar
          ctx.beginPath();
          ctx.strokeStyle = isActive ? '#00ff88' : 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = isActive ? 3 : 1;
          ctx.moveTo(x, height);
          ctx.lineTo(x, y);
          ctx.stroke();

          // Symbol marker on top
          ctx.beginPath();
          ctx.arc(x, y, isActive ? 5 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = isActive ? '#00ff88' : '#00f0ff';
          if (isActive) {
            ctx.shadowColor = '#00ff88';
            ctx.shadowBlur = 12;
          }
          ctx.fill();
          ctx.shadowBlur = 0;

          // Hex label
          ctx.fillStyle = isActive ? '#00ff88' : 'rgba(255, 255, 255, 0.5)';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(s.toString(16).toUpperCase(), x, height - 4);
        }
      }

      // Pilot tone pin
      const pilotNormX = (bandConfig.pilotFreq - startFreq) / (endFreq - startFreq);
      if (pilotNormX >= 0 && pilotNormX <= 1) {
        const px = pilotNormX * width;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [band, freqs, bandConfig, activeSymbol, engine]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#080c16]">
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="w-full h-48 block"
      />
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <span className="badge badge-cyan text-xs">M-FSK CARRIER BINS (0x0 – 0xF)</span>
        <span className="text-[11px] font-mono text-slate-400">
          Base: {bandConfig.baseFreq} Hz | Step: {bandConfig.freqStep} Hz
        </span>
      </div>
    </div>
  );
};
