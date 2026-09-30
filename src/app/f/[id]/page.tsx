"use client";

import React, { useState, useEffect, use } from "react";
import { 
  Download, Shield, Flame, AlertOctagon, CheckCircle2, Lock, 
  FileText, Clock, RefreshCw, Key, ShieldAlert 
} from "lucide-react";
import { parseFragment, fromBase64Url } from "@/lib/crypto/keys";
import { deriveKeyHierarchy } from "@/lib/crypto/hkdf";
import { decryptChunk, decryptMetadata } from "@/lib/crypto/cipher";
import { unwrapMasterKey, computeServerVerifier } from "@/lib/crypto/password";
import { CountdownRing } from "@/components/CountdownRing";
import { DisintegrationCanvas } from "@/components/DisintegrationCanvas";

interface FileMetadataResponse {
  id: string;
  salt: string;
  encryptedMetadata: string;
  metadataIv: string;
  noncePrefix: string;
  totalChunks: number;
  totalSizeBytes: number;
  burnAfterRead: boolean;
  maxDownloads: number;
  downloadCount: number;
  expiresAt: string | null;
  hasPassword: boolean;
  passwordSalt: string | null;
  status: string;
}

export default function DownloadPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id: fileId } = use(params);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<FileMetadataResponse | null>(null);

  // Decrypted client-side metadata
  const [plainName, setPlainName] = useState<string>("");
  const [plainSize, setPlainSize] = useState<number>(0);
  const [plainType, setPlainType] = useState<string>("");

  // Keys in client RAM
  const [masterKeyBytes, setMasterKeyBytes] = useState<Uint8Array | null>(null);
  const [wrappedKeyStr, setWrappedKeyStr] = useState<string | null>(null);
  const [passwordIvStr, setPasswordIvStr] = useState<string | null>(null);

  // Password prompt state
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Download / Decrypt progress
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [downloadComplete, setDownloadComplete] = useState<boolean>(false);

  // Disintegration state
  const [isDisintegrated, setIsDisintegrated] = useState<boolean>(false);
  const [triggerCanvas, setTriggerCanvas] = useState<boolean>(false);

  useEffect(() => {
    async function initPortal() {
      try {
        setLoading(true);

        // 1. Extract Master Key from URL fragment (#key=... or #wrapped=...)
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const parsed = parseFragment(hash);

        if (!parsed.key && !parsed.wrapped) {
          setError("MISSING_FRAGMENT_KEY: The Master Key was omitted from the URL fragment (#key=...). Without it, decryption is mathematically impossible.");
          setLoading(false);
          return;
        }

        if (parsed.wrapped) {
          setWrappedKeyStr(parsed.wrapped);
          if (parsed.iv) {
            setPasswordIvStr(parsed.iv);
          }
        } else if (parsed.key) {
          try {
            const rawKey = fromBase64Url(parsed.key);
            setMasterKeyBytes(rawKey);
          } catch {
            setError("INVALID_KEY_FORMAT: The fragment key could not be decoded.");
            setLoading(false);
            return;
          }
        }

        // 2. Fetch encrypted metadata from server
        const res = await fetch(`/api/files/${fileId}/metadata`);
        if (!res.ok) {
          setError("RESOURCE_UNAVAILABLE: This file does not exist, has expired, or was already burned after reading.");
          setLoading(false);
          return;
        }

        const data: FileMetadataResponse = await res.json();
        setFileMeta(data);

        // 3. If direct master key is present (no password), decrypt metadata immediately
        if (parsed.key) {
          const rawKey = fromBase64Url(parsed.key);
          const saltBytes = fromBase64Url(data.salt);
          const { metadataKey } = await deriveKeyHierarchy(rawKey, saltBytes);

          try {
            const decMeta = await decryptMetadata(metadataKey, data.encryptedMetadata, data.metadataIv);
            setPlainName(decMeta.name);
            setPlainSize(decMeta.size);
            setPlainType(decMeta.type);
          } catch (decErr) {
            setError("METADATA_DECRYPT_FAILED: The Master Key in the URL does not match this file's ciphertext.");
          }
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load file details.");
        setLoading(false);
      }
    }

    initPortal();
  }, [fileId]);

  // Handle Password Unlock
  const handleUnlockPassword = async () => {
    if (!passwordInput || !fileMeta || !wrappedKeyStr || !fileMeta.passwordSalt) return;

    try {
      setPasswordError(null);
      // Unwrap Master Key in Browser RAM
      const ivToUse = passwordIvStr || fileMeta.metadataIv;
      const unwrappedKey = await unwrapMasterKey(
        wrappedKeyStr,
        fileMeta.passwordSalt,
        ivToUse,
        passwordInput
      );

      setMasterKeyBytes(unwrappedKey);

      // Decrypt metadata with unwrapped key
      const saltBytes = fromBase64Url(fileMeta.salt);
      const { metadataKey } = await deriveKeyHierarchy(unwrappedKey, saltBytes);
      const decMeta = await decryptMetadata(metadataKey, fileMeta.encryptedMetadata, fileMeta.metadataIv);

      setPlainName(decMeta.name);
      setPlainSize(decMeta.size);
      setPlainType(decMeta.type);
    } catch {
      setPasswordError("Incorrect passphrase. Key unwrapping failed.");
    }
  };

  // Trigger Particle Disintegration
  const handleTriggerDisintegration = (reason: string) => {
    setTriggerCanvas(true);
    setTimeout(() => {
      setIsDisintegrated(true);
    }, 1200);
  };

  // Execute Download & Client Decryption
  const handleDownloadAndDecrypt = async () => {
    if (!fileMeta || !masterKeyBytes) return;

    try {
      setIsDownloading(true);
      setStatusMsg("Requesting capability authorization token...");

      // 1. Authorize Download
      let verifier: string | undefined;
      if (fileMeta.hasPassword && fileMeta.passwordSalt && passwordInput) {
        verifier = await computeServerVerifier(passwordInput, fromBase64Url(fileMeta.passwordSalt));
      }

      const authRes = await fetch(`/api/files/${fileId}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordVerifier: verifier }),
      });

      if (!authRes.ok) {
        const errJson = await authRes.json();
        throw new Error(errJson.error || "AUTHORIZATION_DENIED");
      }

      const { token } = await authRes.json();

      // 2. Derive FileKey
      const saltBytes = fromBase64Url(fileMeta.salt);
      const noncePrefix = fromBase64Url(fileMeta.noncePrefix);
      const { fileKey } = await deriveKeyHierarchy(masterKeyBytes, saltBytes);

      // 3. Stream & Decrypt Chunks
      const decryptedChunks: ArrayBuffer[] = [];
      const totalChunks = fileMeta.totalChunks;

      for (let i = 0; i < totalChunks; i++) {
        setStatusMsg(`Downloading & decrypting chunk ${i + 1} of ${totalChunks}...`);

        const chunkRes = await fetch(`/api/files/${fileId}/chunk/${i}?token=${token}`);
        if (!chunkRes.ok) {
          throw new Error(`Failed to retrieve chunk ${i}. Status: ${chunkRes.status}`);
        }

        const cipherBuffer = await chunkRes.arrayBuffer();

        const aadParams = {
          fileId,
          chunkIndex: i,
          totalChunks,
          isLastChunk: i === totalChunks - 1,
        };

        // Decrypt with WebCrypto AES-GCM + AAD validation
        const plainBuffer = await decryptChunk(fileKey, cipherBuffer, noncePrefix, aadParams);
        decryptedChunks.push(plainBuffer);

        setDownloadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // 4. Reassemble file in browser memory
      setStatusMsg("Reassembling payload in RAM...");
      const fullBlob = new Blob(decryptedChunks, { type: plainType || "application/octet-stream" });

      // 5. Trigger browser save
      const downloadUrl = URL.createObjectURL(fullBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = plainName || "decrypted_file.bin";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setDownloadComplete(true);
      setIsDownloading(false);

      // 6. If Burn-After-Read was enabled, trigger disintegration animation!
      if (fileMeta.burnAfterRead) {
        setTimeout(() => {
          handleTriggerDisintegration("BURN_AFTER_READ");
        }, 1500);
      }
    } catch (err: any) {
      alert(`Download Error: ${err.message}`);
      setIsDownloading(false);
    }
  };

  // Immediate Manual Revocation / Burn
  const handleManualBurn = async () => {
    if (!confirm("Are you sure? This will immediately overwrite the file on disk with zeroes and permanently destroy it.")) {
      return;
    }
    try {
      await fetch(`/api/files/${fileId}/burn`, { method: "POST" });
      handleTriggerDisintegration("MANUAL_BURN");
    } catch (err) {
      alert("Burn failed.");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl cyber-glass text-center space-y-4 font-mono">
        <RefreshCw className="w-8 h-8 animate-spin text-cyber-neonCyan mx-auto" />
        <h2 className="text-lg text-white font-bold">VERIFYING ZERO-KNOWLEDGE BOUNDARY...</h2>
        <p className="text-xs text-slate-400">Extracting URL fragment key and fetching encrypted metadata.</p>
      </div>
    );
  }

  // File Disintegrated / Eradicated Screen
  if (isDisintegrated) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl bg-black/90 border border-rose-500/50 text-center space-y-4 font-mono shadow-[0_0_30px_rgba(255,0,60,0.3)]">
        <div className="p-4 rounded-full bg-rose-950/60 border border-rose-500 text-rose-500 inline-block">
          <Flame className="w-12 h-12 glow-red animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
          PERMANENTLY ERADICATED
        </h1>
        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          This file was destroyed using DoD 5220.22-M 3-pass overwrite (zeroes, ones, random bytes) and unlinked from physical disk. It has ceased to exist.
        </p>
        <div className="pt-4">
          <a
            href="/"
            className="px-5 py-2.5 rounded-lg bg-cyber-darker hover:bg-slate-800 text-xs text-cyber-neonCyan border border-cyber-neonCyan/30 transition-colors inline-block"
          >
            ← Return to Upload Studio
          </a>
        </div>
      </div>
    );
  }

  // Error / File Missing Screen
  if (error || !fileMeta) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 rounded-2xl cyber-glass border border-rose-500/40 text-center space-y-4 font-mono">
        <div className="p-3 rounded-full bg-rose-950/40 border border-rose-500/50 text-rose-500 inline-block">
          <AlertOctagon className="w-10 h-10 glow-red" />
        </div>
        <h2 className="text-xl font-bold text-white">ACCESS DENIED / GONE</h2>
        <p className="text-xs text-rose-300 leading-relaxed max-w-md mx-auto">{error}</p>
        <div className="pt-4">
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-white hover:bg-slate-700 transition-colors inline-block"
          >
            Go to Upload Studio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative max-w-2xl mx-auto space-y-6 py-6">
      {/* Particle Disintegration Canvas */}
      <DisintegrationCanvas trigger={triggerCanvas} />

      {/* Main Download Card */}
      <div className="cyber-glass-glow rounded-2xl p-6 sm:p-8 space-y-6 border border-cyber-neonCyan/30 relative overflow-hidden">
        {/* Header with Badges */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-cyber-neonCyan/15 pb-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyber-neonCyan/15 text-cyber-neonCyan border border-cyber-neonCyan/40">
                E2EE VERIFIED
              </span>
              {fileMeta.burnAfterRead && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-500" /> BURN-AFTER-READ
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white">
              DECRYPT & DOWNLOAD
            </h1>
          </div>

          {/* Countdown Ring (if expiring) */}
          {fileMeta.expiresAt && (
            <CountdownRing
              expiresAtIso={fileMeta.expiresAt}
              onExpire={() => handleTriggerDisintegration("TTL_EXPIRED")}
            />
          )}
        </div>

        {/* Decrypted Metadata Display */}
        {plainName ? (
          <div className="p-4 rounded-xl bg-cyber-darker border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-cyber-neonCyan/10 text-cyber-neonCyan border border-cyber-neonCyan/30">
                <FileText className="w-6 h-6 glow-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{plainName}</h3>
                <p className="text-[11px] text-slate-400">
                  {formatBytes(plainSize)} • {plainType} • {fileMeta.totalChunks} Chunks
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <div>
                <span className="text-slate-500">Downloads Remaining:</span>{" "}
                <span className="text-white font-bold">
                  {fileMeta.maxDownloads - fileMeta.downloadCount} of {fileMeta.maxDownloads}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Decryption Key:</span>{" "}
                <span className="text-emerald-400 font-bold">LOCKED IN RAM</span>
              </div>
            </div>
          </div>
        ) : (
          /* Password Prompt if key is wrapped */
          <div className="p-4 rounded-xl bg-cyber-darker border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center space-x-2 text-cyber-neonCyan font-bold">
              <Lock className="w-4 h-4" />
              <span>PASSPHRASE REQUIRED FOR UNWRAPPING</span>
            </div>
            <p className="text-[11px] text-slate-400">
              The sender wrapped the Master Key with a secret passphrase. Enter it below to unwrap the key in browser memory:
            </p>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Enter decryption passphrase..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-black/60 border border-slate-700 rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyber-neonCyan"
              />
              {passwordError && (
                <p className="text-[11px] text-rose-400">{passwordError}</p>
              )}
              <button
                onClick={handleUnlockPassword}
                className="w-full py-2 bg-cyber-neonCyan text-black font-bold rounded hover:bg-cyan-300 transition-colors"
              >
                UNWRAP MASTER KEY
              </button>
            </div>
          </div>
        )}

        {/* Download Action Button */}
        {plainName && (
          <button
            disabled={isDownloading || downloadComplete}
            onClick={handleDownloadAndDecrypt}
            className={`w-full py-4 rounded-xl font-mono text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              downloadComplete
                ? "bg-emerald-600 text-white cursor-default"
                : isDownloading
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-cyber-neonCyan text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.7)]"
            }`}
          >
            {downloadComplete ? (
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>DOWNLOADED & VERIFIED</span>
              </div>
            ) : isDownloading ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>STREAMING & DECRYPTING CHUNKS...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>DECRYPT & SAVE TO DISK</span>
              </div>
            )}
          </button>
        )}

        {/* Live Progress Bar */}
        {isDownloading && (
          <div className="space-y-2 p-3 rounded-lg bg-black/60 border border-cyber-neonCyan/30 font-mono text-xs">
            <div className="flex items-center justify-between text-cyber-neonCyan">
              <span>{statusMsg}</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyber-neonCyan h-full transition-all duration-200"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Burn Warning */}
        {fileMeta.burnAfterRead && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between font-mono text-xs text-rose-300">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Flame className="w-4 h-4 text-rose-500" />
              This file will self-destruct from the server immediately after download.
            </span>
          </div>
        )}

        {/* Manual Burn Button */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs">
          <span className="text-slate-500">Need to eradicate before access?</span>
          <button
            onClick={handleManualBurn}
            className="text-rose-400 hover:text-rose-300 flex items-center space-x-1 underline text-[11px]"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Shred Now (Burn Instantly)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
