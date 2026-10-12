import React, { useEffect, useRef } from 'react';
import { AudioEngine } from '../../audio/AudioEngine';

export const Oscilloscope: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engine = AudioEngine.getInstance();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const timeData = new Uint8Array(2048);

    const render = () => {
      engine.getTimeDomainData(timeData);

      const width = canvas.width;
      const height = canvas.height;

      // Dark background with subtle grid lines
      ctx.fillStyle = '#080c16';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.moveTo(0, height / 4);
      ctx.lineTo(width, height / 4);
      ctx.moveTo(0, (3 * height) / 4);
      ctx.lineTo(width, (3 * height) / 4);
      ctx.stroke();

      // Find first zero-crossing for wave stabilization
      let startIdx = 0;
      for (let i = 0; i < timeData.length - 1; i++) {
        if (timeData[i] < 128 && timeData[i + 1] >= 128) {
          startIdx = i;
          break;
        }
      }

      // Draw neon wave line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();

      const sliceWidth = width / (timeData.length - startIdx);
      let x = 0;

      for (let i = startIdx; i < timeData.length; i++) {
        const v = timeData[i] / 128.0; // 0 to 2
        const y = (v * height) / 2;

        if (i === startIdx) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0; // Reset blur

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [engine]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#080c16]">
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="w-full h-48 block"
      />
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <span className="badge badge-cyan text-xs">TIME-DOMAIN OSCILLOSCOPE</span>
        <span className="text-[11px] font-mono text-slate-400">Raw Acoustic Pressure Wave</span>
      </div>
    </div>
  );
};
