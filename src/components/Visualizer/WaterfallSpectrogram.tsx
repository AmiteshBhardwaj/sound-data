import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';
import { BAND_CONFIGS } from '../../audio/constants';
import type { AudioBand } from '../../types/protocol';

interface Props {
  band: AudioBand;
}

// Generate Cyber Colormap (black -> deep blue -> cyan -> yellow -> bright white)
function getColor(value: number): [number, number, number] {
  // value 0..255
  const norm = value / 255;
  if (norm < 0.2) {
    const t = norm / 0.2;
    return [Math.round(8 + t * 10), Math.round(12 + t * 25), Math.round(25 + t * 75)];
  } else if (norm < 0.5) {
    const t = (norm - 0.2) / 0.3;
    return [18, Math.round(37 + t * 203), Math.round(100 + t * 155)];
  } else if (norm < 0.8) {
    const t = (norm - 0.5) / 0.3;
    return [Math.round(t * 255), Math.round(240 + t * 15), Math.round(255 - t * 200)];
  } else {
    const t = (norm - 0.8) / 0.2;
    return [255, Math.round(255 - t * 30), Math.round(55 + t * 200)];
  }
}

export const WaterfallSpectrogram: React.FC<Props> = ({ band }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = AudioEngine.getInstance();
  const bandConfig = BAND_CONFIGS[band];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const analyser = engine.getAnalyser();

    // Create a 2D offscreen canvas for rolling history
    const width = canvas.width;
    const height = canvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    // Fill initial dark
    offCtx.fillStyle = '#080c16';
    offCtx.fillRect(0, 0, width, height);

    const binCount = analyser ? analyser.frequencyBinCount : 1024;
    const freqData = new Uint8Array(binCount);

    const render = () => {
      if (canvasRef.current) {
        engine.getFrequencyData(freqData);

        // Shift existing image down by 2 pixels
        offCtx.drawImage(offscreen, 0, 0, width, height - 2, 0, 2, width, height - 2);

        // Draw new 1-pixel row at top
        const imgData = offCtx.createImageData(width, 2);
        const data = imgData.data;

        // Calculate frequency range to display:
        // Audible: 1 kHz to 4.5 kHz
        // Ultrasonic: 16 kHz to 21 kHz
        const maxFreq = engine.getSampleRate() / 2;
        const startFreq = band === 'audible' ? 800 : 16000;
        const endFreq = band === 'audible' ? 4500 : 21000;

        const startBin = Math.floor((startFreq / maxFreq) * binCount);
        const endBin = Math.min(binCount - 1, Math.ceil((endFreq / maxFreq) * binCount));
        const activeBins = endBin - startBin;

        for (let x = 0; x < width; x++) {
          const binIdx = Math.floor(startBin + (x / width) * activeBins);
          const rawVal = freqData[binIdx] || 0;
          const [r, g, b] = getColor(rawVal);

          // 2 rows of height
          for (let row = 0; row < 2; row++) {
            const pxIdx = (row * width + x) * 4;
            data[pxIdx] = r;
            data[pxIdx + 1] = g;
            data[pxIdx + 2] = b;
            data[pxIdx + 3] = 255;
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        // Copy offscreen canvas to main canvas
        ctx.drawImage(offscreen, 0, 0);

        // Draw frequency guides and pilot tone marker lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Base frequency marker
        const baseNormX = (bandConfig.baseFreq - startFreq) / (endFreq - startFreq);
        if (baseNormX >= 0 && baseNormX <= 1) {
          ctx.beginPath();
          ctx.moveTo(baseNormX * width, 0);
          ctx.lineTo(baseNormX * width, height);
          ctx.stroke();
        }

        // Pilot marker
        const pilotNormX = (bandConfig.pilotFreq - startFreq) / (endFreq - startFreq);
        if (pilotNormX >= 0 && pilotNormX <= 1) {
          ctx.strokeStyle = band === 'audible' ? 'rgba(0, 240, 255, 0.4)' : 'rgba(176, 92, 246, 0.4)';
          ctx.beginPath();
          ctx.moveTo(pilotNormX * width, 0);
          ctx.lineTo(pilotNormX * width, height);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [band, engine, bandConfig]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#080c16]">
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="w-full h-48 block"
      />
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <span className="badge badge-cyan text-xs">WATERFALL SPECTROGRAM</span>
        <span className="text-[11px] font-mono text-slate-400">
          {band === 'audible' ? '0.8 kHz – 4.5 kHz' : '16.0 kHz – 21.0 kHz'}
        </span>
      </div>
      <div className="absolute bottom-2 right-3 flex items-center gap-2 pointer-events-none text-[10px] font-mono text-slate-400">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        LIVE 60 FPS
      </div>
    </div>
  );
};
