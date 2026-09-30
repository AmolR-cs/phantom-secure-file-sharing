# PHANTOM 👻 3-Minute Hackathon Demo Script (DEMO.md)
**Tagline:** *"Share it. Then make it never exist."*  
**Presenter Role:** Elite Red-Team + Blue-Team Security Architect & Product Designer  
**Target Duration:** 3 minutes (180 seconds)

---

## Act 1: The Trap (0:00 - 0:40)
*Visual: Open the PHANTOM Cyberpunk-Glass Dashboard on the big screen.*

> **Presenter:**
> "Every time you share a confidential file today—a pitch deck, an API key, an executive contract—you are making a catastrophic security compromise. You trust the server. You trust the database. You trust the cloud provider not to get breached, subpoenaed, or scraped.
> 
> Most 'expiring links' don't actually expire: they just hide the button while the plaintext payload sits on Amazon S3 forever.
> 
> Meet **PHANTOM**. Our security promise is absolute: **Even if an adversary achieves full root compromise of our server, dumps the entire database, and clones our physical hard drives—zero files and zero filenames are ever readable.**"

---

## Act 2: The Zero-Knowledge Client Handshake (0:40 - 1:20)
*Visual: Drag and drop a classified document into the Upload Studio. Select "Burn-After-Read" and 5-minute TTL. Click Encrypt.*

> **Presenter:**
> "Watch our client-side encryption engine.
> 
> Notice that progress counter? That is not an upload progress bar—that is the **W3C Web Cryptography API** running hardware-accelerated AES-256-GCM directly inside my browser RAM.
> 
> Before a single byte leaves my machine:
> 1. We generate a 256-bit CSPRNG Master Key.
> 2. We use HKDF-SHA256 to derive isolated subkeys for file payload, metadata, and capability auth.
> 3. We encrypt in 1MB chunks with unique counter nonces and bind them with Authenticated Additional Data (AAD) to prevent chunk swapping.
> 
> Now look at this generated URL:  
> `https://phantom.app/f/7f39b...#key=uu4aFYrJv...`  
> 
> Under **RFC 3986**, everything after the `#` fragment is evaluated strictly by the recipient's browser. **It is never transmitted in HTTP headers or request lines.** The server literally does not possess the key."

---

## Act 3: GOD MODE: The Dual-Reality Split (1:20 - 1:55)
*Visual: Switch to the GOD MODE tab.*

> **Presenter:**
> "Let's prove it with **GOD MODE**.
> 
> On the **LEFT**, you see what the authorized recipient sees: decrypted filename, plaintext payload, and the master key locked in ephemeral browser RAM.
> 
> On the **RIGHT**, you see what our database, server, and cloud hosting see: completely opaque, high-entropy AES-256-GCM ciphertext chunks. The filename in our database is `NULL`. The file size is obscured. If an adversary seizes our servers right now, they hold worthless digital noise."

---

## Act 4: The Burn & Disintegration (1:55 - 2:25)
*Visual: Open the download link in another window. Click "DECRYPT & SAVE TO DISK".*

> **Presenter:**
> "Now Bob opens the link and downloads the file.
> 
> Because this link was set to **Burn-After-Read**, watch what happens the instant the final chunk is verified.
> 
> *[Visual: The page disintegrates into a cloud of glowing digital particle embers and displays PERMANENTLY ERADICATED]*
> 
> On the backend, our **DoD 5220.22-M shredder** executed a synchronous 3-pass overwrite: first zeroes, then ones, then cryptographic random bytes, followed by `fsync` and unlinking.
> 
> If Bob refreshes, or an attacker tries to intercept the token, it returns a uniform 404. The file did not just expire—it ceased to exist."

---

## Act 5: Attack Lab: Attacking Our Own Build (2:25 - 3:00)
*Visual: Switch to the ATTACK LAB tab. Click "LAUNCH FULL ASSAULT".*

> **Presenter:**
> "Don't take our word for it. In cybersecurity, claims without adversarial proof are marketing.
> 
> In our **ATTACK LAB**, we built automated red-team exploits directly into the application:
> 1. We flip 1 bit in the ciphertext: **AES-GCM tag verification rejects it instantly.**
> 2. We reorder chunk 0 and 1: **AAD binding halts execution.**
> 3. We fire a 50-thread concurrent race condition against a burn link: **Atomic database conditional updates ensure exactly 1 request wins and 49 fail.**
> 4. We replay an intercept token: **Single-use nonce ledger stops it.**
> 5. And over in our **Audit Chain**, every event is SHA-256 hash-chained like a Merkle tree. If a rogue database administrator edits a single row, our validator detects the exact sequence number instantly.
> 
> **PHANTOM: Share it. Then make it never exist.** Thank you."
