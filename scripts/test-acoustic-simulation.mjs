import assert from 'node:assert';
import { getFrequenciesForBand, BAND_CONFIGS, PRESET_CONFIGS } from '../src/audio/constants.ts';
import { buildPacket } from '../src/audio/protocol/packetizer.ts';
import { FskDemodulator } from '../src/audio/phy/demodulator.ts';

console.log('--- STARTING ACOUSTIC REALITY & DEMODULATOR SIMULATION TESTS ---');

// Test 1: Simulating Web Audio Silence with -Infinity bins
console.log('Test 1: Web Audio -Infinity bins resilience...');
let receivedPacket = null;

const demodulator = new FskDemodulator({
  onPacketReceived: (packet) => {
    receivedPacket = packet;
  }
});

demodulator.setConfig('audible', 'balanced', 9);
demodulator.setState('listening');

const fftSize = 2048;
const sampleRate = 48000;
const binCount = fftSize / 2;
const silentFrame = new Float32Array(binCount);
silentFrame.fill(-Infinity); // All bins silent / -Infinity as Web Audio returns!

// Feed 10 silent frames with -Infinity
for (let i = 0; i < 10; i++) {
  demodulator.processFrame(silentFrame, sampleRate, fftSize, i * 16.6);
}

// Ensure demodulator did NOT freeze into preamble_detected with Infinity dB SNR
assert.strictEqual(demodulator.getState(), 'listening', 'State should remain listening on silence with -Infinity bins');
console.log('✓ Silence with -Infinity bins does not cause false preamble trigger or NaN/Infinity freeze');

// Test 2: Simulating transmission of message "HELLO ACOUSTIC WORLD"
console.log('Test 2: Simulating transmission of message "HELLO ACOUSTIC WORLD"...');
const testMessage = 'HELLO ACOUSTIC WORLD';
const { packetBytes } = buildPacket(testMessage, {
  band: 'audible',
  useFec: true,
  speed: 'balanced'
});

const bandConfig = BAND_CONFIGS.audible;
const freqs = getFrequenciesForBand('audible');
const binWidth = sampleRate / fftSize;
const pilotBin = Math.round(bandConfig.pilotFreq / binWidth);

const symbols = [];
for (let i = 0; i < packetBytes.length; i++) {
  symbols.push((packetBytes[i] >> 4) & 0x0f);
  symbols.push(packetBytes[i] & 0x0f);
}

const symbolPeriodMs = PRESET_CONFIGS.balanced.symbolDurationMs + PRESET_CONFIGS.balanced.guardDurationMs; // 48ms
let simTimeMs = 1000;

// Background ambient noise (-75 dB) for 200ms
for (let t = 0; t < 200; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  demodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

// Pilot tone pulse for 80ms (-42 dB on pilot bin, -75 dB elsewhere)
for (let t = 0; t < 80; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  frame[pilotBin] = -42;
  demodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}
assert.strictEqual(demodulator.getState(), 'preamble_detected', 'Preamble must be detected during pilot tone');
console.log('✓ Preamble tone successfully detected');

// Guard silence after pilot (20ms)
for (let t = 0; t < 20; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  demodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}
assert.strictEqual(demodulator.getState(), 'sync_locked', 'Sync must lock when pilot tone ends');

// Send symbols one by one
for (let sIdx = 0; sIdx < symbols.length; sIdx++) {
  const sym = symbols[sIdx];
  const carrierBin = Math.round(freqs[sym] / binWidth);

  const steps = Math.round(symbolPeriodMs / 16);
  for (let step = 0; step < steps; step++) {
    const frame = new Float32Array(binCount);
    frame.fill(-75);
    frame[carrierBin] = -40;
    demodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
    simTimeMs += 16;
  }
}

// Post-packet silence
for (let t = 0; t < 100; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  demodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

assert.ok(receivedPacket !== null, 'Packet must be received and parsed!');
assert.strictEqual(receivedPacket.payloadText, testMessage, `Payload text must match "${testMessage}"`);
assert.strictEqual(receivedPacket.isValidCrc, true, 'CRC must be valid');
console.log(`✓ Packet received, CRC valid! Decoded text: "${receivedPacket.payloadText}"`);

// Test 3: Sliding Sync Word with Jitter (1 stray noise symbol before SYNC_BYTE)
console.log('Test 3: Sliding sync word tolerance with leading noise symbol...');
let jitterPacket = null;
const jitterDemodulator = new FskDemodulator({
  onPacketReceived: (packet) => {
    jitterPacket = packet;
  }
});

jitterDemodulator.setConfig('audible', 'balanced', 9);
jitterDemodulator.setState('listening');

simTimeMs = 5000;
// Ambient
for (let t = 0; t < 100; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  jitterDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

// Pilot
for (let t = 0; t < 80; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  frame[pilotBin] = -42;
  jitterDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

// Pilot ends
for (let t = 0; t < 20; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  jitterDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}
assert.strictEqual(jitterDemodulator.getState(), 'sync_locked');

// Insert 1 leading stray noise symbol (symbol 0x3) before the packet!
const straySymbols = [0x3, ...symbols];
for (let sIdx = 0; sIdx < straySymbols.length; sIdx++) {
  const sym = straySymbols[sIdx];
  const carrierBin = Math.round(freqs[sym] / binWidth);

  const steps = Math.round(symbolPeriodMs / 16);
  for (let step = 0; step < steps; step++) {
    const frame = new Float32Array(binCount);
    frame.fill(-75);
    frame[carrierBin] = -40;
    jitterDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
    simTimeMs += 16;
  }
}

// Post-packet silence
for (let t = 0; t < 100; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-75);
  jitterDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

assert.ok(jitterPacket !== null, 'Packet with leading stray symbol must be received!');
assert.strictEqual(jitterPacket.payloadText, testMessage);
assert.strictEqual(jitterPacket.isValidCrc, true);
console.log('✓ Sliding sync successfully locked onto SYNC_BYTE despite leading jitter symbol!');

// Test 4: Near-Ultrasonic band transmission simulation
console.log('Test 4: Near-Ultrasonic band transmission (18.2 - 19.7 kHz)...');
let ultrasonicPacket = null;
const ultraDemodulator = new FskDemodulator({
  onPacketReceived: (packet) => {
    ultrasonicPacket = packet;
  }
});
ultraDemodulator.setConfig('ultrasonic', 'balanced', 9);
ultraDemodulator.setState('listening');

const ultraBandConfig = BAND_CONFIGS.ultrasonic;
const ultraFreqs = getFrequenciesForBand('ultrasonic');
const ultraPilotBin = Math.round(ultraBandConfig.pilotFreq / binWidth);

const { packetBytes: ultraBytes } = buildPacket('SECRET AIRGAP CODE 99', {
  band: 'ultrasonic',
  useFec: true,
  speed: 'balanced'
});

const ultraSymbols = [];
for (let i = 0; i < ultraBytes.length; i++) {
  ultraSymbols.push((ultraBytes[i] >> 4) & 0x0f);
  ultraSymbols.push(ultraBytes[i] & 0x0f);
}

simTimeMs = 10000;
// Pilot (18.0 kHz)
for (let t = 0; t < 80; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-80);
  frame[ultraPilotBin] = -40;
  ultraDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}
assert.strictEqual(ultraDemodulator.getState(), 'preamble_detected');

// Guard
for (let t = 0; t < 20; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-80);
  ultraDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}
assert.strictEqual(ultraDemodulator.getState(), 'sync_locked');

// Symbols
for (let sIdx = 0; sIdx < ultraSymbols.length; sIdx++) {
  const sym = ultraSymbols[sIdx];
  const carrierBin = Math.round(ultraFreqs[sym] / binWidth);

  const steps = Math.round(symbolPeriodMs / 16);
  for (let step = 0; step < steps; step++) {
    const frame = new Float32Array(binCount);
    frame.fill(-80);
    frame[carrierBin] = -38;
    ultraDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
    simTimeMs += 16;
  }
}

// Post-packet
for (let t = 0; t < 100; t += 16) {
  const frame = new Float32Array(binCount);
  frame.fill(-80);
  ultraDemodulator.processFrame(frame, sampleRate, fftSize, simTimeMs);
  simTimeMs += 16;
}

assert.ok(ultrasonicPacket !== null);
assert.strictEqual(ultrasonicPacket.payloadText, 'SECRET AIRGAP CODE 99');
assert.strictEqual(ultrasonicPacket.isValidCrc, true);
console.log('✓ Ultrasonic packet received and validated: "SECRET AIRGAP CODE 99"');

console.log('--- ALL 4 SIMULATION TESTS PASSED WITH 100% SUCCESS! ---');
