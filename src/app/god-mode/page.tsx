"use client";

import React from "react";
import { GodModeSplit } from "@/components/GodModeSplit";
import { Eye, Shield, Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function GodModePage() {
  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="p-6 rounded-2xl cyber-glass border border-cyber-neonCyan/30 space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyber-neonCyan/10 border border-cyber-neonCyan/30 text-cyber-neonCyan text-xs font-mono">
          <Eye className="w-3.5 h-3.5" />
          <span>ZERO-KNOWLEDGE ARCHITECTURE PROOF</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold font-mono text-white">
          GOD MODE: <span className="text-cyber-neonCyan glow-cyan">DUAL-REALITY INSPECTOR</span>
        </h1>
        <p className="text-sm text-slate-400 font-mono max-w-3xl leading-relaxed">
          See the two opposing perspectives simultaneously: on the <strong>LEFT</strong>, the authorized client browser holding the ephemeral master key and decrypted plaintext in RAM. On the <strong>RIGHT</strong>, the untrusted host server and database holding only opaque ciphertext chunks.
        </p>
      </div>

      {/* Interactive God Mode Split Component */}
      <GodModeSplit />

      {/* Explanatory Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs pt-4">
        <div className="p-4 rounded-xl cyber-glass border border-cyber-neonCyan/20 space-y-2">
          <h3 className="font-bold text-cyber-neonCyan flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> 1. RFC 3986 Anchor
          </h3>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            The master key lives exclusively in the URL fragment (<code className="text-white">#key=...</code>). Web browsers strictly exclude fragments from HTTP requests, ensuring zero transmission over the wire.
          </p>
        </div>

        <div className="p-4 rounded-xl cyber-glass border border-purple-500/20 space-y-2">
          <h3 className="font-bold text-purple-400 flex items-center gap-1.5">
            <Terminal className="w-4 h-4" /> 2. HKDF Key Isolation
          </h3>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Separate subkeys for File Chunks, Metadata, and Capability Tokens are derived via HKDF-SHA256. Compromise of one component cannot compromise the others.
          </p>
        </div>

        <div className="p-4 rounded-xl cyber-glass border border-emerald-500/20 space-y-2">
          <h3 className="font-bold text-emerald-400 flex items-center gap-1.5">
            <Eye className="w-4 h-4" /> 3. Hostile Host Immune
          </h3>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Even with root access to the database and physical hard drives, an adversary cannot read filenames, inspect MIME types, or decrypt a single chunk.
          </p>
        </div>
      </div>

      <div className="text-center pt-4">
        <Link
          href="/attack-lab"
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-cyber-darker hover:bg-slate-800 text-xs font-mono text-cyber-neonCyan border border-cyber-neonCyan/40 hover:border-cyber-neonCyan transition-all shadow-[0_0_15px_rgba(0,240,255,0.15)]"
        >
          <span>PROCEED TO ATTACK LAB 😈 (ATTACK YOUR OWN BUILD)</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
