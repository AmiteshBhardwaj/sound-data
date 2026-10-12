import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy, Check, QrCode } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceShareModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const currentUrl = window.location.href;

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="glass-panel w-full max-w-md p-6 space-y-5 border border-cyan-500/30 glow-cyan relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Cross-Device Pairing</h3>
            <p className="text-xs text-slate-400">Scan QR to connect phone or second laptop</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-lg mx-auto w-fit">
          <QRCodeSVG
            value={currentUrl}
            size={180}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* URL Input & Copy */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase">Local Web URL</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="input-field font-mono text-xs select-all"
            />
            <button
              onClick={handleCopy}
              className="btn btn-secondary px-3 py-2 text-xs"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <strong className="text-white">Phone to Laptop transfer:</strong> Open this URL on your phone browser. Keep this computer on "Listen", and hit "Transmit" on your phone!
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full btn btn-cyan py-2.5 text-sm font-semibold"
        >
          Got It, Ready to Test
        </button>
      </div>
    </div>
  );
};
