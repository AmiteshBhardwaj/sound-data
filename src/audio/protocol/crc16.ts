/**
 * CRC-16-CCITT (Polynomial 0x1021, Init 0xFFFF)
 */

// Lookup table for speed
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

export function computeCrc16(data: Uint8Array<any>): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    const index = ((crc >> 8) ^ byte) & 0xff;
    crc = ((crc << 8) ^ CRC16_TABLE[index]) & 0xffff;
  }
  return crc;
}

export function verifyCrc16(data: Uint8Array<any>, expectedCrc: number): boolean {
  return computeCrc16(data) === expectedCrc;
}
