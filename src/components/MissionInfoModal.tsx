import React from 'react';
import { X, Cpu, Radio, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MissionInfoModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-cyan-500/30 glow-cyan relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="badge badge-crimson text-xs font-bold">SW-41</div>
          <h3 className="font-extrabold text-xl text-white">Mission Architecture & DSP Specs</h3>
        </div>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <h4 className="font-semibold text-cyan-300 flex items-center gap-2 mb-1">
              <Radio className="w-4 h-4 text-cyan-400" /> The Challenge
            </h4>
            <p className="text-xs text-slate-300">
              Transmit digital data between two nearby devices using acoustic sound waves (speaker to microphone) in environments where Wi-Fi, Bluetooth, or cables are prohibited, unavailable, or air-gapped.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Cpu className="w-4 h-4 text-cyan-400" /> 16-FSK Modulation
              </div>
              <p className="text-xs text-slate-400">
                16 distinct orthogonal carrier frequencies carry 4 bits (1 nibble) per symbol. Cosine Tukey windowing eliminates harmonic phase splatter and audio popping.
              </p>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Zap className="w-4 h-4 text-amber-400" /> Chirp & Pilot Sync
              </div>
              <p className="text-xs text-slate-400">
                A linear frequency sweep followed by pilot pulses allows the receiver to locate the frame start with sub-symbol precision despite random background noise.
              </p>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> CRC-16-CCITT Checksum
              </div>
              <p className="text-xs text-slate-400">
                Polynomial 0x1021 verifies payload integrity. Guarantees zero false positives and invalid packets are instantly flagged with CRC mismatch.
              </p>
            </div>

            <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold text-xs">
                <Radio className="w-4 h-4 text-purple-400" /> Dual-Band Support
              </div>
              <p className="text-xs text-slate-400">
                Audible mode (1.6 – 3.4 kHz) works across any speaker/room. Near-ultrasonic mode (18.2 – 19.7 kHz) enables completely silent, stealth acoustic links.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full btn btn-cyan py-2.5 text-sm font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
};
