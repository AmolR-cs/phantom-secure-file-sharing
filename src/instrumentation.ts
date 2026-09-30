import { FileService } from "@/lib/services/file-service";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[PHANTOM DAEMON] Background cryptographic cleanup scheduler registered.");

    // Run sweep every 60 seconds to shred any TTL-expired blobs
    setInterval(async () => {
      try {
        const swept = await FileService.sweepExpiredFiles();
        if (swept > 0) {
          console.log(`[PHANTOM DAEMON] Synchronous DoD shredding completed for ${swept} expired files.`);
        }
      } catch (err: any) {
        console.error("[PHANTOM DAEMON] Sweeper error:", err.message);
      }
    }, 60000);
  }
}
