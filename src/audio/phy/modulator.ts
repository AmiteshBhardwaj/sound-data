import { BAND_CONFIGS, getFrequenciesForBand, PRESET_CONFIGS } from '../constants';
import type { AudioBand, SpeedPreset } from '../../types/protocol';

export interface ModulationOptions {
  band: AudioBand;
  preset: SpeedPreset;
  volume: number; // 0.0 to 1.0
}

export interface SynthesizedAudio {
  buffer: AudioBuffer;
  durationMs: number;
  sampleRate: number;
  symbolCount: number;
}

/**
 * M-FSK Modulator (16-FSK)
 * Synthesizes sample-accurate audio wave in an AudioBuffer.
 */
export class FskModulator {
  private audioCtx: AudioContext;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
  }

  /**
   * Converts packet byte stream to synthesized AudioBuffer
   */
  public synthesizePacket(
    packetBytes: Uint8Array,
    options: ModulationOptions
  ): SynthesizedAudio {
    const sampleRate = this.audioCtx.sampleRate;
    const bandConfig = BAND_CONFIGS[options.band];
    const presetConfig = PRESET_CONFIGS[options.preset];
    const freqs = getFrequenciesForBand(options.band);

    const symbolDurationSec = presetConfig.symbolDurationMs / 1000;
    const guardDurationSec = presetConfig.guardDurationMs / 1000;
    const chirpDurationSec = 0.08; // 80ms chirp
    const syncDurationSec = 0.22;  // 220ms robust sync pulse for high over-the-air detection reliability
    const guardSilenceSec = 0.03;  // 30ms silence between pilot and first symbol
    const leadSilenceSec = 0.05;   // 50ms initial silence
    const tailSilenceSec = 0.05;   // 50ms trailing silence

    // Convert bytes into 4-bit symbols (2 symbols per byte)
    const symbols: number[] = [];
    for (let i = 0; i < packetBytes.length; i++) {
      symbols.push((packetBytes[i] >> 4) & 0x0f); // High nibble
      symbols.push(packetBytes[i] & 0x0f);        // Low nibble
    }

    const dataTotalSec = symbols.length * (symbolDurationSec + guardDurationSec);
    const totalDurationSec =
      leadSilenceSec + chirpDurationSec + 0.01 + syncDurationSec + guardSilenceSec + dataTotalSec + tailSilenceSec;
    const totalSamples = Math.ceil(totalDurationSec * sampleRate);

    const audioBuffer = this.audioCtx.createBuffer(1, totalSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    let currentSample = Math.floor(leadSilenceSec * sampleRate);

    // 1. Synthesize Preamble Chirp (linear frequency sweep from chirpStart to chirpEnd)
    const chirpSamples = Math.floor(chirpDurationSec * sampleRate);
    const f0 = bandConfig.chirpStartFreq;
    const f1 = bandConfig.chirpEndFreq;
    const kChirp = (f1 - f0) / chirpDurationSec;

    for (let i = 0; i < chirpSamples; i++) {
      const t = i / sampleRate;
      // Tukey / Hann envelope for chirp
      const envelope = Math.sin((Math.PI * i) / chirpSamples);
      const phase = 2 * Math.PI * (f0 * t + 0.5 * kChirp * t * t);
      channelData[currentSample + i] = envelope * Math.sin(phase) * options.volume * 0.9;
    }
    currentSample += chirpSamples;

    // Guard silence after chirp
    currentSample += Math.floor(0.01 * sampleRate);

    // 2. Synthesize Dual Sync Pulse (Pilot tone marker) - 220ms with trapezoidal envelope
    const syncSamples = Math.floor(syncDurationSec * sampleRate);
    const pilotFreq = bandConfig.pilotFreq;
    const syncRampSamples = Math.min(Math.floor(0.015 * sampleRate), Math.floor(syncSamples / 6)); // 15ms ramp

    for (let i = 0; i < syncSamples; i++) {
      const t = i / sampleRate;
      // Raised-cosine envelope with wide plateau at full volume
      let envelope = 1.0;
      if (i < syncRampSamples) {
        envelope = 0.5 * (1 - Math.cos((Math.PI * i) / syncRampSamples));
      } else if (i > syncSamples - syncRampSamples) {
        envelope = 0.5 * (1 - Math.cos((Math.PI * (syncSamples - i)) / syncRampSamples));
      }
      channelData[currentSample + i] =
        envelope * Math.sin(2 * Math.PI * pilotFreq * t) * options.volume * 0.95;
    }
    currentSample += syncSamples;

    // Guard silence before data
    currentSample += Math.floor(guardSilenceSec * sampleRate);

    // 3. Synthesize M-FSK Symbols
    const symSamples = Math.floor(symbolDurationSec * sampleRate);
    const guardSamples = Math.floor(guardDurationSec * sampleRate);
    const rampSamples = Math.min(Math.floor(0.004 * sampleRate), Math.floor(symSamples / 4)); // 4ms smooth ramp

    for (let sIdx = 0; sIdx < symbols.length; sIdx++) {
      const sym = symbols[sIdx];
      const freq = freqs[sym] || freqs[0];

      for (let i = 0; i < symSamples; i++) {
        const t = i / sampleRate;
        // Raised-cosine envelope to eliminate clicking
        let env = 1.0;
        if (i < rampSamples) {
          env = 0.5 * (1 - Math.cos((Math.PI * i) / rampSamples));
        } else if (i > symSamples - rampSamples) {
          env = 0.5 * (1 - Math.cos((Math.PI * (symSamples - i)) / rampSamples));
        }

        channelData[currentSample + i] =
          env * Math.sin(2 * Math.PI * freq * t) * options.volume;
      }

      currentSample += symSamples + guardSamples;
    }

    return {
      buffer: audioBuffer,
      durationMs: totalDurationSec * 1000,
      sampleRate,
      symbolCount: symbols.length
    };
  }
}
