import React, { useState } from 'react';
import type { DecodedPacket } from '../../types/protocol';
import { CheckCircle2, XCircle, Copy, Check, Clock, Radio, ShieldCheck } from 'lucide-react';

interface Props {
  packet: DecodedPacket;
}

export const PacketCard: React.FC<Props> = ({ packet }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(packet.payloadText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const formattedTime = new Date(packet.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });

  return (
    <div className={`glass-card p-4 transition-all ${
      packet.isValidCrc 
        ? 'border-emerald-500/25 hover:border-emerald-500/40 bg-emerald-950/15' 
        : 'border-rose-500/25 hover:border-rose-500/40 bg-rose-950/15'
    }`}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          {packet.isValidCrc ? (
            <span className="badge badge-emerald flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> CRC OK
            </span>
          ) : (
            <span className="badge badge-crimson flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> CRC MISMATCH
            </span>
          )}

          <span className={`badge ${packet.band === 'ultrasonic' ? 'badge-violet' : 'badge-cyan'}`}>
            <Radio className="w-3 h-3" />
            {packet.band.toUpperCase()}
          </span>

          {packet.fecCorrectedCount !== undefined && packet.fecCorrectedCount > 0 && (
            <span className="badge badge-amber flex items-center gap-1 text-[10px]">
              <ShieldCheck className="w-3 h-3" />
              FEC: {packet.fecCorrectedCount} FIXED
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{formattedTime}</span>
        </div>
      </div>

      {/* Payload Display */}
      <div className="my-3 flex items-start justify-between gap-2.5">
        <div className="font-mono text-base font-semibold text-white break-words leading-relaxed glass-inset px-3.5 py-2.5 w-full">
          {packet.payloadText}
        </div>
        <button
          onClick={handleCopy}
          className="btn btn-secondary p-2.5 rounded-xl text-slate-300 hover:text-white shrink-0"
          title="Copy payload to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400 pt-1">
        <div className="flex items-center gap-3">
          <span>Seq #{packet.header.seqNum}</span>
          <span>•</span>
          <span>{packet.header.payloadLength} Bytes</span>
          <span>•</span>
          <span>SNR: <strong className="text-cyan-400">{packet.snrDb} dB</strong></span>
        </div>

        <div className="text-slate-500">
          CRC-16: 0x{packet.crcReceived.toString(16).toUpperCase().padStart(4, '0')}
        </div>
      </div>
    </div>
  );
};
