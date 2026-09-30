"use client";

import React, { useState } from "react";
import { Lock, Eye, Server, ShieldCheck, Database, Key, FileSpreadsheet } from "lucide-react";

interface GodModeData {
  fileId: string;
  masterKey: string;
  plainName: string;
  plainSize: number;
  plainType: string;
  plainContentSnippet: string;
  encryptedMetadata: string;
  salt: string;
  noncePrefix: string;
  chunkCount: number;
  dbStatus: string;
}

const DEFAULT_SAMPLE_DATA: GodModeData = {
  fileId: "phantom_7f39b1a0d84c2049e25d0c",
  masterKey: "e4A7x_R90qL2mP8sT1vW4zY7bC3eG5hJ-K9nM2pQ4rS",
  plainName: "merger_acquisition_agreement_classified.docx",
  plainSize: 3450892,
  plainType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  plainContentSnippet: "CONFIDENTIAL ACQUISITION AGREEMENT\nBetween CyberDynamics Corp and ShadowHoldings Ltd.\nTotal Valuation: $4,200,000,000 USD.\nArticle 1: Cryptographic Zero-Knowledge Retention...",
  encryptedMetadata: "OuB7eXDPWq8qiF--nkQmHTzaExNnszlK78d_94a2mcP99201bcAq048xLz984c01",
  salt: "k9vL3mP8sT1vW4zY",
  noncePrefix: "a8B2cD4eF6gH",
  chunkCount: 4,
  dbStatus: "ACTIVE",
};

export function GodModeSplit({ data = DEFAULT_SAMPLE_DATA }: { data?: GodModeData }) {
  const [activeTab, setActiveTab] = useState<"split" | "client" | "server">("split");

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="w-full space-y-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl cyber-glass border border-cyber-neonCyan/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyber-neonCyan/10 border border-cyber-neonCyan/40 text-cyber-neonCyan">
            <Eye className="w-6 h-6 glow-cyan" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <span>GOD MODE INSPECTOR</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyber-neonCyan/20 text-cyber-neonCyan border border-cyber-neonCyan/40 font-mono">
                DUAL BOUNDARY
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Real-time cryptographic comparison: Client Browser Memory vs Server Database State
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1 p-1 rounded-lg bg-cyber-darker border border-slate-800">
          <button
            onClick={() => setActiveTab("split")}
            className={`px-3 py-1 text-xs font-mono rounded transition-all ${
              activeTab === "split"
                ? "bg-cyber-neonCyan text-black font-bold shadow-[0_0_10px_rgba(0,240,255,0.4)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            SPLIT VIEW
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={`px-3 py-1 text-xs font-mono rounded transition-all ${
              activeTab === "client"
                ? "bg-emerald-500 text-black font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            CLIENT ONLY
          </button>
          <button
            onClick={() => setActiveTab("server")}
            className={`px-3 py-1 text-xs font-mono rounded transition-all ${
              activeTab === "server"
                ? "bg-rose-500 text-white font-bold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            SERVER ONLY
          </button>
        </div>
      </div>

      {/* Split Comparison Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT PANEL: What Browser Sees */}
        {(activeTab === "split" || activeTab === "client") && (
          <div className="rounded-xl cyber-glass border border-emerald-500/30 overflow-hidden flex flex-col">
            <div className="p-3 bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold font-mono tracking-wider">
                  CLIENT BROWSER (TRUSTED MEMORY)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                PLAINTEXT VISIBLE
              </span>
            </div>

            <div className="p-4 space-y-4 font-mono text-xs flex-1">
              {/* Ephemeral Key */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Key className="w-3.5 h-3.5" /> 256-Bit Master Key (URL Fragment)
                  </span>
                  <span className="text-emerald-500 font-bold">CLIENT RAM ONLY</span>
                </div>
                <div className="p-2 rounded bg-black/50 text-emerald-300 break-all select-all font-mono text-[11px] border border-emerald-500/30">
                  {data.masterKey}
                </div>
                <p className="text-[10px] text-slate-500">
                  ⚠️ Anchored in URL #fragment. RFC 3986 forbids transmission to server.
                </p>
              </div>

              {/* Decrypted File Metadata */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-slate-800 space-y-2">
                <span className="text-slate-400 text-[11px] block">Decrypted File Details:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Filename:</span>
                    <span className="text-white font-bold">{data.plainName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Decrypted Size:</span>
                    <span className="text-white">{formatBytes(data.plainSize)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">MIME Type:</span>
                    <span className="text-white">{data.plainType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Chunks:</span>
                    <span className="text-white">{data.chunkCount} Chunks (1 MB each)</span>
                  </div>
                </div>
              </div>

              {/* In-Memory Plaintext Snippet */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">Plaintext Payload in RAM:</span>
                <pre className="p-2 rounded bg-black/60 text-slate-300 text-[10px] overflow-x-auto whitespace-pre-wrap font-mono border border-slate-800">
                  {data.plainContentSnippet}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT PANEL: What Server / DB Sees */}
        {(activeTab === "split" || activeTab === "server") && (
          <div className="rounded-xl cyber-glass border border-rose-500/30 overflow-hidden flex flex-col">
            <div className="p-3 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400">
                <Server className="w-4 h-4" />
                <span className="text-xs font-bold font-mono tracking-wider">
                  SERVER + DATABASE (ZERO KNOWLEDGE)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                100% CIPHERTEXT
              </span>
            </div>

            <div className="p-4 space-y-4 font-mono text-xs flex-1">
              {/* Server DB Record */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-rose-500/20 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1 text-rose-400">
                    <Database className="w-3.5 h-3.5" /> SQLite Table: FileRecord
                  </span>
                  <span className="text-rose-400 font-bold">ZERO KNOWLEDGE</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Record ID:</span>
                    <span className="text-white">{data.fileId.slice(0, 16)}...</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className="text-emerald-400 font-bold">{data.dbStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Filename in DB:</span>
                    <span className="text-rose-400 font-bold">[NULL / ZERO KNOWLEDGE]</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Master Key in DB:</span>
                    <span className="text-rose-400 font-bold">[NOT STORED]</span>
                  </div>
                </div>
              </div>

              {/* Raw Ciphertext Stored */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">
                  Encrypted Metadata (AES-256-GCM Ciphertext):
                </span>
                <div className="p-2 rounded bg-black/60 text-rose-300/80 text-[10px] break-all border border-slate-800 font-mono">
                  {data.encryptedMetadata}
                </div>
              </div>

              {/* Disk Blobs */}
              <div className="p-3 rounded-lg bg-cyber-darker border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">On-Disk Chunk Storage:</span>
                <div className="p-2 rounded bg-black/60 text-slate-400 text-[10px] space-y-0.5 border border-slate-800">
                  <div>📁 /storage/blobs/{data.fileId.slice(0, 12)}/</div>
                  <div className="text-rose-400/90 pl-4">
                    ├── chunk_0.bin (1,048,592 bytes AES-256-GCM + AAD)
                  </div>
                  <div className="text-rose-400/90 pl-4">
                    ├── chunk_1.bin (1,048,592 bytes AES-256-GCM + AAD)
                  </div>
                  <div className="text-rose-400/90 pl-4">└── chunk_N.bin (Opaque ciphertext bytes)</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Assurance Guarantee */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-950/30 via-purple-950/30 to-emerald-950/30 border border-cyber-neonCyan/30 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-300">
          🛡️ <strong className="text-white">Hostile Host Guarantee:</strong> Even if a rogue sysadmin dumps the entire database, filesystem, and API memory, they cannot recover a single filename, byte of plaintext, or cryptographic key.
        </span>
      </div>
    </div>
  );
}
