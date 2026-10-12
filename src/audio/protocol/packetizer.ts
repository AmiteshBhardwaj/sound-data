import { SYNC_BYTE } from '../constants';
import { computeCrc16 } from './crc16';
import { encodeBytesFec, decodeBytesFec } from './fec';
import type { AudioBand, DecodedPacket, PacketHeader, SpeedPreset } from '../../types/protocol';

let globalSeq = 0;

export interface FrameBuildOptions {
  band: AudioBand;
  useFec: boolean;
  speed: SpeedPreset;
}

/**
 * Encodes string or binary payload into framed byte buffer ready for M-FSK modulation.
 */
export function buildPacket(
  payloadText: string,
  options: FrameBuildOptions
): { packetBytes: Uint8Array; header: PacketHeader; rawPayload: Uint8Array; crc: number } {
  const encoder = new TextEncoder();
  const rawPayload = encoder.encode(payloadText);

  // Flags: bit 0: isUltrasonic, bit 1: useFec
  let flags = 0;
  if (options.band === 'ultrasonic') flags |= 0x01;
  if (options.useFec) flags |= 0x02;

  const seqNum = (globalSeq++) & 0xff;

  // Process payload (with FEC if requested)
  const processedPayload = options.useFec ? encodeBytesFec(rawPayload) : rawPayload;
  const payloadLen = processedPayload.length;

  // Header: SYNC (1) + FLAGS (1) + SEQ (1) + LEN_HIGH (1) + LEN_LOW (1) = 5 bytes
  const headerBytes = new Uint8Array(5);
  headerBytes[0] = SYNC_BYTE;
  headerBytes[1] = flags;
  headerBytes[2] = seqNum;
  headerBytes[3] = (payloadLen >> 8) & 0xff;
  headerBytes[4] = payloadLen & 0xff;

  // Packet data without CRC
  const dataWithoutCrc = new Uint8Array(5 + payloadLen);
  dataWithoutCrc.set(headerBytes, 0);
  dataWithoutCrc.set(processedPayload, 5);

  // Compute CRC-16 over header + payload
  const crc = computeCrc16(dataWithoutCrc);

  // Complete packet with 2-byte CRC
  const packetBytes = new Uint8Array(dataWithoutCrc.length + 2);
  packetBytes.set(dataWithoutCrc, 0);
  packetBytes[dataWithoutCrc.length] = (crc >> 8) & 0xff;
  packetBytes[dataWithoutCrc.length + 1] = crc & 0xff;

  const header: PacketHeader = {
    syncByte: SYNC_BYTE,
    flags,
    seqNum,
    payloadLength: rawPayload.length
  };

  return { packetBytes, header, rawPayload, crc };
}

/**
 * Parses and validates received framed bytes.
 */
export function parsePacket(
  receivedBytes: Uint8Array,
  snrDb = 0,
  durationMs = 0
): DecodedPacket | null {
  if (receivedBytes.length < 7) {
    return null; // At minimum 5 header + 2 CRC
  }

  const syncByte = receivedBytes[0];
  if (syncByte !== SYNC_BYTE) {
    return null;
  }

  const flags = receivedBytes[1];
  const seqNum = receivedBytes[2];
  const payloadLength = (receivedBytes[3] << 8) | receivedBytes[4];

  const expectedTotalLen = 5 + payloadLength + 2;
  if (receivedBytes.length < expectedTotalLen) {
    return null; // Incomplete packet
  }

  const packetContent = receivedBytes.slice(0, 5 + payloadLength);
  const crcHigh = receivedBytes[5 + payloadLength];
  const crcLow = receivedBytes[5 + payloadLength + 1];
  const crcReceived = (crcHigh << 8) | crcLow;

  const crcExpected = computeCrc16(packetContent);
  let isValidCrc = (crcExpected === crcReceived);

  const rawReceivedPayload = packetContent.slice(5);
  const isUltrasonic = (flags & 0x01) !== 0;
  const isFec = (flags & 0x02) !== 0;

  let finalPayloadBytes: Uint8Array<any> = rawReceivedPayload;
  let fecCorrectedCount = 0;

  if (isFec) {
    const fecResult = decodeBytesFec(rawReceivedPayload);
    finalPayloadBytes = fecResult.data;
    fecCorrectedCount = fecResult.corrections;

    // If CRC mismatched due to transmission errors but FEC corrected them, verify repaired packet
    if (!isValidCrc && fecCorrectedCount > 0) {
      const repairedPayload = encodeBytesFec(finalPayloadBytes);
      const repairedContent = new Uint8Array(5 + repairedPayload.length);
      repairedContent.set(packetContent.slice(0, 5), 0);
      repairedContent.set(repairedPayload, 5);
      if (computeCrc16(repairedContent) === crcReceived) {
        isValidCrc = true;
      }
    }
  }

  let payloadText = '';
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    payloadText = decoder.decode(finalPayloadBytes);
  } catch {
    payloadText = `[Binary: ${finalPayloadBytes.length} bytes]`;
  }

  return {
    id: `pkt-${Date.now()}-${seqNum}`,
    timestamp: Date.now(),
    header: {
      syncByte,
      flags,
      seqNum,
      payloadLength: finalPayloadBytes.length
    },
    payloadText,
    payloadBytes: finalPayloadBytes,
    crcExpected,
    crcReceived,
    isValidCrc,
    snrDb,
    durationMs,
    band: isUltrasonic ? 'ultrasonic' : 'audible',
    speed: isFec ? 'balanced' : 'fast',
    fecCorrectedCount
  };
}
