"use client";

import React, { useState, useRef } from "react";
import { 
  Upload, Shield, Flame, Clock, Key, Lock, CheckCircle2, Copy, ExternalLink, 
  AlertTriangle, FileText, ArrowRight, Eye, RefreshCw 
} from "lucide-react";
import Link from "next/link";
import {
  generateMasterKey,
  generateSalt,
  generateNoncePrefix,
  toBase64Url,
  buildShareUrl,
} from "@/lib/crypto/keys";
import { deriveKeyHierarchy } from "@/lib/crypto/hkdf";
import { encryptChunk, encryptMetadata, CHUNK_SIZE } from "@/lib/crypto/cipher";
import { wrapMasterKey } from "@/lib/crypto/password";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [burnAfterRead, setBurnAfterRead] = useState<boolean>(true);
  const [ttlSeconds, setTtlSeconds] = useState<number>(3600); // 1 hour default
  const [maxDownloads, setMaxDownloads] = useState<number>(1);
  const [enablePassword, setEnablePassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");

  // Uploading state
  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [bytesProcessed, setBytesProcessed] = useState<number>(0);
  const [encryptionSpeed, setEncryptionSpeed] = useState<string>("0 MB/s");
  const [statusText, setStatusText] = useState<string>("");

  // Result state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartEncryption = async () => {
    if (!file) return;

    try {
      setIsEncrypting(true);
      setStatusText("Generating 256-bit CSPRNG Master Key in Browser RAM...");

      const startTime = performance.now();
      const masterKey = generateMasterKey();
      const masterKeyB64 = toBase64Url(masterKey);

      // 1. Password wrapping (if enabled)
      let wrappedKeyB64: string | undefined;
      let passwordSaltB64: string | undefined;
      let passwordIvB64: string | undefined;
      let serverVerifier: string | undefined;

      if (enablePassword && password.trim().length > 0) {
        setStatusText("Deriving PBKDF2 Password Key & Zero-Knowledge Verifier...");
        const wrap = await wrapMasterKey(masterKey, password.trim());
        wrappedKeyB64 = wrap.wrappedKey;
        passwordSaltB64 = wrap.salt;
        passwordIvB64 = wrap.iv;
        serverVerifier = wrap.serverVerifier;
      }

      // 2. HKDF Key Separation
      setStatusText("Deriving HKDF-SHA256 File, Metadata, and Capability Subkeys...");
      const salt = generateSalt(16);
      const saltB64 = toBase64Url(salt);
      const noncePrefix = generateNoncePrefix();
      const noncePrefixB64 = toBase64Url(noncePrefix);

      const { fileKey, metadataKey } = await deriveKeyHierarchy(masterKey, salt);

      // 3. Compute chunks count
      const fileSize = file.size;
      const numChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));
      setTotalChunks(numChunks);

      // Generate random 128-bit file ID
      const fileIdRandom = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setFileId(fileIdRandom);

      // 4. Encrypt Metadata
      setStatusText("Encrypting file metadata (filename, size, MIME type)...");
      const metadataPayload = {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        sha256: "computed_on_stream",
        totalChunks: numChunks,
        chunkSize: CHUNK_SIZE,
        uploadedAt: Date.now(),
      };

      const { encryptedMetadata, iv: metadataIv } = await encryptMetadata(
        metadataKey,
        metadataPayload
      );

      // 5. Register File Record with Server
      setStatusText("Registering ciphertext file record with server...");
      const registerRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: fileIdRandom,
          salt: saltB64,
          encryptedMetadata,
          metadataIv,
          noncePrefix: noncePrefixB64,
          totalChunks: numChunks,
          totalSizeBytes: fileSize,
          burnAfterRead,
          maxDownloads: burnAfterRead ? 1 : maxDownloads,
          expiresInSeconds: ttlSeconds,
          passwordVerifier: serverVerifier,
          passwordSalt: passwordSaltB64,
        }),
      });

      if (!registerRes.ok) {
        throw new Error("Failed to register file record on server.");
      }

      // 6. Encrypt & Upload Chunks in Stream
      let totalBytesEncrypted = 0;

      for (let i = 0; i < numChunks; i++) {
        setCurrentChunk(i + 1);
        setStatusText(`Encrypting & uploading chunk ${i + 1} of ${numChunks}...`);

        const startByte = i * CHUNK_SIZE;
        const endByte = Math.min(fileSize, startByte + CHUNK_SIZE);
        const chunkBlob = file.slice(startByte, endByte);
        const chunkBuffer = await chunkBlob.arrayBuffer();

        const isLastChunk = i === numChunks - 1;
        const aadParams = {
          fileId: fileIdRandom,
          chunkIndex: i,
          totalChunks: numChunks,
          isLastChunk,
        };

        // Hardware-accelerated WebCrypto AES-256-GCM encryption
        const encResult = await encryptChunk(fileKey, chunkBuffer, noncePrefix, aadParams);

        // Upload ciphertext chunk
        const chunkRes = await fetch(`/api/files/${fileIdRandom}/chunk/${i}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: encResult.ciphertext,
        });

        if (!chunkRes.ok) {
          throw new Error(`Failed to upload encrypted chunk ${i}`);
        }

        totalBytesEncrypted += chunkBuffer.byteLength;
        setBytesProcessed(totalBytesEncrypted);

        // Speed metric
        const elapsedSec = (performance.now() - startTime) / 1000;
        const mbPerSec = (totalBytesEncrypted / (1024 * 1024)) / Math.max(0.1, elapsedSec);
        setEncryptionSpeed(`${mbPerSec.toFixed(1)} MB/s`);
      }

      // 7. Construct Final URL with Master Key in Fragment
      const origin = window.location.origin;
      const finalUrl = enablePassword && wrappedKeyB64 && passwordIvB64
        ? buildShareUrl(origin, fileIdRandom, wrappedKeyB64, true, passwordIvB64)
        : buildShareUrl(origin, fileIdRandom, masterKeyB64);

      setShareUrl(finalUrl);
      setIsEncrypting(false);
    } catch (err: any) {
      alert(`Encryption / Upload Error: ${err.message}`);
      setIsEncrypting(false);
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const resetForm = () => {
    setFile(null);
    setShareUrl(null);
    setFileId(null);
    setIsEncrypting(false);
    setBytesProcessed(0);
    setCurrentChunk(0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero Headline */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 text-cyber-neonCyan text-xs font-mono">
          <Shield className="w-3.5 h-3.5" />
          <span>ZERO-KNOWLEDGE CLIENT ENCRYPTION</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-mono text-white">
          SHARE IT. THEN MAKE IT <span className="text-cyber-neonCyan glow-cyan">NEVER EXIST.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 font-mono">
          Encrypted directly in your browser with Web Crypto AES-256-GCM. The key resides only in the URL fragment (#) and is never sent to any server.
        </p>
      </div>

      {!shareUrl ? (
        <div className="cyber-glass rounded-2xl p-6 sm:p-8 space-y-6 border border-cyber-neonCyan/25">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cyber-neonCyan/30 hover:border-cyber-neonCyan rounded-xl p-8 text-center cursor-pointer transition-all bg-cyber-darker/60 hover:bg-cyber-darker group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="p-3 rounded-full bg-cyber-neonCyan/20 text-cyber-neonCyan">
                  <FileText className="w-8 h-8 glow-cyan" />
                </div>
                <div className="font-mono text-sm text-white font-bold">{file.name}</div>
                <div className="font-mono text-xs text-slate-400">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • {Math.ceil(file.size / CHUNK_SIZE)} Chunks
                </div>
                <span className="text-xs text-cyber-neonCyan font-mono mt-2 underline">
                  Click to replace file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="p-4 rounded-full bg-cyber-neonCyan/10 text-cyber-neonCyan group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 glow-cyan" />
                </div>
                <div className="font-mono text-sm text-slate-300">
                  <span className="text-cyber-neonCyan font-bold">Choose a confidential file</span> or drag & drop here
                </div>
                <p className="text-[11px] text-slate-500 font-mono">
                  Up to 50MB • All file types supported • Encrypted chunk by chunk in RAM
                </p>
              </div>
            )}
          </div>

          {/* Security & Expiry Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {/* Burn-After-Read Toggle */}
            <div
              onClick={() => setBurnAfterRead(!burnAfterRead)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                burnAfterRead
                  ? "bg-rose-950/30 border-rose-500/50 shadow-[0_0_15px_rgba(255,0,60,0.15)]"
                  : "bg-cyber-darker border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <Flame className={`w-4 h-4 ${burnAfterRead ? "text-rose-500 glow-red" : "text-slate-400"}`} />
                  Burn-After-Read
                </span>
                <span
                  className={`w-3 h-3 rounded-full ${
                    burnAfterRead ? "bg-rose-500 shadow-[0_0_8px_#ff003c]" : "bg-slate-700"
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Immediately shreds file on disk with 3-pass DoD overwrite after first download.
              </p>
            </div>

            {/* Time-To-Live (TTL) */}
            <div className="p-4 rounded-xl bg-cyber-darker border border-slate-800 space-y-2">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Clock className="w-4 h-4 text-cyber-neonCyan" /> Expiration Timer
              </span>
              <select
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(parseInt(e.target.value, 10))}
                className="w-full bg-black/60 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyber-neonCyan font-mono"
              >
                <option value={300}>5 Minutes</option>
                <option value={3600}>1 Hour</option>
                <option value={86400}>24 Hours</option>
                <option value={604800}>7 Days</option>
              </select>
              <p className="text-[10px] text-slate-500">
                Disintegrates automatically when the countdown timer hits zero.
              </p>
            </div>

            {/* Max Downloads */}
            <div className={`p-4 rounded-xl border space-y-2 ${burnAfterRead ? "opacity-50 pointer-events-none" : "bg-cyber-darker border-slate-800"}`}>
              <span className="flex items-center gap-1.5 font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Max Downloads
              </span>
              <select
                disabled={burnAfterRead}
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(parseInt(e.target.value, 10))}
                className="w-full bg-black/60 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:border-cyber-neonCyan font-mono"
              >
                <option value={1}>1 Download</option>
                <option value={3}>3 Downloads</option>
                <option value={5}>5 Downloads</option>
                <option value={10}>10 Downloads</option>
              </select>
              <p className="text-[10px] text-slate-500">
                {burnAfterRead ? "Locked to 1 by Burn-After-Read" : "Maximum authorized access attempts"}
              </p>
            </div>
          </div>

          {/* Optional Password Protection */}
          <div className="p-4 rounded-xl bg-cyber-darker border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.checked)}
                  className="rounded border-slate-700 text-cyber-neonCyan focus:ring-cyber-neonCyan"
                />
                <span className="flex items-center gap-1 text-white">
                  <Key className="w-3.5 h-3.5 text-cyber-neonCyan" /> Optional Passphrase Protection
                </span>
              </label>
              <span className="text-[10px] text-slate-500">PBKDF2 100k Iterations</span>
            </div>

            {enablePassword && (
              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="Enter strong secret passphrase..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/60 border border-cyber-neonCyan/40 rounded p-2 text-xs text-white focus:outline-none focus:border-cyber-neonCyan"
                />
                <p className="text-[10px] text-slate-500">
                  Password wraps the master key in your browser. Server only stores an HMAC verifier to prevent brute force.
                </p>
              </div>
            )}
          </div>

          {/* Encrypt & Share Action Button */}
          <button
            disabled={!file || isEncrypting}
            onClick={handleStartEncryption}
            className={`w-full py-4 rounded-xl font-mono text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              !file || isEncrypting
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-cyber-neonCyan text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.7)]"
            }`}
          >
            {isEncrypting ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>ENCRYPTING IN BROWSER...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <span>ENCRYPT IN BROWSER & GENERATE EXPIRING LINK</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Live Progress Bar during Encryption */}
          {isEncrypting && (
            <div className="space-y-2 p-4 rounded-xl bg-black/70 border border-cyber-neonCyan/40 font-mono text-xs">
              <div className="flex items-center justify-between text-cyber-neonCyan">
                <span>{statusText}</span>
                <span>{encryptionSpeed}</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyber-neonCyan h-full transition-all duration-200 shadow-[0_0_10px_#00f0ff]"
                  style={{
                    width: `${file ? Math.round((bytesProcessed / file.size) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Chunk {currentChunk} of {totalChunks}
                </span>
                <span>
                  {(bytesProcessed / (1024 * 1024)).toFixed(2)} MB /{" "}
                  {file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Upload Complete & Share Link Display */
        <div className="cyber-glass-glow rounded-2xl p-6 sm:p-8 space-y-6 border border-cyber-neonCyan">
          <div className="flex items-center space-x-3 text-emerald-400">
            <CheckCircle2 className="w-7 h-7 glow-green" />
            <div>
              <h2 className="text-xl font-bold font-mono text-white">
                ENCRYPTED & READY TO SHARE
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                The Master Key has been securely baked into the URL fragment.
              </p>
            </div>
          </div>

          {/* Share URL Box */}
          <div className="space-y-2 font-mono">
            <label className="text-xs text-slate-400">Expiring Zero-Knowledge URL:</label>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/80 border border-cyber-neonCyan/50 rounded-lg p-3 text-xs sm:text-sm text-cyber-neonCyan font-mono focus:outline-none select-all shadow-[0_0_10px_rgba(0,240,255,0.15)]"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-3 bg-cyber-neonCyan text-black font-bold text-xs rounded-lg hover:bg-cyan-300 transition-colors flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,240,255,0.4)]"
              >
                <Copy className="w-4 h-4" />
                <span>{copied ? "COPIED!" : "COPY"}</span>
              </button>
            </div>
          </div>

          {/* RFC 3986 Cryptographic Proof Badge */}
          <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyber-neonCyan/30 space-y-2 font-mono text-xs">
            <div className="flex items-center space-x-2 text-cyber-neonCyan font-bold">
              <Shield className="w-4 h-4" />
              <span>CRYPTOGRAPHIC ASSURANCE (RFC 3986):</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Notice the <strong className="text-cyber-neonCyan">#key=</strong> in the URL above. By internet standards, the fragment identifier (<code className="text-white">#</code>) is strictly evaluated by the recipient's browser and <strong>is never transmitted over HTTP headers or network requests</strong>. The server never holds the key.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 font-mono text-xs pt-2">
            <Link
              href={shareUrl}
              target="_blank"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center space-x-2 border border-slate-700 transition-colors"
            >
              <span>Test Download Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/god-mode"
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-cyber-neonCyan/10 hover:bg-cyber-neonCyan/20 text-cyber-neonCyan flex items-center justify-center space-x-2 border border-cyber-neonCyan/40 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Inspect in GOD MODE</span>
            </Link>
            <button
              onClick={resetForm}
              className="w-full sm:w-auto sm:ml-auto px-4 py-2.5 text-slate-400 hover:text-white"
            >
              Share Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
