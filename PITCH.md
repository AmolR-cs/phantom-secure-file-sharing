# PHANTOM 👻 5-Slide Pitch Deck Outline (PITCH.md)

---

## Slide 1: The Fatal Flaw of Modern File Sharing
* **Title:** Your "Expiring Links" Are Storing Plaintext Forever
* **Problem Statement:**
  * Modern cloud storage (Google Drive, WeTransfer, Dropbox) operates under a **Trusted Host** model: servers hold decryption keys, read filenames, and retain deleted files in cold storage.
  * Links with expiration timers typically just hide the download UI while unencrypted blobs remain on S3, subject to subpoenas, data breaches, and insider threats.
* **The Punchline:** If a breach occurs tomorrow, all historical files ever shared on the platform are fully compromised.

---

## Slide 2: The Solution: PHANTOM 👻
* **Tagline:** *"Share it. Then make it never exist."*
* **Core Value Proposition:**
  * **Hostile Host Tolerance:** Built on the assumption that the host server, DB, and network are completely hostile or compromised.
  * **Zero-Knowledge by Construction:** Encryption happens strictly inside the client's browser using the W3C Web Cryptography API.
  * **RFC 3986 URL Fragment Anchors:** The 256-bit master key resides exclusively in `#key=...`. By internet standards, URL fragments are **never** transmitted across HTTP headers.

---

## Slide 3: Cybersecurity-Grade Cryptographic Architecture
* **Key Hierarchy & Derivation:**
  * Master Key (256-bit CSPRNG) $\rightarrow$ HKDF-SHA256 separate keys for:
    1. `FileKey` (AES-256-GCM chunked encryption)
    2. `MetadataKey` (Encrypts filename, true size, and MIME type)
    3. `AuthKey` (Signs capability delivery requests)
* **Authenticated Additional Data (AAD) Defense:**
  * Nonce: 64-bit random prefix + 32-bit counter.
  * AAD binds: `(FileID, ChunkIndex, TotalChunks, isLastChunk)`.
  * Mathematically eliminates chunk reordering, omission, or cross-file tampering.

---

## Slide 4: Real-Time Adversarial Proof: Attack Lab 😈
* **"Attack Your Own Build":**
  * We don't just assert security—we provide an interactive Red-Team testing suite with 8 live attack vectors:
    1. *1-Bit Tamper Injection:* AES-GCM tag verification failure ($p < 2^{-128}$).
    2. *Chunk Swapping:* AAD discordance halt.
    3. *Token Replay:* Single-use nonce ledger rejection.
    4. *50-Thread Parallel Race:* Atomic conditional SQLite write eliminates race conditions.
    5. *Password Brute-Force:* Exponential lockout with token-bucket limiter.
    6. *Link Enumeration:* 128-bit CSPRNG link space + synthetic timing jitter pads.
    7. *XSS Polyglots:* Forced `application/octet-stream` download + Strict CSP.
    8. *Data Remanence:* DoD 5220.22-M 3-pass overwrite + `fsync` verification.

---

## Slide 5: Market Impact & Zero-Trust Enterprise Future
* **Target Audience:**
  * M&A Financial Deal Rooms, Whistleblowers & Journalists, Cybersecurity Incident Response Teams, Defense & Intelligence Contractors, Executive Board Communications.
* **Why PHANTOM Wins:**
  * Zero software installation required (runs in standard web browsers).
  * Tamper-evident SHA-256 Merkle-style hash-chained audit trails.
  * Provable compliance with **OWASP ASVS Level 2** and **Zero Trust Architecture (NIST SP 800-207)**.
* **Call to Action:** Experience zero-knowledge file destruction at **PHANTOM**.
