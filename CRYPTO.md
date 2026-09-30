# PHANTOM Cryptographic Specification (CRYPTO.md)
**Version:** 1.0  
**Classification:** Cybersecurity-Grade Zero-Knowledge Architecture  
**Core Guarantee:** Even with total compromise of the database, server application, and disk storage, no file plaintext, filename, MIME type, or file size can be recovered by an adversary.

---

## 1. Threat Model & Security Axioms

1. **Zero-Knowledge Server:** The server is treated as an untrusted ciphertext repository. The server must never receive the Master Key, plaintext metadata, or plaintext file chunks.
2. **Ephemeral URL Fragment Anchor:** The 256-bit Master Key resides exclusively in the client-side URL fragment (`#key=...`). Under RFC 3986 and browser implementation standards, URL fragments are processed strictly by the user agent and are **never** transmitted in HTTP request lines, headers, or query parameters.
3. **No Hand-Rolled Primitives:** All cryptographic primitives strictly utilize the standardized, hardware-accelerated **W3C Web Cryptography API** (`window.crypto.subtle` / Node `crypto.webcrypto.subtle`).
4. **No Key Reuse:** A single master key is never used directly for multi-purpose encryption. Deterministic, cryptographically isolated subkeys are derived using **HKDF-SHA256** (RFC 5869).
5. **Authenticated Additional Data (AAD) Binding:** Every AES-256-GCM chunk authenticates metadata binding it to its file ID, chunk sequence, total chunk count, and terminal chunk flag. This prevents:
   - Chunk reordering attacks.
   - Chunk truncation attacks.
   - Cross-file chunk swapping.
   - Chunk duplication attacks.

---

## 2. Key Derivation Hierarchy (HKDF-SHA256)

```
                            [ Master Key (256-bit CSPRNG) ]
                                          |
                                          v  (HKDF Extract)
                                 [ PRK: HMAC-SHA256 ]
                                          |
                                          v  (HKDF Expand with Salt + Info)
    +-------------------------------------+-------------------------------------+
    |                                     |                                     |
    v                                     v                                     v
[ FileKey (256-bit) ]         [ MetadataKey (256-bit) ]            [ AuthKey (256-bit) ]
Info: "phantom-v1-file-enc"   Info: "phantom-v1-meta-enc"          Info: "phantom-v1-auth-cap"
Algorithm: AES-256-GCM        Algorithm: AES-256-GCM               Algorithm: HMAC-SHA256
```

### 2.1 Master Key Generation
- Generated on the client using `crypto.getRandomValues(new Uint8Array(32))`.
- 256 bits of high-entropy cryptographic randomness.
- Encoded for the URL fragment using Base64URL (RFC 4648 §5, URL-safe, unpadded).
- Syntax: `https://phantom.domain/f/<file_id>#key=<base64url_master_key>`

### 2.2 Salt Generation
- A unique 16-byte (128-bit) cryptographic salt is generated per file: `crypto.getRandomValues(new Uint8Array(16))`.
- Stored alongside the file record on the server. Because the salt is combined with the confidential master key during HKDF, public knowledge of the salt leaks zero information.

### 2.3 Subkey Derivations
Using HKDF-SHA256 with the master key as Initial Keying Material (IKM) and the 16-byte salt:
1. **`FileKey`**:
   - `info = new TextEncoder().encode("phantom-v1-file-encryption")`
   - Output: 32 bytes (256-bit) AES-GCM key.
   - Scope: Strictly encrypts and decrypts file data chunks.
2. **`MetadataKey`**:
   - `info = new TextEncoder().encode("phantom-v1-metadata-encryption")`
   - Output: 32 bytes (256-bit) AES-GCM key.
   - Scope: Encrypts file metadata (filename, actual size, MIME type, upload timestamp, payload SHA-256 digest).
3. **`AuthKey`**:
   - `info = new TextEncoder().encode("phantom-v1-auth-capability")`
   - Output: 32 bytes (256-bit) HMAC-SHA256 key.
   - Scope: Signs client-side download capability verification requests.

---

## 3. Chunked Authenticated Encryption (AES-256-GCM)

Files are partitioned into discrete **1,048,576 byte (1 MB)** chunks before encryption.

### 3.1 Nonce Construction (96 bits / 12 bytes)
AES-GCM security depends catastrophically on nonce uniqueness under a given key. A reused (key, nonce) pair destroys confidentiality and authenticity.

To guarantee zero nonce collision:
```
+------------------------------------------+------------------------------------------+
|       Random Prefix (8 bytes / 64 bits)  |     Chunk Counter (4 bytes / 32 bits)    |
+------------------------------------------+------------------------------------------+
```
- **Random Prefix:** 8 bytes generated via `crypto.getRandomValues()`.
- **Chunk Counter:** 32-bit unsigned big-endian integer, starting at `0` for the first chunk and strictly incrementing (`0, 1, 2, ...`).
- Maximum file capacity under a single key: $2^{32} \times 1\text{ MB} = 4\text{ Petabytes}$, vastly exceeding browser limits while guaranteeing strictly unique 96-bit nonces.

### 3.2 Authenticated Additional Data (AAD) Structure
Every chunk ciphertext is cryptographically bound to its structural identity. The AAD is canonical binary data passed to `SubtleCrypto.encrypt()`:

```
Offset  Length  Type            Description
0       16      UUID / Bytes    Canonical File ID (128-bit)
16      4       UInt32 (BE)     Chunk Index (0-indexed)
20      4       UInt32 (BE)     Total Chunk Count
24      1       UInt8           isLastChunk Flag (0x01 if terminal, 0x00 otherwise)
Total: 25 bytes
```

#### Adversary Resistance Enabled by AAD:
- **Reordering Attack:** If an attacker swaps Chunk 0 and Chunk 1, decryption of Chunk 0 with Chunk 1's AAD fails with `OperationError: The operation failed for an operation-specific reason` (AES-GCM authentication tag mismatch).
- **Truncation Attack:** If an adversary drops Chunk $N-1$, the recipient client detects that the chunk with `isLastChunk == 0x01` was never received and aborts reassembly.
- **Cross-File Injection Attack:** Moving Chunk 2 from File A into File B fails because `File ID` is bound into the AAD.

---

## 4. Metadata Confidentiality

File metadata is structured as canonical JSON:
```json
{
  "name": "confidential_financial_report.pdf",
  "size": 18452901,
  "type": "application/pdf",
  "sha256": "3a8b...7d2e",
  "totalChunks": 18,
  "chunkSize": 1048576,
  "uploadedAt": 1727678400000
}
```
- Encrypted using `MetadataKey` with AES-256-GCM.
- 12-byte random IV generated per metadata encryption.
- The server stores only the base64 ciphertext and the IV.
- The server database does not know the filename (e.g. `salary.xlsx`), the true unpadded size, or the MIME type.

---

## 5. Password Protection Architecture (Zero-Knowledge Verifier)

Users can optionally enforce a password requirement.

### 5.1 Client-Side Key Wrapping
1. The client derives a `PasswordKey` from the user password using **PBKDF2-HMAC-SHA256** (or Argon2id) with 600,000 iterations and a unique `passwordSalt` (16 bytes).
2. The `MasterKey` is encrypted with `PasswordKey` using AES-256-GCM:
   $$\text{WrappedMasterKey} = \text{AES-GCM}_{\text{PasswordKey}}(\text{MasterKey})$$
3. In this mode, the URL fragment contains only `WrappedMasterKey`:
   `https://phantom.domain/f/<id>#wrapped=<base64url>`

### 5.2 Server-Side Verifier
To prevent unauthorized parties from consuming download quotas or triggering burn-after-read without knowing the password:
1. The client derives a distinct `ServerVerifier`:
   $$\text{ServerVerifier} = \text{HMAC-SHA256}(\text{PasswordKey}, \text{"phantom-server-auth-verifier"})$$
2. The server compares this verifier using timing-safe constant-time equality check before issuing download capability tokens.
3. The server **never** sees the password, nor can it derive the `MasterKey` from the `ServerVerifier`.

---

## 6. Delivery Authorization: Capability Tokens

Download access to encrypted chunks requires an authorized **Capability Token**:
- **Format:** `HMAC-SHA256(ServerSecret, payload)`
- **Payload:**
  - `fileId`: Target file identifier
  - `expiresAt`: UNIX timestamp (short-lived, 60 seconds)
  - `nonce`: 16-byte random token nonce
  - `scope`: `"download"`
- **Replay Protection:** Nonces are recorded in `UsedNonce`. Any attempt to reuse a token is rejected with `401 Unauthorized: TOKEN_NONCE_ALREADY_USED`.

---

## 7. Cryptographic Eradication (Shredding)

When a file reaches its TTL, max download limit, or manual burn:
1. Every chunk file is opened on the server storage layer.
2. The chunk is overwritten with a 3-pass erasure pattern:
   - Pass 1: `0x00` (Zeroes)
   - Pass 2: `0xFF` (Ones)
   - Pass 3: CSPRNG pseudorandom bytes (`crypto.randomBytes`)
3. Storage driver forces synchronous disk cache flush (`fs.fsyncSync`).
4. Chunk is unlinked (`fs.unlinkSync`).
5. DB record status is transitioned to `BURNED` or `EXPIRED`, metadata ciphertext is cleared, and `shreddedAt` timestamp is recorded.
6. A background verification audit confirms zero dangling bytes remain in the storage subsystem.
