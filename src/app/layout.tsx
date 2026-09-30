import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "PHANTOM 👻 | Zero-Knowledge Expiring File Sharing",
  description: "Share it. Then make it never exist. Client-side WebCrypto AES-256-GCM, ephemeral URL fragment keys, atomic burn deletion, and live Attack Lab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-cyber-black text-slate-100 cyber-grid flex flex-col antialiased selection:bg-cyber-neonCyan selection:text-black">
        {/* Subtle scanline overlay */}
        <div className="fixed inset-0 pointer-events-none z-40 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40" />

        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 z-10">
          {children}
        </main>

        <footer className="border-t border-cyber-neonCyan/15 cyber-glass py-6 mt-12 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold">PHANTOM 👻</span>
              <span>— Zero-Knowledge Cryptographic Erasure Architecture</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-emerald-400">OWASP ASVS L2</span>
              <span>•</span>
              <span className="text-cyber-neonCyan">RFC 3986 URL Fragment Anchored</span>
              <span>•</span>
              <span className="text-purple-400">DoD 5220.22-M Shredder</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
