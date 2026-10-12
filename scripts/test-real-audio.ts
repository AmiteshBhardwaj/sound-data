import { FskModulator } from '../src/audio/phy/modulator';
import { FskDemodulator } from '../src/audio/phy/demodulator';
import { buildPacket } from '../src/audio/protocol/packetizer';

// We need an AudioContext mock for node to run FskModulator.synthesizePacket
class MockAudioBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  duration: number;
  private channelData: Float32Array;

  constructor(options: { numberOfChannels?: number; length: number; sampleRate: number }) {
    this.sampleRate = options.sampleRate;
    this.length = options.length;
    this.numberOfChannels = options.numberOfChannels || 1;
    this.duration = this.length / this.sampleRate;
    this.channelData = new Float32Array(this.length);
  }

  getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }
}

class MockAudioContext {
  sampleRate = 48000;
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer({ numberOfChannels: channels, length, sampleRate });
  }
}

// Window function for FFT (Hann window, as standard Web Audio uses Blackman/Hann)
function hannWindow(n: number, N: number): number {
  return 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
}

// Radix-2 FFT
function fftRadix2(re: Float64Array, im: Float64Array) {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = re[i]; re[i] = re[j]; re[j] = tempR;
      const tempI = im[i]; im[i] = im[j]; im[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
  // Cooley-Tukey butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const uR = re[i + k];
        const uI = im[i + k];
        const vR = re[i + k + half] * wR - im[i + k + half] * wI;
        const vI = re[i + k + half] * wI + im[i + k + half] * wR;
        re[i + k] = uR + vR;
        im[i + k] = uI + vI;
        re[i + k + half] = uR - vR;
        im[i + k + half] = uI - vI;
        const nextWR = wR * wStepR - wI * wStepI;
        const nextWI = wR * wStepI + wI * wStepR;
        wR = nextWR;
        wI = nextWI;
      }
    }
  }
}

function computeFftMagDb(pcm: Float32Array, offset: number, fftSize: number): Float32Array {
  const binCount = fftSize / 2;
  const outDb = new Float32Array(binCount);
  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);

  for (let n = 0; n < fftSize; n++) {
    const sample = (offset + n < pcm.length) ? pcm[offset + n] : 0;
    const w = hannWindow(n, fftSize);
    re[n] = sample * w;
    im[n] = 0;
  }

  fftRadix2(re, im);

  for (let b = 0; b < binCount; b++) {
    const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]) / (fftSize / 2);
    outDb[b] = mag > 1e-6 ? 20 * Math.log10(mag) : -120;
  }
  return outDb;
}

interface TestCase {
  name: string;
  band: 'audible' | 'ultrasonic';
  preset: 'robust' | 'balanced' | 'fast';
  sampleRate: number;
  text: string;
  snrNoiseDb?: number; // Add simulated ambient Gaussian white noise
}

async function runSingleTest(tc: TestCase): Promise<boolean> {
  const mockCtx = new MockAudioContext() as any;
  mockCtx.sampleRate = tc.sampleRate;
  const modulator = new FskModulator(mockCtx);

  const { packetBytes } = buildPacket(tc.text, {
    band: tc.band,
    useFec: tc.preset !== 'fast',
    speed: tc.preset
  });

  const synth = modulator.synthesizePacket(packetBytes, {
    band: tc.band,
    preset: tc.preset,
    volume: 0.85
  });

  const pcm = synth.buffer.getChannelData(0);

  // If noise specified, add Gaussian noise to PCM
  if (tc.snrNoiseDb !== undefined) {
    const noiseAmp = Math.pow(10, -tc.snrNoiseDb / 20);
    for (let i = 0; i < pcm.length; i++) {
      // Box-Muller Gaussian noise
      const u1 = Math.max(1e-9, Math.random());
      const u2 = Math.random();
      const g = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      pcm[i] += g * noiseAmp * 0.3;
    }
  }

  let receivedPacket: any = null;

  const demodulator = new FskDemodulator({
    onPacketReceived: (packet) => {
      receivedPacket = packet;
    }
  });

  demodulator.setConfig(tc.band, tc.preset, 6);
  demodulator.setState('listening');

  const fftSize = 2048;
  const sampleRate = tc.sampleRate;
  const hopSize = Math.round((sampleRate * 16) / 1000); // 16ms hops

  for (let offset = 0; offset + fftSize <= pcm.length; offset += hopSize) {
    const nowMs = (offset / sampleRate) * 1000;
    const freqData = computeFftMagDb(pcm, offset, fftSize);
    demodulator.processFrame(freqData, sampleRate, fftSize, nowMs);
  }

  // Trailing frames
  for (let i = 0; i < 20; i++) {
    const nowMs = (pcm.length / sampleRate) * 1000 + i * 16;
    const empty = new Float32Array(fftSize / 2).fill(-90);
    demodulator.processFrame(empty, sampleRate, fftSize, nowMs);
  }

  const success = receivedPacket !== null && receivedPacket.payloadText === tc.text && receivedPacket.isValidCrc;
  if (success) {
    console.log(`PASS [${tc.name}]: Decoded "${receivedPacket.payloadText}" (CRC: ${receivedPacket.isValidCrc})`);
  } else {
    console.error(`FAIL [${tc.name}]: Expected "${tc.text}", got ${receivedPacket ? `"${receivedPacket.payloadText}" (CRC: ${receivedPacket.isValidCrc})` : 'null'}`);
  }
  return success;
}

async function runTestSuite() {
  console.log('--- COMPREHENSIVE REAL-AUDIO DSP ACOUSTIC TEST SUITE ---\n');

  const tests: TestCase[] = [
    // 1. Ultrasonic tests at 48kHz
    {
      name: 'Ultrasonic @ 48kHz, Balanced',
      band: 'ultrasonic',
      preset: 'balanced',
      sampleRate: 48000,
      text: 'SECRET ULTRASONIC 123'
    },
    {
      name: 'Ultrasonic @ 48kHz, Robust',
      band: 'ultrasonic',
      preset: 'robust',
      sampleRate: 48000,
      text: 'CONFIDENTIAL SIGNAL'
    },
    {
      name: 'Ultrasonic @ 48kHz, Fast',
      band: 'ultrasonic',
      preset: 'fast',
      sampleRate: 48000,
      text: 'FAST AIRGAP'
    },
    // 2. Ultrasonic tests at 44.1kHz (iOS/Legacy hardware)
    {
      name: 'Ultrasonic @ 44.1kHz, Balanced',
      band: 'ultrasonic',
      preset: 'balanced',
      sampleRate: 44100,
      text: 'IOS ULTRASONIC 44K'
    },
    {
      name: 'Ultrasonic @ 44.1kHz, Robust',
      band: 'ultrasonic',
      preset: 'robust',
      sampleRate: 44100,
      text: 'ROBUST 44.1 KHZ'
    },
    // 3. Audible tests at 48kHz and 44.1kHz
    {
      name: 'Audible @ 48kHz, Balanced',
      band: 'audible',
      preset: 'balanced',
      sampleRate: 48000,
      text: 'HELLO AUDIBLE SOUND'
    },
    {
      name: 'Audible @ 48kHz, Robust',
      band: 'audible',
      preset: 'robust',
      sampleRate: 48000,
      text: 'ROBUST AUDIBLE 99'
    },
    {
      name: 'Audible @ 44.1kHz, Fast',
      band: 'audible',
      preset: 'fast',
      sampleRate: 44100,
      text: 'FAST AUDIBLE SPEED'
    },
    // 4. Acoustic noise resilience tests
    {
      name: 'Ultrasonic @ 48kHz + Simulated Room Noise (22 dB SNR)',
      band: 'ultrasonic',
      preset: 'balanced',
      sampleRate: 48000,
      text: 'NOISY ROOM TEXT',
      snrNoiseDb: 22
    },
    {
      name: 'Audible @ 48kHz + Simulated Ambient Noise (20 dB SNR)',
      band: 'audible',
      preset: 'robust',
      sampleRate: 48000,
      text: 'NOISY AUDIBLE TEST',
      snrNoiseDb: 20
    }
  ];

  let passed = 0;
  for (const tc of tests) {
    const ok = await runSingleTest(tc);
    if (ok) passed++;
  }

  console.log(`\nTEST SUITE SUMMARY: ${passed}/${tests.length} passed (${Math.round((passed / tests.length) * 100)}%)`);
  if (passed !== tests.length) {
    process.exit(1);
  }
}

runTestSuite();
