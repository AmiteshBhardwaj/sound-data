import type { AudioBand, AudioStats, DecodedPacket, ReceiverState, SpeedPreset } from '../types/protocol';
import { FskModulator } from './phy/modulator';
import { FskDemodulator } from './phy/demodulator';
import type { DemodulatorCallbacks } from './phy/demodulator';
import { buildPacket } from './protocol/packetizer';

export class AudioEngine {
  private static instance: AudioEngine | null = null;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private modulator: FskModulator | null = null;
  private demodulator: FskDemodulator | null = null;

  private isListening = false;
  private isTransmitting = false;
  private animationFrameId: number | null = null;

  private band: AudioBand = 'audible';
  private preset: SpeedPreset = 'balanced';
  private volume = 0.85;
  private sensitivityDb = 6;

  // Cached visualizer array
  private freqData: Float32Array | null = null;

  private monitorGain: GainNode | null = null;
  private isAudioMonitorEnabled = false;

  // Event callbacks
  private onStateChangeCb: ((state: ReceiverState) => void) | null = null;
  private onPacketReceivedCb: ((packet: DecodedPacket) => void) | null = null;
  private onStatsUpdateCb: ((stats: AudioStats) => void) | null = null;
  private onTransmissionProgressCb: ((progress: number) => void) | null = null;
  private onPartialTranscriptionCb: ((text: string, progress: number) => void) | null = null;

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private constructor() {
    // Demodulator callbacks
    const callbacks: DemodulatorCallbacks = {
      onStateChange: (state) => this.onStateChangeCb?.(state),
      onPacketReceived: (packet) => this.onPacketReceivedCb?.(packet),
      onStatsUpdate: (stats) => this.onStatsUpdateCb?.(stats),
      onPartialTranscription: (text, progress) => this.onPartialTranscriptionCb?.(text, progress),
    };
    this.demodulator = new FskDemodulator(callbacks);
  }

  /**
   * Initializes AudioContext on first user interaction
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ latencyHint: 'interactive' });

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioCtx.destination);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.0;
      this.analyser.minDecibels = -100;
      this.analyser.maxDecibels = -20;

      this.freqData = new Float32Array(this.analyser.frequencyBinCount);

      this.modulator = new FskModulator(this.audioCtx);
      this.demodulator?.setConfig(this.band, this.preset, this.sensitivityDb);
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  /**
   * Toggles Microphone input on/off
   */
  public async startListening(): Promise<boolean> {
    try {
      const ctx = await this.ensureContext();
      if (!this.analyser) return false;

      if (!this.micStream) {
        // Request raw mic stream without browser speech noise filtering
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: 1,
              sampleRate: { ideal: 48000 }
            }
          });
        } catch {
          // Fallback if browser/OS driver rejects custom audio constraints
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        this.micStream = stream;
        this.micSource = ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.analyser);

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        if (!this.monitorGain) {
          this.monitorGain = ctx.createGain();
          this.monitorGain.gain.value = 0.25;
          this.monitorGain.connect(ctx.destination);
        }
        if (this.isAudioMonitorEnabled) {
          try { this.micSource.connect(this.monitorGain); } catch { /* ignore */ }
        }
      }

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.isListening = true;
      this.demodulator?.resetSync();
      this.startProcessingLoop();
      return true;
    } catch (err) {
      console.error('Failed to open microphone:', err);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch { /* ignore */ }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.demodulator?.setState('idle');
  }

  public setAudioMonitor(enabled: boolean) {
    this.isAudioMonitorEnabled = enabled;
    if (!this.micSource || !this.monitorGain) return;
    try {
      if (enabled) {
        this.micSource.connect(this.monitorGain);
      } else {
        this.micSource.disconnect(this.monitorGain);
      }
    } catch {
      // ignore
    }
  }

  public getAudioMonitor(): boolean {
    return this.isAudioMonitorEnabled;
  }

  /**
   * Transmits a text message via sound waves
   */
  public async transmitMessage(text: string, useInternalLoopback = false): Promise<DecodedPacket | null> {
    const ctx = await this.ensureContext();
    if (!this.modulator || !this.masterGain || !this.analyser) return null;

    if (this.isTransmitting) return null;
    this.isTransmitting = true;

    const presetConfig = this.preset;
    const { packetBytes } = buildPacket(text, {
      band: this.band,
      useFec: presetConfig === 'robust' || presetConfig === 'balanced',
      speed: this.preset
    });

    const synth = this.modulator.synthesizePacket(packetBytes, {
      band: this.band,
      preset: this.preset,
      volume: this.volume
    });

    // Create source node for synthesized buffer
    const source = ctx.createBufferSource();
    source.buffer = synth.buffer;

    // Connect to speaker destination
    source.connect(this.masterGain);

    // Also connect to analyser so visualizer displays outgoing waveform!
    source.connect(this.analyser);

    const startTime = ctx.currentTime;
    const durationSec = synth.durationMs / 1000;

    source.start(startTime);

    // Track transmission progress
    const progressInterval = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      const progress = Math.min(1.0, elapsed / durationSec);
      this.onTransmissionProgressCb?.(progress);
    }, 50);

    return new Promise((resolve) => {
      source.onended = () => {
        clearInterval(progressInterval);
        this.onTransmissionProgressCb?.(1.0);
        this.isTransmitting = false;

        if (useInternalLoopback && this.demodulator) {
          this.demodulator.injectLoopbackPacket(packetBytes, synth.durationMs);
        }

        setTimeout(() => this.onTransmissionProgressCb?.(0), 400);
        resolve(null);
      };
    });
  }

  /**
   * Main real-time DSP analysis loop (60 FPS)
   */
  private startProcessingLoop() {
    if (this.animationFrameId !== null) return;

    const loop = () => {
      if (!this.isListening) {
        this.animationFrameId = null;
        return;
      }

      if (this.analyser && this.freqData && this.audioCtx && this.demodulator) {
        (this.analyser as unknown as { getFloatFrequencyData: (arr: any) => void }).getFloatFrequencyData(this.freqData);
        
        // Pass frame to demodulator
        this.demodulator.processFrame(
          this.freqData,
          this.audioCtx.sampleRate,
          this.analyser.fftSize,
          performance.now()
        );
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // --- Getters & Visualizer Data Feeds ---
  public getSampleRate(): number {
    return this.audioCtx ? this.audioCtx.sampleRate : 48000;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public getTimeDomainData(output: Uint8Array) {
    if (this.analyser) {
      (this.analyser as unknown as { getByteTimeDomainData: (arr: any) => void }).getByteTimeDomainData(output);
    }
  }

  public getFrequencyData(output: Uint8Array) {
    if (this.analyser) {
      (this.analyser as unknown as { getByteFrequencyData: (arr: any) => void }).getByteFrequencyData(output);
    }
  }

  public getFloatFrequencyData(output: Float32Array) {
    if (this.analyser) {
      (this.analyser as unknown as { getFloatFrequencyData: (arr: any) => void }).getFloatFrequencyData(output);
    }
  }

  public setBand(band: AudioBand) {
    this.band = band;
    this.demodulator?.setConfig(this.band, this.preset, this.sensitivityDb);
  }

  public getBand(): AudioBand {
    return this.band;
  }

  public setPreset(preset: SpeedPreset) {
    this.preset = preset;
    this.demodulator?.setConfig(this.band, this.preset, this.sensitivityDb);
  }

  public getPreset(): SpeedPreset {
    return this.preset;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setSensitivity(db: number) {
    this.sensitivityDb = db;
    this.demodulator?.setConfig(this.band, this.preset, this.sensitivityDb);
  }

  public getSensitivity(): number {
    return this.sensitivityDb;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public getIsTransmitting(): boolean {
    return this.isTransmitting;
  }

  // --- Callback registrations ---
  public onStateChange(cb: (state: ReceiverState) => void) {
    this.onStateChangeCb = cb;
  }

  public onPacketReceived(cb: (packet: DecodedPacket) => void) {
    this.onPacketReceivedCb = cb;
  }

  public onStatsUpdate(cb: (stats: AudioStats) => void) {
    this.onStatsUpdateCb = cb;
  }

  public onTransmissionProgress(cb: (progress: number) => void) {
    this.onTransmissionProgressCb = cb;
  }

  public onPartialTranscription(cb: (text: string, progress: number) => void) {
    this.onPartialTranscriptionCb = cb;
  }
}
