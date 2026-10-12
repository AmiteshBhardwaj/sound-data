import React from 'react';
import { Radio } from 'lucide-react';

interface Props {
  onGoToPortal?: () => void;
}

export const Header: React.FC<Props> = ({
  onGoToPortal
}) => {
  return (
    <header className="border-b border-white/10 bg-[#080c14]/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Challenge Badge */}
        <button
          onClick={onGoToPortal}
          className="flex items-center gap-3 text-left cursor-pointer group"
          title="Return to Portal Home"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)] group-hover:scale-105 transition-transform">
            <Radio className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              Acoustic Data Link
              <span className="text-xs font-mono text-cyan-400 font-normal hidden sm:inline-block">
                Sound-Based Data Transfer
              </span>
            </h1>
          </div>
        </button>
      </div>
    </header>
  );
};
