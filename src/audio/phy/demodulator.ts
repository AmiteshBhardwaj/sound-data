import { BAND_CONFIGS, getFrequenciesForBand, PRESET_CONFIGS, SYNC_BYTE } from '../constants';
import type { AudioBand, AudioStats, DecodedPacket, ReceiverState, SpeedPreset } from '../../types/protocol';
import { parsePacket } from '../protocol/packetizer';
import { decodeBytesFec } from '../protocol/fec';

export interface DemodulatorCallbacks {
  onStateChange?: (state: ReceiverState) => void;
  onPacketReceived?: (packet: DecodedPacket) => void;
  onStatsUpdate?: (stats: AudioStats) => void;
  onSymbolDetected?: (symbol: number, freq: number, snrDb: number) => void;
  onPartialTranscription?: (text: string, progress: number) => void;
}

export class FskDemodulator {
  private band: AudioBand = 'audible';
  private preset: SpeedPreset = 'balanced';
  private callbacks: DemodulatorCallbacks;

  private state: ReceiverState = 'idle';
  private sensitivityDb = 6; // Required SNR above noise floor for pilot trigger (calibrated for real-world devices)

  private noiseFloorDb = -80;
  private currentSnrDb = 0;

  // Frame synchronization state
  private pilotDetectionCount = 0;
  private pilotDropCount = 0;
  private pilotStartMs = 0;
  private pilotPeakDb = -120;
  private syncTimeMs = 0;
  private isSyncing = false;
  private receivedSymbols: number[] = [];
  private expectedTotalSymbols = 0; // Derived once header is parsed
  private packetStartTimeMs = 0;

  // Symbol integration across frames
  private lastFinalizedSymbolIdx = -1;
  private carrierPowerAccumulator = new Float32Array(16);
  private carrierBaselines = new Float32Array(16).fill(-90);
  private carrierFrameCount = 0;

  constructor(callbacks: DemodulatorCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public setConfig(band: AudioBand, preset: SpeedPreset, sensitivityDb = 6) {
    this.band = band;
    this.preset = preset;
    this.sensitivityDb = sensitivityDb;
    this.resetSync();
  }

  public resetSync() {
    this.state = 'listening';
    this.isSyncing = false;
    this.pilotDetectionCount = 0;
    this.pilotDropCount = 0;
    this.pilotStartMs = 0;
    this.pilotPeakDb = -120;
    this.receivedSymbols = [];
    this.expectedTotalSymbols = 0;
    this.lastFinalizedSymbolIdx = -1;
    this.carrierPowerAccumulator.fill(0);
    this.carrierBaselines.fill(-90);
    this.carrierFrameCount = 0;
    this.callbacks.onStateChange?.(this.state);
    this.callbacks.onPartialTranscription?.('', 0);
  }

  public setState(state: ReceiverState) {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  public getState(): ReceiverState {
    return this.state;
  }

  /**
   * Process a single audio frame from AnalyserNode (typically every ~10-16ms)
   */
  public processFrame(
    freqData: Float32Array,
    sampleRate: number,
    fftSize: number,
    nowMs: number
  ) {
    if (this.state === 'idle') return;

    const binWidth = sampleRate / fftSize;
    const bandConfig = BAND_CONFIGS[this.band];
    const presetConfig = PRESET_CONFIGS[this.preset];
    const freqs = getFrequenciesForBand(this.band);

    // 1. Measure pilot tone energy (radius 1 around pilot bin to avoid carrier 0 spillover)
    const pilotBin = Math.round(bandConfig.pilotFreq / binWidth);
    const pilotDb = this.getPeakDbAround(freqData, pilotBin, 1);

    // 2. Measure energy of all 16 carrier frequencies
    const carrierDbs: number[] = new Array(freqs.length);
    let maxCarrierDb = -120;
    let bestSymbol = 0;
    let bestFreq = freqs[0];

    for (let i = 0; i < freqs.length; i++) {
      const bin = Math.round(freqs[i] / binWidth);
      const db = this.getPeakDbAround(freqData, bin, 1);
      carrierDbs[i] = db;
      if (db > maxCarrierDb) {
        maxCarrierDb = db;
        bestSymbol = i;
        bestFreq = freqs[i];
      }
    }

    // 2b. Track dynamic per-carrier ambient baseline
    if (!this.isSyncing) {
      for (let c = 0; c < freqs.length; c++) {
        const db = carrierDbs[c];
        if (Number.isFinite(db) && db > -120) {
          this.carrierBaselines[c] = this.carrierBaselines[c] * 0.95 + db * 0.05;
        }
      }
    }

    // 3. Compute baseline ambient noise floor robustly
    // Sample bins strictly outside the carrier, chirp, and pilot ranges
    let noiseSum = 0;
    let noiseCount = 0;

    // Below band (clean region far below chirp/pilot)
    const lowFreqStart = this.band === 'audible' ? 600 : 15500;
    const lowFreqEnd = this.band === 'audible' ? 1150 : 17000;
    const lowBinStart = Math.max(5, Math.round(lowFreqStart / binWidth));
    const lowBinEnd = Math.max(lowBinStart, Math.round(lowFreqEnd / binWidth));
    for (let b = lowBinStart; b <= lowBinEnd; b++) {
      const val = freqData[b];
      if (Number.isFinite(val) && val > -120) {
        noiseSum += val;
        noiseCount++;
      }
    }

    // Above band (clean region above chirp/carriers)
    const highFreqStart = this.band === 'audible' ? 3850 : 20200;
    const highFreqEnd = this.band === 'audible' ? 4600 : 21500;
    const highBinStart = Math.round(highFreqStart / binWidth);
    const highBinEnd = Math.min(freqData.length - 5, Math.round(highFreqEnd / binWidth));
    for (let b = highBinStart; b <= highBinEnd; b++) {
      const val = freqData[b];
      if (Number.isFinite(val) && val > -120) {
        noiseSum += val;
        noiseCount++;
      }
    }

    const currentNoiseSample = noiseCount > 0 ? noiseSum / noiseCount : -80;
    if (!Number.isFinite(this.noiseFloorDb)) {
      this.noiseFloorDb = -80;
    }
    // Asymmetric smoothing: fast decay downwards, slow attack upwards so signal bursts don't spike the noise floor
    const alpha = currentNoiseSample > this.noiseFloorDb ? 0.02 : 0.08;
    this.noiseFloorDb = this.noiseFloorDb * (1 - alpha) + currentNoiseSample * alpha;
    this.noiseFloorDb = Math.max(-100, Math.min(-30, this.noiseFloorDb));

    const snrDb = Math.max(0, maxCarrierDb - this.noiseFloorDb);
    const pilotSnrDb = Math.max(0, pilotDb - this.noiseFloorDb);
    this.currentSnrDb = snrDb;

    const isSignalPresent = snrDb >= Math.max(4.5, this.sensitivityDb - 1.5);

    // Notify stats for HUD & Visualizer (all values guaranteed finite)
    this.callbacks.onStatsUpdate?.({
      volumeRms: Math.pow(10, Math.max(-120, maxCarrierDb) / 20),
      noiseFloor: this.noiseFloorDb,
      snrDb,
      pilotSnrDb,
      peakFrequency: isSignalPresent ? bestFreq : (pilotSnrDb >= this.sensitivityDb ? bandConfig.pilotFreq : 0),
      isSignalPresent,
      activeSymbol: isSignalPresent ? bestSymbol : null
    });

    // Don't advance state machine if already finalized packet and waiting to reset
    if (this.state === 'packet_received' || this.state === 'crc_error') {
      return;
    }

    // --- State Machine ---
    const symbolPeriodMs = presetConfig.symbolDurationMs + presetConfig.guardDurationMs;
    // Resilient trigger threshold: calibrated for phone-to-device air gaps
    const pilotTriggerThreshold = Math.max(3.5, Math.min(10, this.sensitivityDb));

    const centerTimeMs = nowMs + (fftSize / (2 * sampleRate)) * 1000;

    const isPilotActive =
      pilotSnrDb >= pilotTriggerThreshold &&
      pilotDb >= -75 &&
      pilotDb >= maxCarrierDb - 4 &&
      (this.pilotDetectionCount < 3 || pilotDb >= this.pilotPeakDb - 7);

    if (!this.isSyncing) {
      // Look for Pilot tone sync pulse
      if (isPilotActive) {
        if (this.pilotDetectionCount === 0) {
          this.pilotStartMs = centerTimeMs;
          this.pilotPeakDb = pilotDb;
        } else {
          this.pilotPeakDb = Math.max(this.pilotPeakDb, pilotDb);
        }
        this.pilotDetectionCount++;
        this.pilotDropCount = 0;

        // Require at least 3 frames of pilot confirmation (~48ms) to avoid momentary noise/chirp spikes
        if (this.pilotDetectionCount >= 3 && this.state !== 'preamble_detected') {
          this.setState('preamble_detected');
        }

        // Safety: if pilot tone stays active continuously for > 3.0 seconds, reset
        if (centerTimeMs - this.pilotStartMs > 3000) {
          this.resetSync();
        }
      } else {
        // Did pilot tone finish after being detected?
        if (this.pilotDetectionCount >= 3) {
          const isPilotDropped =
            pilotDb < this.pilotPeakDb - 8 ||
            maxCarrierDb > pilotDb + 3 ||
            pilotSnrDb < pilotTriggerThreshold;

          if (isPilotDropped) {
            this.pilotDropCount++;
            // Require 2 consecutive frames below threshold to ensure the pilot has truly completed
            if (this.pilotDropCount >= 2) {
              // Lock sync! Pilot ended; 30ms guard silence in modulator elapses before symbol 0
              this.isSyncing = true;
              // Guard silence is 30ms. Drop was confirmed ~15ms into guard silence.
              // Symbol 0 starts ~15ms after this confirmation frame's center time.
              this.syncTimeMs = centerTimeMs + 15;
              this.packetStartTimeMs = centerTimeMs;
              this.receivedSymbols = [];
              this.expectedTotalSymbols = 0;
              this.lastFinalizedSymbolIdx = -1;
              this.carrierPowerAccumulator.fill(0);
              this.carrierFrameCount = 0;
              this.setState('sync_locked');
              this.pilotDetectionCount = 0;
              this.pilotDropCount = 0;
            }
          } else {
            this.pilotDropCount = 0;
          }
        } else {
          this.pilotDetectionCount = 0;
          this.pilotDropCount = 0;
        }
      }
    } else {
      // IN SYNC_LOCKED: Demodulating symbol sequence
      const elapsedSinceSync = centerTimeMs - this.syncTimeMs;
      if (elapsedSinceSync >= 0) {
        const currentSymbolIdx = Math.floor(elapsedSinceSync / symbolPeriodMs);

        // When time has moved past previous symbol, finalize completed symbols FIRST
        while (currentSymbolIdx > this.lastFinalizedSymbolIdx + 1) {
          const targetFinalizeIdx = this.lastFinalizedSymbolIdx + 1;

          // Find carrier with maximum accumulated power
          let bestIdx = bestSymbol;
          let maxP = -1;
          for (let c = 0; c < 16; c++) {
            if (this.carrierPowerAccumulator[c] > maxP) {
              maxP = this.carrierPowerAccumulator[c];
              bestIdx = c;
            }
          }

          this.receivedSymbols.push(bestIdx);
          this.callbacks.onSymbolDetected?.(bestIdx, freqs[bestIdx], snrDb);

          // Clear accumulator for next symbol
          this.carrierPowerAccumulator.fill(0);
          this.carrierFrameCount = 0;
          this.lastFinalizedSymbolIdx = targetFinalizeIdx;

          // Check if we can synchronize framing on SYNC_BYTE
          if (this.expectedTotalSymbols === 0) {
            // Slide window looking for SYNC_BYTE: 0x5A -> nibbles (0x5, 0xA)
            let syncFound = false;
            const maxLookahead = Math.min(16, this.receivedSymbols.length - 2);

            for (let offset = 0; offset <= maxLookahead; offset++) {
              const byteVal = (this.receivedSymbols[offset] << 4) | this.receivedSymbols[offset + 1];
              if (byteVal === SYNC_BYTE) {
                syncFound = true;
                if (offset > 0) {
                  this.receivedSymbols = this.receivedSymbols.slice(offset);
                }
                break;
              }
            }

            if (syncFound) {
              if (this.state !== 'receiving_header') {
                this.setState('receiving_header');
              }

              // If we have at least 10 symbols (5 header bytes), parse total length
              if (this.receivedSymbols.length >= 10) {
                const lenHigh = (this.receivedSymbols[6] << 4) | this.receivedSymbols[7];
                const lenLow = (this.receivedSymbols[8] << 4) | this.receivedSymbols[9];
                let payloadLen = (lenHigh << 8) | lenLow;

                // Noise protection: clamp if high byte was noisy for standard text messages
                if (payloadLen > 512 && lenLow > 0 && lenLow <= 256) {
                  payloadLen = lenLow;
                }

                if (payloadLen >= 0 && payloadLen <= 512) {
                  // 5 header bytes + payloadLen + 2 CRC bytes
                  const totalBytes = 5 + payloadLen + 2;
                  this.expectedTotalSymbols = totalBytes * 2;
                  this.setState('receiving_payload');
                } else {
                  // Corrupt length field
                  this.resetSync();
                  return;
                }
              }
            } else if (this.receivedSymbols.length > 24) {
              // Too many symbols without finding SYNC_BYTE -> false trigger
              this.resetSync();
              return;
            }
          } else {
            // Header is already locked, in receiving_payload
            if (this.state !== 'receiving_payload') {
              this.setState('receiving_payload');
            }

            // Progressive transcription of received payload so far
            if (this.receivedSymbols.length > 10) {
              const flags = (this.receivedSymbols[2] << 4) | this.receivedSymbols[3];
              const isFec = (flags & 0x02) !== 0;
              const payloadSymbols = this.receivedSymbols.slice(10);
              const payloadBytesCount = Math.floor(payloadSymbols.length / 2);

              if (payloadBytesCount > 0) {
                const rawPayload = new Uint8Array(payloadBytesCount);
                for (let p = 0; p < payloadBytesCount; p++) {
                  rawPayload[p] = (payloadSymbols[p * 2] << 4) | payloadSymbols[p * 2 + 1];
                }

                let decodedText = '';
                try {
                  const dataBytes = isFec ? decodeBytesFec(rawPayload).data : rawPayload;
                  decodedText = new TextDecoder('utf-8', { fatal: false }).decode(dataBytes);
                } catch {
                  // ignore
                }

                const progress = this.expectedTotalSymbols > 0
                  ? Math.min(0.99, this.receivedSymbols.length / this.expectedTotalSymbols)
                  : 0.5;
                this.callbacks.onPartialTranscription?.(decodedText, progress);
              }
            }

            // Check if full packet is collected
            if (this.receivedSymbols.length >= this.expectedTotalSymbols) {
              this.finishPacketReception(nowMs);
              return;
            }
          }
        }

        // Accumulate carrier linear power for currentSymbolIdx
        const triggerThreshold = Math.max(3.5, this.sensitivityDb - 2.0);
        for (let c = 0; c < 16; c++) {
          const db = carrierDbs[c];
          const carrierSnr = db - this.carrierBaselines[c];
          if (carrierSnr >= triggerThreshold) {
            // Linear power representation
            const p = Number.isFinite(db) ? Math.pow(10, db / 10) : 0;
            this.carrierPowerAccumulator[c] += p;
          }
        }
        this.carrierFrameCount++;

        // Timeout guard: if syncing for too long without completion (> 20 seconds)
        if (elapsedSinceSync > 20000) {
          this.resetSync();
        }
      }
    }
  }

  private finishPacketReception(nowMs: number) {
    if (this.state === 'packet_received' || this.state === 'crc_error') return;
    this.isSyncing = false;
    const totalToUse = this.expectedTotalSymbols > 0
      ? Math.min(this.receivedSymbols.length, this.expectedTotalSymbols)
      : this.receivedSymbols.length;

    const rawBytes = new Uint8Array(Math.floor(totalToUse / 2));
    for (let i = 0; i < rawBytes.length; i++) {
      rawBytes[i] = (this.receivedSymbols[i * 2] << 4) | this.receivedSymbols[i * 2 + 1];
    }

    const durationMs = nowMs - this.packetStartTimeMs;
    const packet = parsePacket(rawBytes, Math.round(this.currentSnrDb), Math.round(durationMs));

    if (packet) {
      if (packet.isValidCrc) {
        this.setState('packet_received');
        this.callbacks.onPartialTranscription?.(packet.payloadText, 1.0);
      } else {
        this.setState('crc_error');
        // Still provide whatever text was decoded with warning
        if (packet.payloadText) {
          this.callbacks.onPartialTranscription?.(packet.payloadText, 1.0);
        }
      }
      this.callbacks.onPacketReceived?.(packet);
    } else {
      this.setState('crc_error');
    }

    // Reset back to listening after short display pause
    setTimeout(() => {
      this.resetSync();
    }, 2200);
  }

  public injectLoopbackPacket(packetBytes: Uint8Array, durationMs: number) {
    const packet = parsePacket(packetBytes, 42, durationMs);
    if (!packet) return;

    this.setState('preamble_detected');
    setTimeout(() => {
      this.setState('receiving_payload');
      const text = packet.payloadText;
      const mid = Math.ceil(text.length / 2);
      this.callbacks.onPartialTranscription?.(text.slice(0, mid), 0.5);
    }, 250);

    setTimeout(() => {
      this.setState(packet.isValidCrc ? 'packet_received' : 'crc_error');
      this.callbacks.onPartialTranscription?.(packet.payloadText, 1.0);
      this.callbacks.onPacketReceived?.(packet);
      setTimeout(() => this.resetSync(), 2200);
    }, 750);
  }

  private getPeakDbAround(freqData: Float32Array, centerBin: number, radius = 1): number {
    let maxVal = -140;
    const start = Math.max(0, centerBin - radius);
    const end = Math.min(freqData.length - 1, centerBin + radius);
    for (let b = start; b <= end; b++) {
      const val = freqData[b];
      if (Number.isFinite(val) && val > maxVal) {
        maxVal = val;
      }
    }
    return maxVal;
  }
}
