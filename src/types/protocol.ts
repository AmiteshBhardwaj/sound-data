export type AudioBand = 'audible' | 'ultrasonic';

export type SpeedPreset = 'robust' | 'balanced' | 'fast';

export interface BandConfig {
  band: AudioBand;
  name: string;
  description: string;
  baseFreq: number;       // Hz
  freqStep: number;       // Hz between symbol frequencies
  symbolCount: number;     // 8 or 16 tones
  chirpStartFreq: number; // Hz
  chirpEndFreq: number;   // Hz
  pilotFreq: number;      // Hz for Barker synchronization
}

export interface PresetConfig {
  preset: SpeedPreset;
  name: string;
  description: string;
  symbolDurationMs: number; // ms per symbol
  guardDurationMs: number;  // ms between symbols
  useFEC: boolean;          // Forward Error Correction
}

export interface PacketHeader {
  syncByte: number; // 0x5A
  flags: number;    // Bit 0: band (0=audible, 1=ultrasonic), Bit 1: FEC enabled
  seqNum: number;
  payloadLength: number;
}

export interface DecodedPacket {
  id: string;
  timestamp: number;
  header: PacketHeader;
  payloadText: string;
  payloadBytes: Uint8Array;
  crcExpected: number;
  crcReceived: number;
  isValidCrc: boolean;
  snrDb: number;
  durationMs: number;
  band: AudioBand;
  speed: SpeedPreset;
  fecCorrectedCount?: number;
}

export type ReceiverState =
  | 'idle'
  | 'listening'
  | 'preamble_detected'
  | 'sync_locked'
  | 'receiving_header'
  | 'receiving_payload'
  | 'packet_received'
  | 'crc_error';

export interface AudioStats {
  volumeRms: number;
  noiseFloor: number;
  snrDb: number;
  peakFrequency: number;
  isSignalPresent: boolean;
  activeSymbol: number | null;
  pilotSnrDb?: number;
}

export interface LiveTranscriptionState {
  isActive: boolean;
  text: string;
  progress: number;
  status: string;
  isCompleted: boolean;
  error?: string;
}

export type AppMode = 'transmit' | 'receive';
