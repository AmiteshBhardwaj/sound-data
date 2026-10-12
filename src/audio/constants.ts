import type { AudioBand, BandConfig, PresetConfig, SpeedPreset } from '../types/protocol';

export const SYNC_BYTE = 0x5A; // Unique delimiter byte: 01011010

// 11-bit Barker sequence for timing synchronization
export const BARKER_11 = [1, 1, 1, -1, -1, -1, 1, -1, -1, 1, -1];

export const BAND_CONFIGS: Record<AudioBand, BandConfig> = {
  audible: {
    band: 'audible',
    name: 'Audible Band',
    description: '1.6 kHz - 3.4 kHz (Resilient in all devices & noisy rooms)',
    baseFreq: 1600,
    freqStep: 120,
    symbolCount: 16,
    chirpStartFreq: 1400,
    chirpEndFreq: 3600,
    pilotFreq: 1500
  },
  ultrasonic: {
    band: 'ultrasonic',
    name: 'Near-Ultrasonic Band',
    description: '18.2 kHz - 19.7 kHz (Silent, inaudible air-gapped transfer)',
    baseFreq: 18200,
    freqStep: 100,
    symbolCount: 16,
    chirpStartFreq: 17800,
    chirpEndFreq: 19900,
    pilotFreq: 18000
  }
};

export const PRESET_CONFIGS: Record<SpeedPreset, PresetConfig> = {
  robust: {
    preset: 'robust',
    name: 'Robust',
    description: '70ms symbol + FEC (High echo & noise resilience)',
    symbolDurationMs: 70,
    guardDurationMs: 15,
    useFEC: true
  },
  balanced: {
    preset: 'balanced',
    name: 'Balanced',
    description: '40ms symbol + FEC (~100 bps standard)',
    symbolDurationMs: 40,
    guardDurationMs: 8,
    useFEC: true
  },
  fast: {
    preset: 'fast',
    name: 'High Speed',
    description: '22ms symbol (~250 bps for quiet close-range)',
    symbolDurationMs: 22,
    guardDurationMs: 4,
    useFEC: false
  }
};

// Returns frequency array for a given band
export function getFrequenciesForBand(band: AudioBand): number[] {
  const config = BAND_CONFIGS[band];
  const freqs: number[] = [];
  for (let i = 0; i < config.symbolCount; i++) {
    freqs.push(config.baseFreq + i * config.freqStep);
  }
  return freqs;
}
