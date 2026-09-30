# PHANTOM 👻
### *"Share it. Then make it never exist."*

[![OWASP ASVS L2](https://img.shields.io/badge/OWASP%20ASVS-Level%202%20Compliant-00F0FF?style=for-the-badge&logo=shield)](SECURITY.md)
[![Web Crypto API](https://img.shields.io/badge/Crypto-Web%20Crypto%20AES--256--GCM-00FF66?style=for-the-badge)](CRYPTO.md)
[![Tests Passing](https://img.shields.io/badge/Tests-15%2F15%20Passing-brightgreen?style=for-the-badge)](#test-suite)
[![Attack Lab](https://img.shields.io/badge/Attack%20Lab-8%2F8%20Neutralized-FF003C?style=for-the-badge)](#attack-lab-)

A cybersecurity-grade, zero-knowledge, end-to-end encrypted (E2EE) file sharing platform where files are encrypted directly inside the client's browser with the W3C Web Cryptography API, keys reside exclusively in the URL fragment (`#`), expiry rules are enforced atomically in the database, blobs are eradicated using DoD-grade multi-pass shredding, and an interactive **Attack Lab** allows you to red-team and attack your own build live.

---

## 🛡️ Core Security Promise

> **Even with full root compromise of the server, physical disk access, and a complete database dump, no file content, filename, MIME type, or unpadded file size is ever readable by an adversary.**

---

## ⚡ Key Highlights & Architecture

### 1. Zero-Knowledge Cryptographic Design ([CRYPTO.md](CRYPTO.md))
- **Standard Primitives Only:** Strictly uses hardware-accelerated Web Cryptography API (`crypto.subtle`). No custom or non-standard ciphers.
- **Ephemeral URL Fragment Anchor:** Master Key (256-bit CSPRNG) lives in `#key=<base64url>`. Under RFC 3986, URL fragments are **never sent over the wire** in HTTP request headers or query strings.
- **HKDF-SHA256 Key Hierarchy:** Derives isolated keys for `FileKey`, `MetadataKey`, and `AuthKey`. Zero key reuse.
- **Chunked AES-256-GCM (1MB Chunks):** 96-bit nonces (64-bit random prefix + 32-bit counter) guarantee zero nonce collisions.
- **Authenticated Additional Data (AAD) Binding:** Every chunk binds `(fileId, chunkIndex, totalChunks, isLastChunk)`. Prevents chunk reordering, omission, or cross-file substitution attacks.
- **Zero-Knowledge Password Verifier:** Passwords derive a PBKDF2/Argon2 wrapping key client-side and an HMAC verifier for the server. The server never sees the passphrase or master key.
- **Delivery Authorization:** Short-lived (60s) HMAC-SHA256 capability tokens protected by single-use nonces against replay attacks.

### 2. Atomic Expiry & DoD-Grade Shredding
- **Zero Concurrency Race:** Atomic SQLite conditional updates guarantee that a `burn-after-read` link can only be consumed once across parallel request spikes (e.g. 50 simultaneous threads).
- **Cryptographic Hard-Delete:** Chunks are destroyed using a DoD 5220.22-M 3-pass erasure:
  1. Pass 1: `0x00` (All Zeroes) $\rightarrow$ `fsync`
  2. Pass 2: `0xFF` (All Ones) $\rightarrow$ `fsync`
  3. Pass 3: CSPRNG Random Bytes $\rightarrow$ `fsync`
  4. Step 4: Physical file unlinking (`unlinkSync`) + verification audit proving 0 dangling blobs.

### 3. Application Hardening ([SECURITY.md](SECURITY.md))
- **Strict Headers:** Nonced CSP, COOP, COEP, CORP, HSTS, `Referrer-Policy: no-referrer` (prevents fragment leakage), `X-Content-Type-Options: nosniff`.
- **Forced Downloads:** Chunks served strictly as `application/octet-stream` with `Content-Disposition: attachment; filename="encrypted_payload.bin"` and `no-store` anti-caching headers. Inline execution is impossible.
- **Enumeration Resistance:** 128-bit CSPRNG identifiers with identical response bodies and synthetic timing jitter padding (25-60ms) for missing vs. burned files.
- **Brute-Force Lockout:** Token-bucket rate limiting with exponential backoff on failed password attempts (HTTP 429).

### 4. Tamper-Evident Hash-Chained Audit Trail
- Merkle-style SHA-256 hash-chained log where every entry commits to the hash of the preceding record:
  $$H_n = \text{SHA256}(\text{Seq}_n \parallel H_{n-1} \parallel \text{Time}_n \parallel \text{Event}_n \parallel \text{IP}_{\text{hash}} \parallel \text{Status}_n)$$
- "Verify Integrity" engine walks the chain from Genesis to Head. Any modification or row deletion in SQLite is flagged immediately.

### 5. WOW Layer & Attack Lab 😈
- **GOD MODE:** Dual-reality split-screen comparing Client Browser View (decrypted) vs Server/DB View (100% ciphertext).
- **Threat Radar:** Real-time Server-Sent Events (SSE) telemetry feed with animated circular radar scanner and pulsating blips.
- **Disintegration Canvas:** When a file burns or expires, the card dematerializes into an animated cloud of digital embers and particles.
- **ATTACK LAB 😈:** Interactive cyber-range dashboard with 8 automated exploit buttons:
  1. *1-Bit Tamper Injection* (AES-GCM tag mismatch)
  2. *Chunk Reordering Attack* (AAD binding discordance)
  3. *Capability Token Replay* (Single-use nonce rejection)
  4. *Parallel Burn Race Condition (50 Threads)* (Atomic SQL conditional update)
  5. *Automated Password Brute-Force* (Exponential IP lockout)
  6. *Link Enumeration / Timing Probe* (Uniform 404 + synthetic timing pad)
  7. *Malicious SVG/HTML XSS Polyglot* (Forced octet-stream + Strict CSP)
  8. *Expired-Link Blob Shredding* (DoD 3-pass overwrite + zero dangling blobs verification)

---

## 🚀 Quickstart & Commands

### Prerequisites
- Node.js 18+ (tested on Node v20/v22/v24)
- npm 9+

### Installation & Setup
```bash
# Clone the repository
git clone https://github.com/your-username/phantom-secure-share.git
cd phantom-secure-share

# Install dependencies
npm install

# Initialize database schema
npm run db:push

# Start development server
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Automated Testing & Adversary Simulation

### Run Headless Attack Lab (Red-Team Suite)
```bash
npm run attack
```
*Executes all 8 adversarial exploits against the application and prints a formatted terminal report proving defensive neutralization.*

### Run 90-Second Full Story Demonstration
```bash
npm run demo
```
*Runs the complete automated lifecycle: Alice browser encryption $\rightarrow$ URL fragment passing $\rightarrow$ Bob decryption $\rightarrow$ DoD shredding $\rightarrow$ hash chain audit.*

### Run Unit & Concurrency Test Suite
```bash
npm test
```
*Runs 15 automated Vitest unit tests covering crypto round-trip, AAD tamper detection, chunk reordering rejection, 50-thread atomic burn concurrency, and hash-chain tampering.*

---

## 📁 Repository Structure

```
├── CRYPTO.md                   # Complete Cryptographic Specification
├── SECURITY.md                 # OWASP ASVS L2, OWASP Top 10, STRIDE Threat Model
├── DEMO.md                     # 3-Minute Hackathon Presentation Script
├── PITCH.md                    # 5-Slide Pitch Deck Outline
├── scripts/
│   ├── attack-runner.ts        # Headless Attack Lab CLI (npm run attack)
│   └── demo-walkthrough.ts     # 90-second automated demo story (npm run demo)
├── tests/
│   ├── crypto.test.ts          # WebCrypto roundtrip, AAD, tamper, reorder tests
│   ├── burn-race.test.ts       # 50-thread atomic burn concurrency test
│   └── audit-chain.test.ts     # Hash-chain integrity and tamper detection tests
├── src/
│   ├── app/
│   │   ├── page.tsx            # Upload Studio & WebCrypto progress bar
│   │   ├── f/[id]/page.tsx     # Recipient Portal & Particle Disintegration
│   │   ├── radar/page.tsx      # Threat Radar live SSE scanner
│   │   ├── god-mode/page.tsx   # Dual-Reality Client vs Server comparison
│   │   ├── attack-lab/page.tsx # Interactive Red-Team Attack Lab
│   │   ├── audit/page.tsx      # Tamper-Evident Hash Chain Inspector
│   │   └── api/                # Next.js App Router API endpoints
│   ├── components/
│   │   ├── Navbar.tsx          # Cyberpunk navigation header
│   │   ├── CountdownRing.tsx   # SVG animated circular countdown timer
│   │   ├── DisintegrationCanvas.tsx # Canvas particle explosion effect
│   │   └── GodModeSplit.tsx    # Interactive dual-reality comparison
│   └── lib/
│       ├── crypto/             # WebCrypto keys, HKDF, AAD, cipher, password, tokens
│       ├── storage/            # Local DoD 3-pass overwrite shredder
│       ├── audit/              # SHA-256 hash-chain ledger engine
│       ├── security/           # Rate limiting, timing pads, threat radar SSE
│       └── services/           # Atomic file service & download transactions
└── prisma/
    └── schema.prisma           # Prisma SQLite schema (Postgres-ready)
```

---

## ⚖️ License & Responsible Disclosure
This project is open-source under the MIT License. For vulnerability reports, review [SECURITY.md](SECURITY.md).
