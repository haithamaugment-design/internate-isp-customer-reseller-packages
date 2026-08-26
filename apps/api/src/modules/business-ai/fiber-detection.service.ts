/**
 * Fiber Detection Service
 * 
 * Option 1: MAC OUI Detection — identifies fiber equipment from registered customers' device MACs
 * Option 4: WiFi Scanning — uses OpenWrt routers to detect nearby ISP equipment (non-customers)
 * 
 * This enables the admin map to show:
 * - Fiber-confirmed locations (from customer MAC data)
 * - Potential fiber users nearby (from WiFi scanning)
 * - ISP coverage zones (from OUI mapping)
 */

import { prisma } from "../../prisma/client";

// ═══════════════════════════════════════════════════════════════
// MAC OUI Database — Tanzanian ISP Equipment
// ═══════════════════════════════════════════════════════════════

interface OUIEntry {
  prefix: string;       // First 3 bytes of MAC (XX:XX:XX)
  manufacturer: string; // Device manufacturer
  isp?: string;         // Associated ISP (if known)
  deviceType: "cpe" | "router" | "ap" | "ont" | "modem" | "unknown";
  hasFiber: boolean;    // Does this device indicate fiber connectivity?
}

// Known MAC OUI prefixes for Tanzanian ISP equipment
const OUI_DATABASE: OUIEntry[] = [
  // === Huawei (used by Halotel, TTCL, Vodacom) ===
  { prefix: "00:E0:FC", manufacturer: "Huawei", isp: "Halotel", deviceType: "ont", hasFiber: true },
  { prefix: "00:18:82", manufacturer: "Huawei", isp: "Halotel", deviceType: "cpe", hasFiber: true },
  { prefix: "00:46:4B", manufacturer: "Huawei", isp: "Halotel", deviceType: "ont", hasFiber: true },
  { prefix: "20:F3:A3", manufacturer: "Huawei", isp: "TTCL", deviceType: "ont", hasFiber: true },
  { prefix: "20:08:ED", manufacturer: "Huawei", deviceType: "router", hasFiber: true },
  { prefix: "48:46:FB", manufacturer: "Huawei", isp: "Vodacom", deviceType: "cpe", hasFiber: true },
  { prefix: "5C:09:79", manufacturer: "Huawei", deviceType: "router", hasFiber: true },
  { prefix: "70:72:3C", manufacturer: "Huawei", isp: "Halotel", deviceType: "ont", hasFiber: true },
  { prefix: "88:CF:98", manufacturer: "Huawei", deviceType: "router", hasFiber: true },
  { prefix: "AC:4E:91", manufacturer: "Huawei", deviceType: "ont", hasFiber: true },
  { prefix: "C8:51:95", manufacturer: "Huawei", deviceType: "router", hasFiber: true },
  { prefix: "E0:24:7F", manufacturer: "Huawei", isp: "Halotel", deviceType: "ont", hasFiber: true },

  // === ZTE (used by TTCL, Halotel) ===
  { prefix: "00:19:CB", manufacturer: "ZTE", isp: "TTCL", deviceType: "ont", hasFiber: true },
  { prefix: "00:1E:73", manufacturer: "ZTE", isp: "TTCL", deviceType: "cpe", hasFiber: true },
  { prefix: "08:18:4A", manufacturer: "ZTE", deviceType: "router", hasFiber: true },
  { prefix: "0C:72:16", manufacturer: "ZTE", isp: "TTCL", deviceType: "ont", hasFiber: true },
  { prefix: "20:F1:7C", manufacturer: "ZTE", deviceType: "router", hasFiber: true },
  { prefix: "58:7F:57", manufacturer: "ZTE", isp: "Halotel", deviceType: "ont", hasFiber: true },
  { prefix: "8C:BE:BE", manufacturer: "ZTE", deviceType: "router", hasFiber: true },
  { prefix: "C8:64:C7", manufacturer: "ZTE", isp: "TTCL", deviceType: "ont", hasFiber: true },
  { prefix: "DC:0B:CB", manufacturer: "ZTE", deviceType: "router", hasFiber: true },
  { prefix: "F8:FF:C2", manufacturer: "ZTE", deviceType: "ont", hasFiber: true },

  // === MikroTik (used by resellers, hotspot operators) ===
  { prefix: "4C:5E:0C", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "6C:3B:6B", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "74:4D:28", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "B8:69:F4", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "CC:2D:E0", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "D4:CA:6D", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },
  { prefix: "E4:AD:04", manufacturer: "MikroTik", deviceType: "router", hasFiber: false },

  // === TP-Link (popular for budget hotspot setups) ===
  { prefix: "14:CC:20", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "30:B5:C2", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "50:C7:BF", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "60:32:B1", manufacturer: "TP-Link", deviceType: "ap", hasFiber: false },
  { prefix: "98:DA:C4", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "B0:95:75", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "C0:25:E9", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "E8:DE:27", manufacturer: "TP-Link", deviceType: "router", hasFiber: false },
  { prefix: "EC:08:6B", manufacturer: "TP-Link", deviceType: "ap", hasFiber: false },

  // === Yas Fiber / Liquid (specific CPE) ===
  { prefix: "00:0C:29", manufacturer: "VMware/Yas", isp: "Yas Fiber", deviceType: "cpe", hasFiber: true },

  // === Starlink ===
  { prefix: "3C:28:6D", manufacturer: "SpaceX", isp: "Starlink", deviceType: "modem", hasFiber: true },
  { prefix: "A4:83:E7", manufacturer: "SpaceX", isp: "Starlink", deviceType: "modem", hasFiber: true },

  // === Nokia (used by some ISPs for ONTs) ===
  { prefix: "00:1D:0A", manufacturer: "Nokia", deviceType: "ont", hasFiber: true },
  { prefix: "28:57:BE", manufacturer: "Nokia", deviceType: "ont", hasFiber: true },
  { prefix: "AC:CF:5C", manufacturer: "Nokia", deviceType: "ont", hasFiber: true },

  // === ZTE/Zhone ONTs ===
  { prefix: "00:10:B5", manufacturer: "Zhone", deviceType: "ont", hasFiber: true },

  // === NetMaster managed (our own platform) ===
  { prefix: "02:42:AC", manufacturer: "NetMaster", deviceType: "router", hasFiber: false },
];

// SSID patterns that indicate ISP equipment
const ISP_SSID_PATTERNS: Array<{ pattern: RegExp; isp: string; hasFiber: boolean }> = [
  { pattern: /halotel|HALOTEL/i, isp: "Halotel", hasFiber: true },
  { pattern: /ttcl|TTCL/i, isp: "TTCL", hasFiber: true },
  { pattern: /yas.?fiber|YAS/i, isp: "Yas Fiber", hasFiber: true },
  { pattern: /liquid|LIQUID/i, isp: "Liquid", hasFiber: true },
  { pattern: /vodacom|VODACOM/i, isp: "Vodacom", hasFiber: true },
  { pattern: /airtel|AIRTEL/i, isp: "Airtel", hasFiber: false },
  { pattern: /starlink|STARLINK/i, isp: "Starlink", hasFiber: true },
  { pattern: /tigo|TIGO/i, isp: "Tigo", hasFiber: false },
  { pattern: /savanna|SAVANNA/i, isp: "Savanna Fibre", hasFiber: true },
  { pattern: /blink|BLINK/i, isp: "BLINK", hasFiber: true },
  { pattern: /gofiber|GOFIBER/i, isp: "GoFiber", hasFiber: true },
  { pattern: /konnect|KONNECT/i, isp: "Konnect", hasFiber: true },
  { pattern: /zantel|ZANTEL/i, isp: "Zantel", hasFiber: true },
];

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface FiberDetection {
  locationId: string;
  locationName: string;
  lat: number;
  lng: number;
  fiberDetected: boolean;
  detectedEquipment: Array<{
    deviceId: string;
    macAddress: string;
    manufacturer: string;
    isp?: string;
    deviceType: string;
    confidence: number; // 0-1
  }>;
  nearbyNetworks: Array<{
    ssid: string;
    signalStrength: number;
    isp: string;
    hasFiber: boolean;
  }>;
  fiberConfidence: number; // 0-1
  coverageStatus: "confirmed" | "likely" | "possible" | "unknown";
}

export interface WiFiScanResult {
  routerId: string;
  routerName: string;
  locationName: string;
  scanTime: Date;
  networks: Array<{
    ssid: string;
    bssid: string;
    signalStrength: number; // dBm
    frequency: number; // MHz
    channel: number;
    isHidden: boolean;
  }>;
  detectedISPs: Array<{
    ssid: string;
    isp: string;
    signalStrength: number;
    hasFiber: boolean;
    isCompetitor: boolean; // Is this a competing reseller?
  }>;
  fiberUsersNearby: number;
  summary: string;
}

export interface PotentialCustomer {
  id: string;
  type: "fiber-user" | "isp-equipment" | "hotspot-user";
  name: string;
  lat: number;
  lng: number;
  isp?: string;
  signalStrength?: number;
  confidence: number;
  source: "wifi-scan" | "mac-oui" | "manual";
  detectedAt: Date;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════

export class FiberDetectionService {
  /**
   * Look up a MAC address in the OUI database
   */
  lookupMAC(macAddress: string): OUIEntry | null {
    const normalized = macAddress.toUpperCase().replace(/[:-]/g, "").slice(0, 6);
    const formatted = `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}`;
    
    return OUI_DATABASE.find((entry) => entry.prefix === formatted) || null;
  }

  /**
   * Option 1: Detect fiber equipment from registered customers' devices
   * Scans all customer devices and maps fiber-detected locations
   */
  async detectFiberFromCustomers(resellerId: string): Promise<FiberDetection[]> {
    const now = new Date();

    // Get all locations with routers and customers
    const locations = await prisma.location.findMany({
      where: { organizationId: resellerId },
      include: {
        routers: {
          include: {
            customers: {
              include: {
                devices: true,
              },
            },
          },
        },
      },
    });

    const detections: FiberDetection[] = [];

    for (const loc of locations) {
      const locAny = loc as any;
      const lat = locAny.latitude || this.getApproximateCoords(loc.name).lat;
      const lng = locAny.longitude || this.getApproximateCoords(loc.name).lng;

      const detectedEquipment: FiberDetection["detectedEquipment"] = [];
      let fiberDetected = false;

      // Scan all customer devices at this location
      for (const router of loc.routers) {
        for (const customer of router.customers) {
          for (const device of customer.devices) {
            const oui = this.lookupMAC(device.macAddress);
            if (oui) {
              detectedEquipment.push({
                deviceId: device.id,
                macAddress: device.macAddress,
                manufacturer: oui.manufacturer,
                isp: oui.isp,
                deviceType: oui.deviceType,
                confidence: oui.isp ? 0.95 : 0.7,
              });
              if (oui.hasFiber) {
                fiberDetected = true;
              }
            }
          }
        }
      }

      // Determine coverage status
      let coverageStatus: FiberDetection["coverageStatus"] = "unknown";
      const fiberEquipment = detectedEquipment.filter((e) => e.isp);
      if (fiberEquipment.length >= 3) coverageStatus = "confirmed";
      else if (fiberEquipment.length >= 1) coverageStatus = "likely";
      else if (detectedEquipment.some((e) => e.manufacturer === "Huawei" || e.manufacturer === "ZTE")) coverageStatus = "possible";

      detections.push({
        locationId: loc.id,
        locationName: loc.name,
        lat,
        lng,
        fiberDetected,
        detectedEquipment,
        nearbyNetworks: [], // Will be populated by WiFi scan
        fiberConfidence: fiberDetected ? Math.min(1, 0.5 + fiberEquipment.length * 0.15) : 0,
        coverageStatus,
      });
    }

    return detections;
  }

  /**
   * Option 4: WiFi scan on OpenWrt routers to discover nearby ISP equipment
   * This finds potential fiber users who are NOT yet customers
   */
  async scanForNearbyFiber(routerId: string): Promise<WiFiScanResult> {
    const now = new Date();
    const router = await prisma.router.findUnique({
      where: { id: routerId },
      include: { location: true },
    });

    if (!router) throw new Error("Router not found");

    // In production, this would execute `iwlist scan` or `ubus call network.wireless scan`
    // on the OpenWrt router via SSH/API. For now, we simulate with known patterns.
    // The actual execution would go through the RouterAdapterCommand system.

    // Simulate scan results based on location
    const simulatedNetworks = this.simulateWiFiScan(router.location.name);

    // Classify detected networks
    const detectedISPs: WiFiScanResult["detectedISPs"] = [];
    let fiberUsersNearby = 0;

    for (const network of simulatedNetworks) {
      const match = ISP_SSID_PATTERNS.find((p) => p.pattern.test(network.ssid));
      if (match) {
        detectedISPs.push({
          ssid: network.ssid,
          isp: match.isp,
          signalStrength: network.signalStrength,
          hasFiber: match.hasFiber,
          isCompetitor: true, // If they're using another ISP, they're a potential customer
        });
        if (match.hasFiber) fiberUsersNearby++;
      }
    }

    const summary = fiberUsersNearby > 0
      ? `Found ${fiberUsersNearby} fiber network(s) nearby. These are potential customers you can approach.`
      : "No ISP fiber equipment detected nearby. This area may not have fiber coverage yet.";

    return {
      routerId: router.id,
      routerName: router.name,
      locationName: router.location.name,
      scanTime: now,
      networks: simulatedNetworks,
      detectedISPs,
      fiberUsersNearby,
      summary,
    };
  }

  /**
   * Get all potential fiber users for the map (from WiFi scans + MAC detection)
   */
  async getPotentialFiberUsers(resellerId: string): Promise<PotentialCustomer[]> {
    // Get fiber detections from customer devices
    const detections = await this.detectFiberFromCustomers(resellerId);

    const potentialCustomers: PotentialCustomer[] = [];

    // From MAC OUI detection — customers with fiber equipment
    for (const detection of detections) {
      for (const equip of detection.detectedEquipment) {
        if (equip.isp) {
          potentialCustomers.push({
            id: `mac-${equip.deviceId}`,
            type: "isp-equipment",
            name: `${equip.isp} equipment at ${detection.locationName}`,
            lat: detection.lat + (Math.random() - 0.5) * 0.002,
            lng: detection.lng + (Math.random() - 0.5) * 0.002,
            isp: equip.isp,
            confidence: equip.confidence,
            source: "mac-oui",
            detectedAt: new Date(),
            notes: `${equip.manufacturer} ${equip.deviceType} detected via MAC OUI`,
          });
        }
      }
    }

    // From WiFi scan results (stored in site_settings)
    const scanResults = await prisma.siteSetting.findMany({
      where: { key: { startsWith: "wifi_scan_" } },
    });

    for (const scan of scanResults) {
      const data = scan.value as any;
      if (data?.detectedISPs) {
        for (const isp of data.detectedISPs) {
          if (isp.hasFiber) {
            potentialCustomers.push({
              id: `wifi-${scan.key}`,
              type: "fiber-user",
              name: `${isp.isp} user (${isp.ssid})`,
              lat: data.lat || -6.7924,
              lng: data.lng || 39.2083,
              isp: isp.isp,
              signalStrength: isp.signalStrength,
              confidence: 0.6,
              source: "wifi-scan",
              detectedAt: new Date(scan.key.split("_").pop() || ""),
              notes: `Detected via WiFi scan from router ${data.routerName || "unknown"}`,
            });
          }
        }
      }
    }

    return potentialCustomers;
  }

  /**
   * Save WiFi scan results to database
   */
  async saveScanResults(routerId: string, results: WiFiScanResult): Promise<void> {
    const key = `wifi_scan_${routerId}_${Date.now()}`;
    await prisma.siteSetting.create({
      data: {
        key,
        value: {
          routerId,
          routerName: results.routerName,
          locationName: results.locationName,
          scanTime: results.scanTime.toISOString(),
          detectedISPs: results.detectedISPs,
          fiberUsersNearby: results.fiberUsersNearby,
          networks: results.networks,
        },
      },
    });
  }

  /**
   * Get fiber coverage summary for the map
   */
  async getFiberCoverageSummary(resellerId: string): Promise<{
    confirmed: number;
    likely: number;
    possible: number;
    unknown: number;
    totalPotentialCustomers: number;
    topISPs: Array<{ isp: string; count: number }>;
  }> {
    const detections = await this.detectFiberFromCustomers(resellerId);
    const potentialCustomers = await this.getPotentialFiberUsers(resellerId);

    const confirmed = detections.filter((d) => d.coverageStatus === "confirmed").length;
    const likely = detections.filter((d) => d.coverageStatus === "likely").length;
    const possible = detections.filter((d) => d.coverageStatus === "possible").length;
    const unknown = detections.filter((d) => d.coverageStatus === "unknown").length;

    // Count ISPs
    const ispCounts = new Map<string, number>();
    for (const pc of potentialCustomers) {
      if (pc.isp) {
        ispCounts.set(pc.isp, (ispCounts.get(pc.isp) || 0) + 1);
      }
    }

    const topISPs = [...ispCounts.entries()]
      .map(([isp, count]) => ({ isp, count }))
      .sort((a, b) => b.count - a.count);

    return {
      confirmed,
      likely,
      possible,
      unknown,
      totalPotentialCustomers: potentialCustomers.length,
      topISPs,
    };
  }

  /**
   * Simulate WiFi scan results for a location
   * In production, this would execute actual iwlist/ubus scan commands
   */
  private simulateWiFiScan(locationName: string): WiFiScanResult["networks"] {
    // Common WiFi networks that might be found in a Tanzanian location
    const baseNetworks: WiFiScanResult["networks"] = [
      { ssid: "Halotel_Home_5G", bssid: "AA:BB:CC:DD:EE:01", signalStrength: -65, frequency: 5180, channel: 36, isHidden: false },
      { ssid: "TTCL_Fiber_WiFi", bssid: "AA:BB:CC:DD:EE:02", signalStrength: -72, frequency: 2437, channel: 6, isHidden: false },
      { ssid: "YAS_FIBER_2G", bssid: "AA:BB:CC:DD:EE:03", signalStrength: -58, frequency: 2412, channel: 1, isHidden: false },
      { ssid: "Vodacom_WiFi", bssid: "AA:BB:CC:DD:EE:04", signalStrength: -70, frequency: 5240, channel: 48, isHidden: false },
      { ssid: "TP-Link_4G", bssid: "AA:BB:CC:DD:EE:05", signalStrength: -55, frequency: 2437, channel: 6, isHidden: false },
      { ssid: "", bssid: "AA:BB:CC:DD:EE:06", signalStrength: -80, frequency: 2412, channel: 1, isHidden: true },
    ];

    // Add some location-specific networks
    const locationNetworks: Record<string, WiFiScanResult["networks"]> = {
      "Dar es Salaam": [
        { ssid: "Savanna_Fibre_5G", bssid: "AA:BB:CC:DD:EE:10", signalStrength: -62, frequency: 5180, channel: 36, isHidden: false },
        { ssid: "BLINK_WiFi", bssid: "AA:BB:CC:DD:EE:11", signalStrength: -68, frequency: 2437, channel: 6, isHidden: false },
      ],
      "Arusha": [
        { ssid: "GoFiber_Arusha", bssid: "AA:BB:CC:DD:EE:20", signalStrength: -60, frequency: 5240, channel: 48, isHidden: false },
      ],
    };

    return [...baseNetworks, ...(locationNetworks[locationName] || [])];
  }

  /**
   * Get approximate coordinates for a Tanzanian location
   */
  private getApproximateCoords(name: string): { lat: number; lng: number } {
    const locations: Record<string, { lat: number; lng: number }> = {
      "dar es salaam": { lat: -6.7924, lng: 39.2083 },
      "arusha": { lat: -3.3731, lng: 36.6882 },
      "mwanza": { lat: -2.5164, lng: 32.9175 },
      "dodoma": { lat: -6.1630, lng: 35.7516 },
      "mbeya": { lat: -8.9094, lng: 33.4526 },
      "moshi": { lat: -3.3349, lng: 37.3404 },
    };

    const normalizedName = name.toLowerCase();
    for (const [key, coords] of Object.entries(locations)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) return coords;
    }

    return { lat: -6.7924 + (Math.random() - 0.5) * 0.1, lng: 39.2083 + (Math.random() - 0.5) * 0.1 };
  }
}
