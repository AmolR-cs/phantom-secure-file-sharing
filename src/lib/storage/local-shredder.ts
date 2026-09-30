import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StorageDriver } from "./interface";

const BASE_STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "storage", "blobs");

export class LocalShredderStorage implements StorageDriver {
  private baseDir: string;

  constructor(baseDir = BASE_STORAGE_DIR) {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFileDir(fileId: string): string {
    // Sanitize fileId to prevent path traversal
    const safeFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(this.baseDir, safeFileId);
  }

  async saveChunk(fileId: string, chunkIndex: number, data: Buffer | Uint8Array): Promise<string> {
    const dir = this.getFileDir(fileId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const chunkPath = path.join(dir, `chunk_${chunkIndex}.bin`);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await fs.promises.writeFile(chunkPath, buffer);
    return chunkPath;
  }

  private isSafePath(targetPath: string): boolean {
    const rel = path.relative(this.baseDir, path.resolve(targetPath));
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  }

  async getChunk(storagePath: string): Promise<Buffer> {
    const resolved = path.resolve(storagePath);
    if (!this.isSafePath(resolved)) {
      throw new Error("Access Denied: Path outside storage sandbox");
    }
    if (!fs.existsSync(resolved)) {
      throw new Error("CHUNK_NOT_FOUND");
    }
    return fs.promises.readFile(resolved);
  }

  async hasChunk(storagePath: string): Promise<boolean> {
    try {
      const resolved = path.resolve(storagePath);
      if (!this.isSafePath(resolved)) return false;
      return fs.existsSync(resolved);
    } catch {
      return false;
    }
  }

  /**
   * Cryptographic Hard-Delete (DoD 5220.22-M Style):
   * Pass 1: All Zeroes (0x00) -> fsync
   * Pass 2: All Ones (0xFF) -> fsync
   * Pass 3: CSPRNG Random Bytes -> fsync
   * Step 4: Unlink file
   */
  async shredChunk(storagePath: string): Promise<void> {
    const resolved = path.resolve(storagePath);
    if (!this.isSafePath(resolved) || !fs.existsSync(resolved)) {
      return;
    }

    try {
      const fd = fs.openSync(resolved, "r+");
      const stat = fs.fstatSync(fd);
      const size = stat.size;

      if (size > 0) {
        // Pass 1: Zeroes
        const zeroes = Buffer.alloc(size, 0x00);
        fs.writeSync(fd, zeroes, 0, size, 0);
        fs.fsyncSync(fd);

        // Pass 2: Ones
        const ones = Buffer.alloc(size, 0xff);
        fs.writeSync(fd, ones, 0, size, 0);
        fs.fsyncSync(fd);

        // Pass 3: Cryptographic Random Bytes
        const randomBytes = crypto.randomBytes(size);
        fs.writeSync(fd, randomBytes, 0, size, 0);
        fs.fsyncSync(fd);
      }

      fs.closeSync(fd);
      fs.unlinkSync(resolved);
    } catch (err) {
      // If file was already deleted by concurrent shredder
      if (fs.existsSync(resolved)) {
        try {
          fs.unlinkSync(resolved);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Shreds every chunk associated with fileId and removes the directory
   */
  async shredAllFileChunks(fileId: string): Promise<{ shreddedCount: number; errors: string[] }> {
    const dir = this.getFileDir(fileId);
    let shreddedCount = 0;
    const errors: string[] = [];

    if (!fs.existsSync(dir)) {
      return { shreddedCount: 0, errors: [] };
    }

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
          await this.shredChunk(fullPath);
          shreddedCount++;
        } catch (err: any) {
          errors.push(`Failed to shred ${file}: ${err.message}`);
        }
      }

      // Remove directory once empty
      try {
        fs.rmdirSync(dir);
      } catch (err: any) {
        // Directory may not be empty if an error occurred
      }
    } catch (err: any) {
      errors.push(`Directory access failed: ${err.message}`);
    }

    return { shreddedCount, errors };
  }

  /**
   * Verification job: Proves no dangling blobs exist on disk for the given file ID
   */
  async verifyZeroDanglingBlobs(fileId: string): Promise<boolean> {
    const dir = this.getFileDir(fileId);
    if (!fs.existsSync(dir)) {
      return true;
    }
    const files = fs.readdirSync(dir);
    return files.length === 0;
  }
}

export const defaultStorage = new LocalShredderStorage();
