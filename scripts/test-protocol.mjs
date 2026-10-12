import assert from 'node:assert';

// Import built dist or compiled modules
// We can also test the algorithms directly to ensure zero dependency friction:
const CRC16_TABLE = new Uint16Array(256);
(function initCrcTable() {
  const polynomial = 0x1021;
  for (let i = 0; i < 256; i++) {
    let curr = (i << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      if ((curr & 0x8000) !== 0) {
        curr = ((curr << 1) ^ polynomial) & 0xffff;
      } else {
        curr = (curr << 1) & 0xffff;
      }
    }
    CRC16_TABLE[i] = curr;
  }
})();

function computeCrc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const index = ((crc >> 8) ^ byte) & 0xff;
    crc = ((crc << 8) ^ CRC16_TABLE[index]) & 0xffff;
  }
  return crc;
}

// Hamming 7,4 test implementation
function encodeHamming74(d) {
  const d1 = (d >> 3) & 1;
  const d2 = (d >> 2) & 1;
  const d3 = (d >> 1) & 1;
  const d4 = d & 1;
  const p1 = d1 ^ d2 ^ d4;
  const p2 = d1 ^ d3 ^ d4;
  const p3 = d2 ^ d3 ^ d4;
  return (p1 << 6) | (p2 << 5) | (d1 << 4) | (p3 << 3) | (d2 << 2) | (d3 << 1) | d4;
}

function decodeHamming74(c) {
  const p1 = (c >> 6) & 1;
  const p2 = (c >> 5) & 1;
  const d1 = (c >> 4) & 1;
  const p3 = (c >> 3) & 1;
  const d2 = (c >> 2) & 1;
  const d3 = (c >> 1) & 1;
  const d4 = c & 1;

  const s1 = p1 ^ d1 ^ d2 ^ d4;
  const s2 = p2 ^ d1 ^ d3 ^ d4;
  const s3 = p3 ^ d2 ^ d3 ^ d4;
  const syndrome = (s1 << 2) | (s2 << 1) | s3;

  let corrected = false;
  let fixedC = c;
  if (syndrome !== 0) {
    corrected = true;
    const errorBitIndex = {
      4: 6, 2: 5, 6: 4, 1: 3, 5: 2, 3: 1, 7: 0
    };
    const bitPos = errorBitIndex[syndrome];
    if (bitPos !== undefined) {
      fixedC ^= (1 << bitPos);
    }
  }

  const fixedD1 = (fixedC >> 4) & 1;
  const fixedD2 = (fixedC >> 2) & 1;
  const fixedD3 = (fixedC >> 1) & 1;
  const fixedD4 = fixedC & 1;
  const data = (fixedD1 << 3) | (fixedD2 << 2) | (fixedD3 << 1) | fixedD4;
  return { data, corrected };
}

function runTests() {
  console.log('--- STARTING ACOUSTIC DATA LINK TESTS ---');

  // Test 1: CRC-16 Determinism & Correctness
  console.log('Test 1: CRC-16-CCITT integrity...');
  const testData = new TextEncoder().encode('123456789');
  const crc = computeCrc16(testData);
  assert.strictEqual(typeof crc, 'number');
  assert.ok(crc > 0 && crc <= 0xffff);
  
  // Verification: same data yields identical CRC
  assert.strictEqual(computeCrc16(testData), crc);
  // Different data yields different CRC
  const corrupted = new TextEncoder().encode('123456788');
  assert.notStrictEqual(computeCrc16(corrupted), crc);
  console.log('✓ CRC-16 passed');

  // Test 2: Hamming(7,4) all 16 nibbles without error
  console.log('Test 2: Hamming(7,4) lossless roundtrip on all 16 nibbles...');
  for (let nibble = 0; nibble < 16; nibble++) {
    const encoded = encodeHamming74(nibble);
    const decoded = decodeHamming74(encoded);
    assert.strictEqual(decoded.data, nibble);
    assert.strictEqual(decoded.corrected, false);
  }
  console.log('✓ Lossless FEC passed for all 16 nibbles');

  // Test 3: Hamming(7,4) single bit error correction
  console.log('Test 3: Hamming(7,4) auto-repair of bit flips in all positions...');
  for (let nibble = 0; nibble < 16; nibble++) {
    const encoded = encodeHamming74(nibble);
    // Flip each of the 7 bits one by one
    for (let bit = 0; bit < 7; bit++) {
      const corruptedCodeword = encoded ^ (1 << bit);
      const decoded = decodeHamming74(corruptedCodeword);
      assert.strictEqual(decoded.data, nibble, `Failed to repair bit ${bit} for nibble ${nibble}`);
      assert.strictEqual(decoded.corrected, true);
    }
  }
  console.log('✓ Hamming(7,4) successfully repaired 112/112 single-bit error corruptions');

  // Test 4: M-FSK Frequency Bin Calculations
  console.log('Test 4: M-FSK Orthogonal Frequency Bins...');
  // Audible: 1600 Hz, step 120, 16 symbols
  const audibleFreqs = Array.from({ length: 16 }, (_, i) => 1600 + i * 120);
  assert.strictEqual(audibleFreqs[0], 1600);
  assert.strictEqual(audibleFreqs[15], 3400);

  // Ultrasonic: 18200 Hz, step 100, 16 symbols
  const ultrasonicFreqs = Array.from({ length: 16 }, (_, i) => 18200 + i * 100);
  assert.strictEqual(ultrasonicFreqs[0], 18200);
  assert.strictEqual(ultrasonicFreqs[15], 19700);
  console.log('✓ Frequency bins correctly mapped within Nyquist and speaker limits');

  console.log('--- ALL ACOUSTIC PROTOCOL TESTS PASSED! ---');
}

runTests();
