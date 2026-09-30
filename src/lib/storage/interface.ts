/**
 * Storage Abstraction Layer Interface
 */

export interface StorageDriver {
  saveChunk(fileId: string, chunkIndex: number, data: Buffer | Uint8Array): Promise<string>;
  getChunk(storagePath: string): Promise<Buffer>;
  hasChunk(storagePath: string): Promise<boolean>;
  shredChunk(storagePath: string): Promise<void>;
  shredAllFileChunks(fileId: string): Promise<{ shreddedCount: number; errors: string[] }>;
  verifyZeroDanglingBlobs(fileId: string): Promise<boolean>;
}
