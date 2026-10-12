/**
 * Forward Error Correction using Hamming(7,4) with single-error correction.
 * Operates on 4-bit nibbles.
 */

// Encode 4-bit data nibble (0..15) into 7-bit codeword
export function encodeHamming74(d: number): number {
  const d1 = (d >> 3) & 1;
  const d2 = (d >> 2) & 1;
  const d3 = (d >> 1) & 1;
  const d4 = d & 1;

  const p1 = d1 ^ d2 ^ d4;
  const p2 = d1 ^ d3 ^ d4;
  const p3 = d2 ^ d3 ^ d4;

  // Codeword: [p1, p2, d1, p3, d2, d3, d4] (7 bits)
  return (p1 << 6) | (p2 << 5) | (d1 << 4) | (p3 << 3) | (d2 << 2) | (d3 << 1) | d4;
}

// Decode 7-bit codeword back to 4-bit data nibble, correcting any single bit error
export function decodeHamming74(c: number): { data: number; corrected: boolean } {
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
    // Map syndrome to bit position (1-indexed from MSB: 1 to 7)
    // Syndrome bits: s1 is MSB, s3 is LSB
    // 001 -> bit 4 (p3)
    // 010 -> bit 2 (p2)
    // 011 -> bit 6 (d3)
    // 100 -> bit 1 (p1)
    // 101 -> bit 5 (d2)
    // 110 -> bit 3 (d1)
    // 111 -> bit 7 (d4)
    const errorBitIndex: Record<number, number> = {
      4: 6, // p1 (bit 6)
      2: 5, // p2 (bit 5)
      6: 4, // d1 (bit 4)
      1: 3, // p3 (bit 3)
      5: 2, // d2 (bit 2)
      3: 1, // d3 (bit 1)
      7: 0  // d4 (bit 0)
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

/**
 * Encodes array of raw bytes using Hamming(7,4).
 * Each byte splits into 2 nibbles -> 2 codewords (stored as 2 bytes).
 */
export function encodeBytesFec(data: Uint8Array<any>): Uint8Array<any> {
  const encoded = new Uint8Array(data.length * 2);
  for (let i = 0; i < data.length; i++) {
    const highNibble = (data[i] >> 4) & 0x0f;
    const lowNibble = data[i] & 0x0f;
    encoded[i * 2] = encodeHamming74(highNibble);
    encoded[i * 2 + 1] = encodeHamming74(lowNibble);
  }
  return encoded;
}

/**
 * Decodes array of Hamming(7,4) encoded bytes.
 */
export function decodeBytesFec(encoded: Uint8Array<any>): { data: Uint8Array<any>; corrections: number } {
  const byteCount = Math.floor(encoded.length / 2);
  const data = new Uint8Array(byteCount);
  let corrections = 0;

  for (let i = 0; i < byteCount; i++) {
    const highRes = decodeHamming74(encoded[i * 2]);
    const lowRes = decodeHamming74(encoded[i * 2 + 1]);

    if (highRes.corrected) corrections++;
    if (lowRes.corrected) corrections++;

    data[i] = ((highRes.data & 0x0f) << 4) | (lowRes.data & 0x0f);
  }

  return { data, corrections };
}
