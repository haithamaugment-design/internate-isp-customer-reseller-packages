import { prisma } from "../../prisma/client";

// Default coordinates for Tanzania (Dar es Salaam)
const DEFAULT_LAT = -6.7924;
const DEFAULT_LNG = 39.2083;

// Known Tanzania ISP/fiber coverage areas (approximate)
const FIBER_COVERAGE_AREAS = [
  { name: "Dar es Salaam - City Centre", lat: -6.7924, lng: 39.2083, radius: 5, providers: ["Yas Fiber", "Halotel", "TTCL", "Savanna"] },
  { name: "Dar es Salaam - Kinondoni", lat: -6.7731, lng: 39.2704, radius: 3, providers: ["Yas Fiber", "Halotel"] },
  { name: "Dar es Salaam - Temeke", lat: -6.8780, lng: 39.2700, radius: 3, providers: ["Halotel", "TTCL"] },
  { name: "Dar es Salaam - Ubungo", lat: -6.7800, lng: 39.2400, radius: 2, providers: ["Yas Fiber"] },
  { name: "Arusha - City Centre", lat: -3.3731, lng: 36.6882, radius: 4, providers: ["Yas Fiber", "Halotel", "TTCL"] },
  { name: "Mwanza - City Centre", lat: -2.5164, lng: 32.9175, radius: 3, providers: ["Halotel", "TTCL"] },
  { name: "Dodoma - City Centre", lat: -6.1630, lng: 35.7516, radius: 3, providers: ["TTCL", "Halotel"] },
  { name: "Mbeya - City Centre", lat: -8.9094, lng: 33.4526, radius: 2, providers: ["Halotel"] },
  { name: "Morogoro - City Centre", lat: -6.8217, lng: 37.6592, radius: 2, providers: ["Halotel"] },
  { name: "Tanga - City Centre", lat: -5.0689, lng: 39.0986, radius: 2, providers: ["Halotel"] },
  { name: "Zanzibar - Stone Town", lat: -6.1622, lng: 39.1921, radius: 2, providers: ["Zantel"] },
  { name: "Iringa - City Centre", lat: -7.7700, lng: 35.6900, radius: 2, providers: ["Halotel"] },
  { name: "Kilimanjaro - Moshi", lat: -3.3349, lng: 37.3404, radius: 3, providers: ["Yas Fiber", "Halotel"] },
  { name: "Songea", lat: -10.6833, lng: 35.6500, radius: 1, providers: ["Halotel"] },
  { name: "Tabora", lat: -5.0167, lng: 32.8000, radius: 1, providers: ["TTCL"] },
];

export interface MapMarker {
  id: string;
  type: "customer" | "router" | "location" | "fiber-area";
  name: string;
  lat: number;
  lng: number;
  details: {
    phone?: string;
    router?: string;
    plan?: string;
    status?: string;
    customerCount?: number;
    routerCount?: number;
    macAddress?: string;
    providers?: string[];
  };
}

export interface MapData {
  markers: MapMarker[];
  fiberAreas: Array<{
    name: string;
    lat: number;
    lng: number;
    radius: number;
    providers: string[];
  }>;
  stats: {
    totalLocations: number;
    totalRouters: number;
    totalCustomers: number;
    locationsWithCoords: number;
  };
  center: { lat: number; lng: number };
}

export class MapService {
  /**
   * Get all map data for admin view
   */
  async getMapData(platformOwnerId: string): Promise<MapData> {
    // Get all resellers under this ISP (or all if platform owner)
    const resellers = await prisma.organization.findMany({
      where: {
        type: "RESELLER",
        parentOrgId: platformOwnerId,
      },
      select: { id: true },
    });

    const resellerIds = resellers.map((r) => r.id);

    // If no resellers found under this org, get all resellers (platform owner mode)
    const allResellerIds = resellerIds.length > 0 ? resellerIds : 
      (await prisma.organization.findMany({ where: { type: "RESELLER" }, select: { id: true } })).map(r => r.id);

    // Get all locations
    const locations = await prisma.location.findMany({
      where: { organizationId: { in: allResellerIds } },
      include: {
        routers: {
          include: {
            customers: { select: { id: true, name: true, phone: true, status: true } },
          },
        },
      },
    });

    const markers: MapMarker[] = [];

    // Use location coordinates if available, otherwise geocode by name
    for (const loc of locations) {
      const locAny = loc as any;
      const lat = locAny.latitude || this.getApproximateCoords(loc.name).lat;
      const lng = locAny.longitude || this.getApproximateCoords(loc.name).lng;

      // Location marker
      markers.push({
        id: `loc-${loc.id}`,
        type: "location",
        name: loc.name,
        lat,
        lng,
        details: {
          customerCount: loc.routers.reduce((s: number, r: any) => s + r.customers.length, 0),
          routerCount: loc.routers.length,
        },
      });

      // Router markers (slightly offset from location)
      for (let i = 0; i < loc.routers.length; i++) {
        const router = loc.routers[i];
        const offsetLat = lat + (i * 0.001); // Small offset to avoid overlap
        const offsetLng = lng + (i * 0.001);

        markers.push({
          id: `router-${router.id}`,
          type: "router",
          name: router.name,
          lat: offsetLat,
          lng: offsetLng,
          details: {
            macAddress: router.macAddress,
            status: router.status,
            customerCount: router.customers.length,
          },
        });

        // Customer markers (further offset)
        for (let j = 0; j < router.customers.length; j++) {
          const customer = router.customers[j];
          const custLat = offsetLat + ((j % 5) * 0.0005) - 0.001;
          const custLng = offsetLng + (Math.floor(j / 5) * 0.0005) - 0.001;

          markers.push({
            id: `cust-${customer.id}`,
            type: "customer",
            name: customer.name,
            lat: custLat,
            lng: custLng,
            details: {
              phone: customer.phone,
              router: router.name,
              plan: "Active",
              status: customer.status,
            },
          });
        }
      }
    }

    // Stats
    const totalLocations = locations.length;
    const totalRouters = locations.reduce((s, l) => s + l.routers.length, 0);
    const totalCustomers = locations.reduce(
      (s, l) => s + l.routers.reduce((rs, r) => rs + r.customers.length, 0),
      0
    );
    const locationsWithCoords = locations.filter((l) => (l as any).latitude && (l as any).longitude).length;

    // Calculate center
    const allLats = markers.map((m) => m.lat);
    const allLngs = markers.map((m) => m.lng);
    const center = {
      lat: allLats.length > 0 ? allLats.reduce((a, b) => a + b, 0) / allLats.length : DEFAULT_LAT,
      lng: allLngs.length > 0 ? allLngs.reduce((a, b) => a + b, 0) / allLngs.length : DEFAULT_LNG,
    };

    return {
      markers,
      fiberAreas: FIBER_COVERAGE_AREAS,
      stats: { totalLocations, totalRouters, totalCustomers, locationsWithCoords },
      center,
    };
  }

  /**
   * Get approximate coordinates for a Tanzanian location name
   */
  private getApproximateCoords(name: string): { lat: number; lng: number } {
    const normalizedName = name.toLowerCase();

    // Map common Tanzanian location names to approximate coordinates
    const locationMap: Record<string, { lat: number; lng: number }> = {
      "dar es salaam": { lat: -6.7924, lng: 39.2083 },
      "dar": { lat: -6.7924, lng: 39.2083 },
      "arusha": { lat: -3.3731, lng: 36.6882 },
      "mwanza": { lat: -2.5164, lng: 32.9175 },
      "dodoma": { lat: -6.1630, lng: 35.7516 },
      "mbeya": { lat: -8.9094, lng: 33.4526 },
      "morogoro": { lat: -6.8217, lng: 37.6592 },
      "tanga": { lat: -5.0689, lng: 39.0986 },
      "zanzibar": { lat: -6.1622, lng: 39.1921 },
      "iringa": { lat: -7.7700, lng: 35.6900 },
      "moshi": { lat: -3.3349, lng: 37.3404 },
      "songea": { lat: -10.6833, lng: 35.6500 },
      "tabora": { lat: -5.0167, lng: 32.8000 },
      "kigoma": { lat: -4.8833, lng: 29.6333 },
      "katavi": { lat: -6.3667, lng: 31.0833 },
      "geita": { lat: -2.8667, lng: 32.2333 },
      "simiyu": { lat: -2.7667, lng: 33.6833 },
      "songwe": { lat: -8.4500, lng: 32.7000 },
      "njombe": { lat: -9.3333, lng: 34.7667 },
      "ruvuma": { lat: -10.6833, lng: 35.6500 },
      "lindi": { lat: -9.9969, lng: 39.7144 },
      "mtwara": { lat: -10.2736, lng: 40.1828 },
      "coast": { lat: -6.7924, lng: 39.2083 },
      "pwan": { lat: -6.7924, lng: 39.2083 },
      "kinondoni": { lat: -6.7731, lng: 39.2704 },
      "temeke": { lat: -6.8780, lng: 39.2700 },
      "ilala": { lat: -6.8160, lng: 39.2690 },
      "ubungo": { lat: -6.7800, lng: 39.2400 },
      "kigamboni": { lat: -6.8333, lng: 39.3167 },
      "mbezi": { lat: -6.7500, lng: 39.2167 },
      "tanesco": { lat: -6.7924, lng: 39.2083 },
    };

    // Try exact match first
    if (locationMap[normalizedName]) return locationMap[normalizedName];

    // Try partial match
    for (const [key, coords] of Object.entries(locationMap)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return coords;
      }
    }

    // Default to Dar es Salaam with random offset
    return {
      lat: DEFAULT_LAT + (Math.random() - 0.5) * 0.1,
      lng: DEFAULT_LNG + (Math.random() - 0.5) * 0.1,
    };
  }

  /**
   * Get fiber coverage areas for the map
   */
  getFiberCoverageAreas() {
    return FIBER_COVERAGE_AREAS;
  }
}
