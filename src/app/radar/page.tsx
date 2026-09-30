"use client";

import React, { useState, useEffect } from "react";
import { Radio, ShieldAlert, ShieldCheck, Flame, Lock, Globe2, AlertTriangle } from "lucide-react";
import { RadarEvent } from "@/lib/security/sse";

export default function ThreatRadarPage() {
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    const eventSource = new EventSource("/api/threat-radar");

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.id) {
          setEvents((prev) => {
            // Deduplicate
            if (prev.some((item) => item.id === data.id)) return prev;
            return [data, ...prev.slice(0, 49)];
          });
        }
      } catch {
        // Heartbeat or malformed
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const totalBlocked = events.filter((e) => e.status === "BLOCKED" || e.status === "TAMPER").length;
  const totalBurned = events.filter((e) => e.status === "BURNED").length;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl cyber-glass border border-cyber-neonCyan/30">
        <div className="flex items-center space-x-3">
          <div className="relative p-2.5 rounded-lg bg-cyber-darker border border-cyber-neonCyan/40 text-cyber-neonCyan">
            <Radio className="w-6 h-6 animate-pulse" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neonCyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-neonCyan"></span>
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white flex items-center gap-2">
              <span>THREAT RADAR</span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyber-neonCyan/15 text-cyber-neonCyan border border-cyber-neonCyan/30 font-mono">
                LIVE SSE FEED
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Real-time monitoring of link access, atomic burn executions, and blocked adversary probes.
            </p>
          </div>
        </div>

        {/* Live SSE Status */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? "bg-emerald-400 shadow-[0_0_8px_#00ff66]" : "bg-rose-500 animate-pulse"
            }`}
          />
          <span className={connected ? "text-emerald-400" : "text-rose-400"}>
            {connected ? "RADAR ACTIVE (ONLINE)" : "CONNECTING..."}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 rounded-xl cyber-glass border border-cyber-neonCyan/20">
          <span className="text-slate-400 block text-[11px]">EVENTS MONITORED</span>
          <span className="text-2xl font-bold text-white glow-cyan">{events.length}</span>
        </div>
        <div className="p-4 rounded-xl cyber-glass border border-rose-500/30">
          <span className="text-slate-400 block text-[11px]">ATTACKS BLOCKED</span>
          <span className="text-2xl font-bold text-rose-400 glow-red">{totalBlocked}</span>
        </div>
        <div className="p-4 rounded-xl cyber-glass border border-purple-500/30">
          <span className="text-slate-400 block text-[11px]">BURNS EXECUTED</span>
          <span className="text-2xl font-bold text-purple-400 glow-purple">{totalBurned}</span>
        </div>
        <div className="p-4 rounded-xl cyber-glass border border-emerald-500/30">
          <span className="text-slate-400 block text-[11px]">INTEGRITY POSTURE</span>
          <span className="text-2xl font-bold text-emerald-400 glow-green">100% HARDENED</span>
        </div>
      </div>

      {/* Radar Map & Visual Sweep */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Circular Scanner */}
        <div className="cyber-glass rounded-2xl p-6 border border-cyber-neonCyan/30 flex flex-col items-center justify-center relative overflow-hidden min-h-[320px]">
          <div className="text-center font-mono text-xs text-cyber-neonCyan mb-4 flex items-center gap-1.5">
            <Globe2 className="w-4 h-4" /> GLOBAL ANOMALY RADAR
          </div>

          <div className="relative w-56 h-56 rounded-full border border-cyber-neonCyan/30 flex items-center justify-center bg-black/40">
            {/* Concentric rings */}
            <div className="absolute w-44 h-44 rounded-full border border-cyber-neonCyan/20" />
            <div className="absolute w-28 h-28 rounded-full border border-cyber-neonCyan/20" />
            <div className="absolute w-12 h-12 rounded-full border border-cyber-neonCyan/30" />
            <div className="absolute w-full h-[1px] bg-cyber-neonCyan/20" />
            <div className="absolute h-full w-[1px] bg-cyber-neonCyan/20" />

            {/* Rotating radar sweep cone */}
            <div className="absolute inset-0 rounded-full animate-radar-sweep radar-sweep-cone pointer-events-none" />

            {/* Central Node */}
            <div className="w-3 h-3 rounded-full bg-cyber-neonCyan shadow-[0_0_12px_#00f0ff] z-10" />

            {/* Dynamic Blips */}
            {events.slice(0, 6).map((evt, idx) => {
              const angle = (idx * 60 * Math.PI) / 180;
              const dist = 40 + (idx % 3) * 25;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              const isDanger = evt.status === "BLOCKED" || evt.status === "TAMPER";

              return (
                <div
                  key={evt.id}
                  className="absolute transition-all"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                >
                  <span className="relative flex h-3 w-3">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isDanger ? "bg-rose-500" : "bg-cyber-neonCyan"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-3 w-3 ${
                        isDanger ? "bg-rose-500" : "bg-cyber-neonCyan"
                      }`}
                    />
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 font-mono text-[10px] text-slate-400 text-center">
            Tracking Active Telemetry & Decryption Probes
          </div>
        </div>

        {/* Live Event Stream Table */}
        <div className="lg:col-span-2 cyber-glass rounded-2xl p-6 border border-cyber-neonCyan/20 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
            <h3 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
              Live Intercept Stream
            </h3>
            <span className="font-mono text-[10px] text-slate-500">
              Auto-updating via SSE connection
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 pr-1 font-mono text-xs">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                Awaiting telemetry events... Launch an upload or run an Attack Lab test.
              </div>
            ) : (
              events.map((evt) => {
                const isBlocked = evt.status === "BLOCKED" || evt.status === "TAMPER";
                const isBurn = evt.status === "BURNED";

                return (
                  <div
                    key={evt.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isBlocked
                        ? "bg-rose-950/30 border-rose-500/50 shadow-[0_0_12px_rgba(255,0,60,0.15)]"
                        : isBurn
                        ? "bg-purple-950/20 border-purple-500/40"
                        : "bg-cyber-darker border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isBlocked
                              ? "bg-rose-500 text-white"
                              : isBurn
                              ? "bg-purple-500 text-white"
                              : "bg-cyber-neonCyan/20 text-cyber-neonCyan border border-cyber-neonCyan/40"
                          }`}
                        >
                          {evt.status}
                        </span>
                        <span className="text-white font-bold">{evt.type}</span>
                        <span className="text-slate-500 text-[10px]">
                          [{evt.geo.city}, {evt.geo.country}]
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className={`text-[11px] ${isBlocked ? "text-rose-300" : "text-slate-300"}`}>
                      {evt.details}
                    </p>

                    <div className="mt-1 text-[10px] text-slate-500 flex items-center justify-between">
                      <span>IP Hash: {evt.ipHash}</span>
                      <span>Coordinates: {evt.geo.lat.toFixed(2)}, {evt.geo.lng.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
