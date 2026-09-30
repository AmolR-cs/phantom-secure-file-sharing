"use client";

import React, { useState } from "react";
import { 
  Terminal, ShieldCheck, Play, RefreshCw, AlertTriangle, Bug, Zap, 
  Flame, Key, Lock, EyeOff, ShieldAlert, CheckCircle2, ChevronDown, ChevronRight 
} from "lucide-react";

interface VectorInfo {
  id: string;
  name: string;
  category: string;
  stride: string;
  description: string;
  defense: string;
  icon: any;
}

const ATTACK_VECTORS: VectorInfo[] = [
  {
    id: "tampered-ciphertext",
    name: "1-Bit Ciphertext Tampering",
    category: "OWASP A02: Cryptographic Failures",
    stride: "Tampering",
    description: "Inverts 1 single bit in an AES-256-GCM encrypted chunk payload before decryption.",
    defense: "Hardware-accelerated AES-256-GCM 128-bit authentication tag verification",
    icon: Bug,
  },
  {
    id: "chunk-reorder",
    name: "Chunk Reordering / Swap Attack",
    category: "OWASP A08: Software & Data Integrity",
    stride: "Tampering",
    description: "Inverts chunk sequence (substitutes chunk 0 into chunk 1 slot) to corrupt stream assembly.",
    defense: "Canonical binary AAD binding (fileId + chunkIndex + isLastChunk)",
    icon: Zap,
  },
  {
    id: "replayed-token",
    name: "Capability Token Replay Attack",
    category: "OWASP A07: Identification & Auth",
    stride: "Spoofing",
    description: "Adversary captures a signed capability token and attempts a second download retrieval.",
    defense: "Single-use HMAC-SHA256 token nonces recorded in atomic UsedNonce cache",
    icon: RefreshCw,
  },
  {
    id: "burn-race",
    name: "Parallel Burn Race Condition (50 Threads)",
    category: "OWASP A01: Broken Access Control",
    stride: "Denial of Service / Race Condition",
    description: "Fires 50 simultaneous concurrent parallel requests against a burn-after-read link.",
    defense: "Atomic conditional DB write (guarantees exactly 1 winner, 49 rejected)",
    icon: Flame,
  },
  {
    id: "brute-force",
    name: "Automated Password Brute-Force",
    category: "OWASP A07: Authentication Bypass",
    stride: "Elevation of Privilege",
    description: "Rapid dictionary assault against capability token endpoint for password-protected link.",
    defense: "Sliding-window token bucket + exponential lockout backoff (HTTP 429)",
    icon: Lock,
  },
  {
    id: "link-enumeration",
    name: "Link Identifier Enumeration Attack",
    category: "OWASP A01: Information Disclosure",
    stride: "Information Disclosure",
    description: "Scans random link IDs to infer active vs missing links via response & timing differences.",
    defense: "128-bit CSPRNG link space ($2^{128}$) + synthetic timing jitter pad (25-60ms)",
    icon: EyeOff,
  },
  {
    id: "xss-payload",
    name: "Malicious File / XSS Polyglot Upload",
    category: "OWASP A03: Injection",
    stride: "Elevation of Privilege",
    description: "Uploads an executable SVG/HTML polyglot payload containing inline <script> tags.",
    defense: "Forced application/octet-stream + attachment disposition + Strict CSP",
    icon: AlertTriangle,
  },
  {
    id: "expired-link",
    name: "Expired-Link DoD File Shredding",
    category: "OWASP A04: Insecure Design / Data Remanence",
    stride: "Information Disclosure",
    description: "Attempts retrieval of expired resource to test physical storage data remanence.",
    defense: "DoD 5220.22-M 3-pass overwrite (0x00, 0xFF, random) + fsyncSync + unlink",
    icon: ShieldAlert,
  },
];

export default function AttackLabPage() {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);

  const runAttack = async (vectorId: string) => {
    try {
      setLoadingMap((prev) => ({ ...prev, [vectorId]: true }));
      const res = await fetch(`/api/attack-lab/${vectorId}`, {
        method: "POST",
      });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [vectorId]: data }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [vectorId]: { error: err.message, attackPassed: false },
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [vectorId]: false }));
    }
  };

  const runAllAttacks = async () => {
    setIsRunningAll(true);
    for (const v of ATTACK_VECTORS) {
      await runAttack(v.id);
    }
    setIsRunningAll(false);
  };

  const toggleExpand = (vectorId: string) => {
    setExpandedMap((prev) => ({ ...prev, [vectorId]: !prev[vectorId] }));
  };

  const totalDefended = Object.values(results).filter((r) => r.attackPassed).length;

  return (
    <div className="space-y-6 py-4">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 rounded-2xl cyber-glass border border-cyber-neonCyan/30">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400 text-xs font-mono">
            <Terminal className="w-3.5 h-3.5" />
            <span>RED-TEAM ADVERSARY SIMULATOR</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-mono text-white">
            ATTACK LAB 😈 <span className="text-rose-500 glow-red">ATTACK YOUR OWN BUILD</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-mono max-w-2xl leading-relaxed">
            Execute real-world exploits directly against this live application instance. Watch the defensive controls intercept, isolate, and neutralize each threat in real time.
          </p>
        </div>

        {/* Global Controls & Score */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 font-mono text-xs w-full lg:w-auto">
          <div className="p-3 rounded-xl bg-cyber-darker border border-slate-800 text-center w-full sm:w-auto">
            <span className="text-[10px] text-slate-500 block">DEFENSIVE SCORE</span>
            <span className="text-xl font-bold text-emerald-400 glow-green">
              {totalDefended} / {ATTACK_VECTORS.length} DEFENDED
            </span>
          </div>

          <button
            disabled={isRunningAll}
            onClick={runAllAttacks}
            className={`w-full sm:w-auto px-6 py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all ${
              isRunningAll
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(255,0,60,0.4)]"
            }`}
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>FIRING ALL ASSAULTS...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>LAUNCH FULL ASSAULT (ALL 8)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 8 Attack Vector Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ATTACK_VECTORS.map((v, idx) => {
          const Icon = v.icon;
          const res = results[v.id];
          const isLoading = loadingMap[v.id];
          const isExpanded = expandedMap[v.id];

          return (
            <div
              key={v.id}
              className={`rounded-xl cyber-glass border p-5 space-y-4 font-mono text-xs transition-all ${
                res?.attackPassed
                  ? "border-emerald-500/40 bg-emerald-950/10 shadow-[0_0_15px_rgba(0,255,102,0.1)]"
                  : res?.attackPassed === false
                  ? "border-rose-500/60 bg-rose-950/20"
                  : "border-slate-800 hover:border-cyber-neonCyan/30"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-cyber-darker border border-slate-700 text-rose-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">
                      VECTOR 0{idx + 1} • {v.stride}
                    </span>
                    <h3 className="text-sm font-bold text-white">{v.name}</h3>
                  </div>
                </div>

                {/* Status Badge */}
                {res && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                      res.attackPassed
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 glow-green"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/50 glow-red"
                    }`}
                  >
                    {res.attackPassed ? "[ DEFENDED ]" : "[ BREACHED ]"}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {v.description}
              </p>

              {/* Active Defense Callout */}
              <div className="p-2.5 rounded-lg bg-cyber-darker/80 border border-slate-800/80 space-y-1 text-[11px]">
                <span className="text-slate-500 text-[10px] block">ACTIVE DEFENSE:</span>
                <span className="text-cyber-neonCyan font-bold">{v.defense}</span>
              </div>

              {/* Action Button & Expand Toggle */}
              <div className="flex items-center justify-between pt-1">
                <button
                  disabled={isLoading}
                  onClick={() => runAttack(v.id)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition-all ${
                    isLoading
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-cyber-darker hover:bg-slate-800 text-rose-400 border border-rose-500/40 hover:border-rose-500"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ATTACKING...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>SIMULATE ATTACK</span>
                    </>
                  )}
                </button>

                {res && (
                  <button
                    onClick={() => toggleExpand(v.id)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <span>View Diagnostic Trace</span>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Diagnostic Trace Box */}
              {isExpanded && res && (
                <div className="p-3 rounded-lg bg-black/80 border border-slate-800 text-[10px] space-y-2 mt-2">
                  <div className="text-slate-400 flex items-center justify-between">
                    <span>Adversary Response:</span>
                    <span className="text-emerald-400 font-bold">Threat Neutralized</span>
                  </div>
                  <pre className="text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(res.details || res, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
