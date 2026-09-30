# PHANTOM Security Architecture & Assurance (SECURITY.md)
**Standard:** OWASP ASVS v4.0 Level 2 + OWASP Top 10 (2021)  
**Classification:** Defense-in-Depth Zero-Knowledge Specification  

---

## 1. Security Architecture Principles

PHANTOM is designed on the principle of **hostile host tolerance**: the application assumes that the transport layer, physical server hosting, and persistent database could all be compromised by an adversary.

### Trust Boundaries
1. **Client Browser Boundary (Trusted):** Execution of Web Crypto API, plaintext file caching, master key extraction from URL fragment.
2. **Network / Transport Boundary (Untrusted):** Mitigated by TLS 1.3, strict HSTS, SRI, and Subresource Integrity.
3. **Server & Database Boundary (Untrusted Ciphertext Storage):** Zero-knowledge storage of encrypted chunks and encrypted metadata.

---

## 2. OWASP ASVS v4.0 Level 2 Mapping

| ASVS Section | Control ID | Requirement Description | PHANTOM Implementation |
| :--- | :--- | :--- | :--- |
| **V1 Architecture** | 1.1.2 | Defense-in-depth across tiers | Web Crypto at client edge, capability tokens at API edge, atomic transactions in DB, multi-pass file shredder. |
| **V2 Authentication** | 2.1.1 | Cryptographically strong link identifiers | 128-bit CSPRNG identifiers ($2^{128}$ space), preventing enumeration. |
| **V3 Session Management** | 3.5.3 | Single-use tokens with short TTL | Capability tokens are HMAC-SHA256 signed with 60-second TTL and recorded nonces to prevent replay attacks. |
| **V4 Access Control** | 4.1.1 | Principle of least privilege & atomic authorization | Download quota and burn-after-read decrement executed atomically in a single conditional DB write. Parallel race conditions cannot exceed download caps. |
| **V5 Cryptography** | 5.1.1 | Validated cryptographic algorithms | AES-256-GCM (RFC 5116), HKDF-SHA256 (RFC 5869), PBKDF2-HMAC-SHA256 (600,000 iterations), Web Crypto API only. |
| **V5 Cryptography** | 5.3.1 | Unique nonces and no key reuse | HKDF separates FileKey, MetadataKey, and AuthKey. 96-bit nonces use 64-bit random prefix + 32-bit counter. |
| **V7 Error Handling** | 7.1.1 | Resistance to timing and enumeration attacks | Constant-time comparison (`timingSafeEqual`) on tokens/passwords; identical HTTP 404 response payload and synthetic timing padding for missing vs. burned files. |
| **V8 Data Protection** | 8.3.1 | Sensitive data eradication | Multi-pass overwrite (zeroes, ones, CSPRNG bytes) + `fsync` before file unlinking on burn, expiration, or revocation. |
| **V10 Malicious Code** | 10.3.1 | Safe file downloads & MIME confusion defenses | All chunk downloads served as `application/octet-stream` with `Content-Disposition: attachment`, `nosniff`, and `no-cache`. Inline rendering is strictly disabled. |
| **V14 Config & CSP** | 14.4.1 | Strict Content Security Policy | Strict CSP with `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, and `Referrer-Policy: no-referrer`. |

---

## 3. OWASP Top 10 (2021) Defense Matrix

### A01:2021 – Broken Access Control
- **Defense:** Capability tokens cryptographically signed by the server using HMAC-SHA256. Atomic DB conditional updates guarantee that a burn-after-read file cannot be consumed multiple times during concurrency spikes.

### A02:2021 – Cryptographic Failures
- **Defense:** Zero-knowledge architecture. Sensitive data is never in plaintext on the server. AES-256-GCM provides authenticated encryption. AAD binds chunk index, total chunks, file ID, and last-chunk flag, defeating reordering, duplication, and truncation.

### A03:2021 – Injection
- **Defense:** Parameterized queries via Prisma ORM. Strict Zod schemas validating all input formats (hex, base64url, integers). No shell execution or dynamic SQL.

### A04:2021 – Insecure Design
- **Defense:** Comprehensive STRIDE threat model, Merkle-style hash-chained tamper-evident audit logs, automatic file shredding, and isolated key derivation trees.

### A05:2021 – Security Misconfiguration
- **Defense:** Production-grade security headers enabled by default:
  - `Content-Security-Policy: default-src 'self'; ...`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer` (Prevents URL fragment or path leakage to any third party)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### A06:2021 – Vulnerable and Outdated Components
- **Defense:** Direct W3C Web Cryptography API primitives. Zero third-party crypto libraries. Routine `npm audit` and lockfile freezing.

### A07:2021 – Identification and Authentication Failures
- **Defense:** Rate-limiting per IP and per link ID. Exponential backoff on failed password verifications with client lockouts.

### A08:2021 – Software and Data Integrity Failures
- **Defense:** AES-256-GCM 128-bit authentication tags on every chunk. Hash-chained audit log where every entry commits to the cryptographic hash of the prior entry.

### A09:2021 – Security Logging and Monitoring Failures
- **Defense:** Real-time Threat Radar powered by Server-Sent Events (SSE). Hash-chained audit logs with live integrity verification to detect log tampering or row deletions. Anonymized IP and User-Agent hashing (never storing raw IP or sensitive credentials).

### A10:2021 – Server-Side Request Forgery (SSRF)
- **Defense:** Server initiates no outbound HTTP requests based on user input. Storage is strictly local/isolated.

---

## 4. Honest Security Limitations & Threat Boundaries

Transparency is the foundation of genuine cybersecurity. PHANTOM openly documents the boundary conditions where cryptography alone cannot protect the user:

### 4.1 URL Fragment in Browser History
- **Risk:** RFC 3986 dictates that URL fragments (`#key=...`) are not sent over HTTP headers. However, browser navigation history, bookmarks, and local browser sync profiles store the full URL including fragments.
- **Mitigation:**
  - Instruct senders and recipients to use Incognito / Private Browsing modes for sensitive transfers.
  - Optional password protection adds a second layer: the fragment contains only a wrapped key, useless without the out-of-band passphrase.
  - Client-side history clearing prompts upon file download completion.

### 4.2 Malicious JavaScript Substitution (Untrusted Server Assumption)
- **Risk:** If an attacker fully compromises the web server delivering the client application, they could theoretically modify the served JavaScript files to exfiltrate the master key as soon as the client opens the link.
- **Mitigation:**
  - Strict Content Security Policy (`connect-src 'self'`, `default-src 'self'`) prevents exfiltration to third-party endpoints.
  - Subresource Integrity (SRI) on static bundles.
  - For maximum security against hostile hosting infrastructure, clients can run the open-source client locally (`git clone` + `npm run dev`) or verify the build against reproducible release hashes.

### 4.3 Metadata Visibility (Ciphertext Length)
- **Risk:** While the filename, true unpadded file size, and MIME type are encrypted, the number of 1MB ciphertext chunks reveals the file's approximate size ($\pm 1\text{ MB}$).
- **Mitigation:** Optional random dummy byte padding can be enabled for files under 10MB to normalize size distributions.

### 4.4 Endpoint Compromise
- **Risk:** Keyloggers, compromised browser extensions, or memory scrapers on the sender or recipient workstations can intercept plaintext files or keys during execution.
- **Mitigation:** Cryptography can only protect data in transit and at rest on untrusted intermediaries. Endpoint security (EDR, isolated sandboxes) remains mandatory for high-security environments.
