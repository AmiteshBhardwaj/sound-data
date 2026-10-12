import React from 'react';
import type { ReceiverState } from '../types/protocol';
import { Radio, Mic, ArrowRight, Activity, ShieldCheck } from 'lucide-react';

interface Props {
  onSelectMode: (mode: 'transmit' | 'receive') => void;
  isTransmitting: boolean;
  isListening: boolean;
  receiverState: ReceiverState;
}

export const PortalLanding: React.FC<Props> = ({
  onSelectMode,
  isTransmitting,
  isListening,
  receiverState
}) => {
  const isDemodulating =
    receiverState === 'sync_locked' ||
    receiverState === 'receiving_header' ||
    receiverState === 'receiving_payload';

  return (
    <div className="portal-wrapper animate-fade-in">
      {/* Top Header Section */}
      <div className="portal-header">
        <div className="portal-brand">
          <h1 className="portal-logo-title">
            Sound<span className="portal-plus">+</span>Data
          </h1>
        </div>
        <p className="portal-subtitle">
          Secure, real-time acoustic data link from the comfort of your browser,
          powered by physical layer audio modulation and live DSP demodulation.
        </p>
      </div>

      {/* Two Hero Portal Cards: Transmit & Receive */}
      <div className="portal-cards-grid">
        {/* Card 1: For Transmitters */}
        <div className="portal-card portal-card-purple">
          {/* Top Icon Badge */}
          <div className="portal-icon-box portal-icon-purple">
            <Radio className="portal-icon" />
          </div>

          {/* Title */}
          <h2 className="portal-card-title">For Transmitters</h2>

          {/* Description */}
          <p className="portal-card-desc">
            Compose text messages, auth tokens, or payloads and broadcast them
            through your device speaker using acoustic carrier waves.
          </p>

          {/* Action Button */}
          <button
            onClick={() => onSelectMode('transmit')}
            className="portal-btn portal-btn-purple"
          >
            <span>{isTransmitting ? 'View Active Transmission' : 'Enter as Transmitter'}</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>

          {/* Status Chip */}
          <div className="portal-card-footer">
            {isTransmitting ? (
              <span className="badge badge-amber animate-pulse">
                <Activity className="w-3 h-3 animate-spin" /> Emitting Sound Waves
              </span>
            ) : (
              <span className="badge badge-violet">
                <ShieldCheck className="w-3 h-3" /> 16-FSK Modulator Ready
              </span>
            )}
          </div>
        </div>

        {/* Card 2: For Receivers */}
        <div className="portal-card portal-card-orange">
          {/* Top Icon Badge */}
          <div className="portal-icon-box portal-icon-orange">
            <Mic className="portal-icon" />
          </div>

          {/* Title */}
          <h2 className="portal-card-title">For Receivers</h2>

          {/* Description */}
          <p className="portal-card-desc">
            Listen for incoming acoustic signals with your microphone, detect
            sound chirps, and transcribe text in real-time.
          </p>

          {/* Action Button */}
          <button
            onClick={() => onSelectMode('receive')}
            className="portal-btn portal-btn-orange"
          >
            <span>{isListening ? 'View Live Transcription' : 'Enter as Receiver'}</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>

          {/* Status Chip */}
          <div className="portal-card-footer">
            {isDemodulating ? (
              <span className="badge badge-emerald animate-pulse">
                <Radio className="w-3 h-3 animate-spin" /> Live Transcribing
              </span>
            ) : isListening ? (
              <span className="badge badge-cyan animate-pulse">
                ● Microphone Active
              </span>
            ) : (
              <span className="badge badge-secondary">
                Ready to Listen & Transcribe
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

