import { EventEmitter } from "events";

export interface RadarEvent {
  id: string;
  timestamp: string;
  type: "UPLOAD" | "ACCESS" | "DOWNLOAD" | "BURN" | "EXPIRE" | "TAMPER_ATTEMPT" | "RATE_LIMIT" | "ATTACK_LAB";
  ipHash: string;
  geo: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  status: "ALLOWED" | "BLOCKED" | "TAMPER" | "BURNED" | "WARNING";
  details: string;
}

const GLOBAL_GEO_NODES = [
  { city: "Zurich", country: "CH", lat: 47.3769, lng: 8.5417 },
  { city: "Reykjavik", country: "IS", lat: 64.1466, lng: -21.9426 },
  { city: "Frankfurt", country: "DE", lat: 50.1109, lng: 8.6821 },
  { city: "Tokyo", country: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Singapore", country: "SG", lat: 1.3521, lng: 103.8198 },
  { city: "Ashburn", country: "US", lat: 39.0438, lng: -77.4874 },
  { city: "London", country: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Stockholm", country: "SE", lat: 59.3293, lng: 18.0686 },
];

class ThreatRadarBus extends EventEmitter {
  private recentEvents: RadarEvent[] = [];

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  public emitRadarEvent(event: Omit<RadarEvent, "id" | "timestamp" | "geo"> & { geo?: RadarEvent["geo"] }): RadarEvent {
    // Generate deterministic pseudo-geo based on ipHash
    let geo = event.geo;
    if (!geo) {
      let sum = 0;
      for (let i = 0; i < event.ipHash.length; i++) {
        sum += event.ipHash.charCodeAt(i);
      }
      geo = GLOBAL_GEO_NODES[sum % GLOBAL_GEO_NODES.length];
    }

    const fullEvent: RadarEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      geo,
      ...event,
    };

    this.recentEvents.unshift(fullEvent);
    if (this.recentEvents.length > 50) {
      this.recentEvents.pop();
    }

    this.emit("threat_event", fullEvent);
    return fullEvent;
  }

  public getRecentEvents(): RadarEvent[] {
    return [...this.recentEvents];
  }
}

const globalForRadar = globalThis as unknown as { threatRadar: ThreatRadarBus | undefined };
export const threatRadar = globalForRadar.threatRadar ?? new ThreatRadarBus();
if (process.env.NODE_ENV !== "production") globalForRadar.threatRadar = threatRadar;
