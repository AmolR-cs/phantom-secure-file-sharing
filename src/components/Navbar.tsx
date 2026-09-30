"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Radio, Terminal, Eye, FileText, Lock } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Upload Studio", icon: Shield },
    { href: "/radar", label: "Threat Radar", icon: Radio, pulse: true },
    { href: "/god-mode", label: "GOD MODE", icon: Eye },
    { href: "/attack-lab", label: "Attack Lab 😈", icon: Terminal },
    { href: "/audit", label: "Audit Chain", icon: FileText },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyber-neonCyan/20 cyber-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-lg bg-cyber-darker border border-cyber-neonCyan/40 flex items-center justify-center group-hover:border-cyber-neonCyan group-hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all">
            <span className="text-xl">👻</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-wider font-mono text-white group-hover:text-cyber-neonCyan transition-colors">
                PHANTOM
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-cyber-neonCyan/10 text-cyber-neonCyan border border-cyber-neonCyan/30">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              Share it. Then make it never exist.
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-1.5 rounded-md font-mono text-xs sm:text-sm flex items-center space-x-2 transition-all ${
                  isActive
                    ? "bg-cyber-neonCyan/15 text-cyber-neonCyan border border-cyber-neonCyan/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-cyber-neonCyan" : "text-slate-400"}`} />
                <span>{item.label}</span>
                {item.pulse && (
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neonRed opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-neonRed"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Security Badge */}
        <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>ZERO-KNOWLEDGE E2EE</span>
        </div>
      </div>
    </header>
  );
}
