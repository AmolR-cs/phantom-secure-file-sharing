import { ChunkAADParams } from "./types";

/**
 * Serializes chunk metadata into a deterministic, canonical binary buffer for AES-GCM AAD.
 * Layout:
 * [0..3]: FileId length (UInt32 BE)
 * [4..4+L-1]: FileId UTF-8 bytes
 * [4+L..4+L+3]: Chunk Index (UInt32 BE)
 * [4+L+4..4+L+7]: Total Chunks (UInt32 BE)
 * [4+L+8]: isLastChunk flag (UInt8, 1 or 0)
 */
export function serializeAAD(params: ChunkAADParams): Uint8Array {
  const enc = new TextEncoder();
  const fileIdBytes = enc.encode(params.fileId);
  const totalLength = 4 + fileIdBytes.length + 4 + 4 + 1;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  let offset = 0;
  view.setUint32(offset, fileIdBytes.length, false); // Big-Endian
  offset += 4;

  uint8.set(fileIdBytes, offset);
  offset += fileIdBytes.length;

  view.setUint32(offset, params.chunkIndex, false);
  offset += 4;

  view.setUint32(offset, params.totalChunks, false);
  offset += 4;

  view.setUint8(offset, params.isLastChunk ? 1 : 0);

  return uint8;
}

/**
 * Deserializes AAD binary buffer back to structured parameters
 */
export function deserializeAAD(buffer: ArrayBuffer | Uint8Array): ChunkAADParams {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let offset = 0;
  const fileIdLen = view.getUint32(offset, false);
  offset += 4;

  const dec = new TextDecoder();
  const fileId = dec.decode(bytes.subarray(offset, offset + fileIdLen));
  offset += fileIdLen;

  const chunkIndex = view.getUint32(offset, false);
  offset += 4;

  const totalChunks = view.getUint32(offset, false);
  offset += 4;

  const isLastChunk = view.getUint8(offset) === 1;

  return { fileId, chunkIndex, totalChunks, isLastChunk };
}
