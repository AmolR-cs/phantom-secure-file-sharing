"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, ShieldCheck, ShieldAlert, CheckCircle2, AlertOctagon, 
  RefreshCw, Link as LinkIcon, Database, Terminal, Flame 
} from "lucide-react";

interface AuditEntry {
  id: string;
  sequence: number;
  prevHash: string;
  currentHash: string;
  timestamp: string;
  eventType: string;
  linkId: string | null;
  ipHash: string;
  userAgentHash: string;
  status: string;
  details: string | null;
}

interface VerificationResult {
  valid: boolean;
  totalEntries: number;
  corruptedSequence?: number;
  reason?: string;
  headHash?: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [tamperMsg, setTamperMsg] = useState<string | null>(null);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audit");
      const data = await res.json();
      setEntries(data.entries || []);
      setVerification(data.verification || null);
    } catch (err: any) {
      alert("Failed to load audit data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    await fetchAuditData();
    setIsVerifying(false);
  };

  const handleSimulateTamper = async () => {
    try {
      const res = await fetch("/api/audit/tamper-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tamper" }),
      });
      const data = await res.json();
      if (data.success) {
        setTamperMsg(`⚠️ Adversary modified Sequence #${data.tamperedSequence} directly in DB! Click "VERIFY INTEGRITY" to test detection.`);
        await fetchAuditData();
      }
    } catch {
      alert("Simulation failed.");
    }
  };

  const handleResetLog = async () => {
    if (!confirm("Reset audit table?")) return;
    try {
      await fetch("/api/audit/tamper-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setTamperMsg(null);
      await fetchAuditData();
    } catch {
      alert("Reset failed.");
    }
  };

  return (
    <div className="space-y-6 py-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-6 rounded-2xl cyber-glass border border-cyber-neonCyan/30">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 text-cyber-neonCyan text-xs">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>CRYPTOGRAPHIC HASH-CHAIN</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            TAMPER-EVIDENT <span className="text-cyber-neonCyan glow-cyan">AUDIT TRAIL</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Every access, download, and burn event commits to the SHA-256 hash of the previous record. Any insertion, modification, or row deletion in SQLite instantly severs the chain and is mathematically flagged.
          </p>
        </div>

        {/* Verification Trigger Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <button
            disabled={isVerifying}
            onClick={handleVerifyIntegrity}
            className="px-5 py-3 rounded-xl bg-cyber-neonCyan text-black font-bold flex items-center justify-center space-x-2 hover:bg-cyan-300 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>WALKING HASH CHAIN...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>VERIFY CHAIN INTEGRITY</span>
              </>
            )}
          </button>

          <button
            onClick={handleSimulateTamper}
            className="px-4 py-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/40 font-bold transition-all text-center"
          >
            SIMULATE DB TAMPER
          </button>
        </div>
      </div>

      {/* Alert banner if simulated tamper occurred */}
      {tamperMsg && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-300 flex items-center justify-between">
          <span>{tamperMsg}</span>
          <button onClick={handleResetLog} className="underline text-amber-200">
            Reset Chain
          </button>
        </div>
      )}

      {/* Verification Integrity Status Card */}
      {verification && (
        <div
          className={`p-6 rounded-2xl border transition-all ${
            verification.valid
              ? "bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_20px_rgba(0,255,102,0.15)]"
              : "bg-rose-950/40 border-rose-500/70 shadow-[0_0_25px_rgba(255,0,60,0.3)] animate-pulse"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div
                className={`p-3 rounded-xl ${
                  verification.valid
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/30 text-rose-400"
                }`}
              >
                {verification.valid ? (
                  <CheckCircle2 className="w-8 h-8 glow-green" />
                ) : (
                  <AlertOctagon className="w-8 h-8 glow-red" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {verification.valid
                    ? "CHAIN INTEGRITY VERIFIED (100% UNTAMPERED)"
                    : `CHAIN COMPROMISED AT SEQUENCE #${verification.corruptedSequence}`}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {verification.valid
                    ? `All ${verification.totalEntries} sequential cryptographic hash links verified from Genesis block to Head.`
                    : verification.reason}
                </p>
              </div>
            </div>

            <div className="text-right text-[11px] text-slate-400">
              <span className="block text-slate-500">Chain Head Hash:</span>
              <span className="font-mono text-white text-[10px] break-all">
                {verification.headHash ? `${verification.headHash.slice(0, 24)}...` : "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="cyber-glass rounded-2xl border border-cyber-neonCyan/20 overflow-hidden">
        <div className="p-4 bg-cyber-darker border-b border-slate-800 flex items-center justify-between">
          <span className="font-bold text-white">CRYPTOGRAPHIC LEDGER ENTRIES</span>
          <span className="text-slate-500">{entries.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-black/60 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">Seq #</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Event</th>
                <th className="p-3">Status</th>
                <th className="p-3">Current Hash (SHA-256)</th>
                <th className="p-3">Previous Hash</th>
                <th className="p-3">Client Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Ledger empty. Upload or interact with files to generate hash-chained records.
                  </td>
                </tr>
              ) : (
                entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 text-cyber-neonCyan font-bold">#{item.sequence}</td>
                    <td className="p-3 text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="p-3 font-bold text-white">{item.eventType}</td>
                    <td className="p-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.status === "SUCCESS"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : item.status.includes("FORGED") || item.status.includes("TAMPER")
                            ? "bg-rose-500/30 text-rose-400 border border-rose-500/50"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-mono text-[10px]" title={item.currentHash}>
                      {item.currentHash.slice(0, 16)}...
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[10px]" title={item.prevHash}>
                      {item.prevHash.slice(0, 16)}...
                    </td>
                    <td className="p-3 text-slate-500">{item.ipHash}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
