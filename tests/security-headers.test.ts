import { describe, it, expect } from "vitest";
import nextConfig from "../next.config";

describe("Application Hardening & Security Headers", () => {
  it("defines strict production security headers in next.config.ts", async () => {
    expect(nextConfig.headers).toBeDefined();

    if (nextConfig.headers) {
      const headerRules = await nextConfig.headers();
      expect(headerRules.length).toBeGreaterThanOrEqual(2);

      // 1. Global headers rule
      const globalRule = headerRules.find((r) => r.source === "/(.*)");
      expect(globalRule).toBeDefined();

      const headers = globalRule!.headers;
      const getHeader = (key: string) => headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

      // Assert nosniff
      expect(getHeader("X-Content-Type-Options")).toBe("nosniff");

      // Assert clickjacking protection
      expect(getHeader("X-Frame-Options")).toBe("DENY");

      // Assert Referrer-Policy: no-referrer (CRITICAL: prevents URL #fragment or path leakage)
      expect(getHeader("Referrer-Policy")).toBe("no-referrer");

      // Assert Permissions-Policy
      expect(getHeader("Permissions-Policy")).toContain("camera=()");

      // Assert Strict-Transport-Security (HSTS)
      expect(getHeader("Strict-Transport-Security")).toContain("max-age=63072000");

      // Assert Content-Security-Policy
      const csp = getHeader("Content-Security-Policy");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");

      // 2. Chunk download endpoint rule
      const chunkRule = headerRules.find((r) => r.source.includes("/chunk/"));
      expect(chunkRule).toBeDefined();

      const chunkHeaders = chunkRule!.headers;
      const getChunkHeader = (key: string) => chunkHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

      // Assert forced opaque octet-stream download
      expect(getChunkHeader("Content-Type")).toBe("application/octet-stream");
      expect(getChunkHeader("Content-Disposition")).toContain("attachment");
      expect(getChunkHeader("Cache-Control")).toContain("no-store");
      expect(getChunkHeader("Pragma")).toBe("no-cache");
    }
  });
});
