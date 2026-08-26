"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";

interface MapMarker {
  id: string;
  type: "customer" | "router" | "location" | "fiber-area" | "fiber-equipment" | "potential-customer";
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
    isp?: string;
    manufacturer?: string;
    deviceType?: string;
    confidence?: number;
    signalStrength?: number;
    source?: string;
  };
}

interface FiberArea {
  name: string;
  lat: number;
  lng: number;
  radius: number;
  providers: string[];
}

interface MapData {
  markers: MapMarker[];
  fiberAreas: FiberArea[];
  stats: {
    totalLocations: number;
    totalRouters: number;
    totalCustomers: number;
    locationsWithCoords: number;
  };
  center: { lat: number; lng: number };
}

interface FiberCoverageSummary {
  confirmed: number;
  likely: number;
  possible: number;
  unknown: number;
  totalPotentialCustomers: number;
  topISPs: Array<{ isp: string; count: number }>;
}

interface PotentialCustomer {
  id: string;
  type: "fiber-user" | "isp-equipment" | "hotspot-user";
  name: string;
  lat: number;
  lng: number;
  isp?: string;
  signalStrength?: number;
  confidence: number;
  source: "wifi-scan" | "mac-oui" | "manual";
  detectedAt: string;
  notes?: string;
}

// Dynamic import for Leaflet (SSR-safe)
function MapContainer({ center, markers, fiberAreas, selectedMarker, onMarkerClick }: {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  fiberAreas: FiberArea[];
  selectedMarker: MapMarker | null;
  onMarkerClick: (marker: MapMarker) => void;
}) {
  const [L, setL] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    import("leaflet").then((leaflet) => {
      setL(leaflet.default || leaflet);
    });
  }, []);

  useEffect(() => {
    if (!L || mapReady) return;

    const map = L.map("admin-map", {
      center: [center.lat, center.lng],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    setMapInstance(map);
    setMapReady(true);

    return () => {
      map.remove();
      setMapReady(false);
      setMapInstance(null);
    };
  }, [L, center]);

  // Update markers when data changes
  useEffect(() => {
    if (!L || !mapInstance) return;

    // Clear existing markers (keep tile layer)
    mapInstance.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        mapInstance.removeLayer(layer);
      }
    });

    // Add fiber coverage areas as circles
    fiberAreas.forEach((area) => {
      L.circle([area.lat, area.lng], {
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        radius: area.radius * 1000,
        weight: 1,
      }).addTo(mapInstance).bindPopup(
        `<div style="min-width:150px">
          <strong>${area.name}</strong><br/>
          <small>Providers: ${area.providers.join(", ")}</small>
        </div>`
      );
    });

    // Add markers with custom icons
    const createIcon = (type: string) => {
      const colors: Record<string, string> = {
        location: "#8b5cf6",
        router: "#f59e0b",
        customer: "#10b981",
        "fiber-equipment": "#06b6d4",
        "potential-customer": "#f43f5e",
      };
      const color = colors[type] || "#6b7280";
      const size = type === "fiber-equipment" || type === "potential-customer" ? 14 : 12;
      return L.divIcon({
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        className: "custom-marker",
        iconSize: [size + 4, size + 4],
        iconAnchor: [(size + 4) / 2, (size + 4) / 2],
      });
    };

    markers.forEach((marker) => {
      const icon = createIcon(marker.type);
      const m = L.marker([marker.lat, marker.lng], { icon }).addTo(mapInstance);

      let popupContent = "";
      if (marker.type === "customer") {
        popupContent = `
          <div style="min-width:180px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">👤 ${marker.name}</div>
            <div style="font-size:12px;color:#666">📱 ${marker.details.phone || "No phone"}</div>
            <div style="font-size:12px;color:#666">📶 ${marker.details.router || "No router"}</div>
            <div style="font-size:12px;color:#666">📋 ${marker.details.plan || "No plan"}</div>
            <div style="font-size:11px;margin-top:4px;padding:2px 6px;border-radius:4px;display:inline-block;background:${marker.details.status === "ACTIVE" ? "#d1fae5" : "#fee2e2"};color:${marker.details.status === "ACTIVE" ? "#065f46" : "#991b1b"}">${marker.details.status || "Unknown"}</div>
          </div>`;
      } else if (marker.type === "router") {
        popupContent = `
          <div style="min-width:160px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">🔗 ${marker.name}</div>
            <div style="font-size:12px;color:#666">MAC: ${marker.details.macAddress || "—"}</div>
            <div style="font-size:12px;color:#666">👥 ${marker.details.customerCount || 0} customers</div>
          </div>`;
      } else if (marker.type === "location") {
        popupContent = `
          <div style="min-width:160px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">📍 ${marker.name}</div>
            <div style="font-size:12px;color:#666">📡 ${marker.details.routerCount || 0} routers</div>
            <div style="font-size:12px;color:#666">👥 ${marker.details.customerCount || 0} customers</div>
          </div>`;
      } else if (marker.type === "fiber-equipment") {
        popupContent = `
          <div style="min-width:180px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">🔌 ${marker.name}</div>
            <div style="font-size:12px;color:#666">🏭 ${marker.details.manufacturer || "Unknown"}</div>
            <div style="font-size:12px;color:#666">📡 ISP: ${marker.details.isp || "Detected"}</div>
            <div style="font-size:12px;color:#666">📎 ${marker.details.deviceType || "device"}</div>
            <div style="font-size:11px;margin-top:4px;padding:2px 6px;border-radius:4px;display:inline-block;background:#cffafe;color:#0e7490">Fiber confirmed via MAC OUI</div>
          </div>`;
      } else if (marker.type === "potential-customer") {
        popupContent = `
          <div style="min-width:180px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">🎯 ${marker.name}</div>
            <div style="font-size:12px;color:#666">📡 ISP: ${marker.details.isp || "Unknown"}</div>
            <div style="font-size:12px;color:#666">📶 Signal: ${marker.details.signalStrength || "?"} dBm</div>
            <div style="font-size:12px;color:#666">📊 Confidence: ${Math.round((marker.details.confidence || 0) * 100)}%</div>
            <div style="font-size:11px;margin-top:4px;padding:2px 6px;border-radius:4px;display:inline-block;background:#ffe4e6;color:#9f1239">Potential customer — visit & convert!</div>
          </div>`;
      }

      m.bindPopup(popupContent);
      m.on("click", () => onMarkerClick(marker));
    });
  }, [L, mapInstance, markers, fiberAreas, onMarkerClick]);

  return (
    <div id="admin-map" style={{ width: "100%", height: "100%", minHeight: "600px", borderRadius: "12px" }} />
  );
}

export default function AdminMapPage() {
  const { data, loading, error, reload } = useApi<MapData>("/map", [], 30000);
  const fiberSummary = useApi<FiberCoverageSummary>("/business-ai/advanced/fiber-coverage-summary", [], 60000);
  const potentialCustomers = useApi<PotentialCustomer[]>("/business-ai/advanced/potential-customers", [], 60000);

  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [filter, setFilter] = useState<"all" | "customer" | "router" | "location" | "fiber-equipment" | "potential-customer">("all");
  const [showFiber, setShowFiber] = useState(true);
  const [showPotential, setShowPotential] = useState(true);
  const [scanning, setScanning] = useState(false);

  const mapData = data;

  // Merge fiber detection and potential customers into markers
  const allMarkers = useMemo(() => {
    if (!mapData) return [];

    const markers = [...mapData.markers];

    // Add fiber equipment markers from detection
    if (fiberSummary.data && mapData) {
      // Fiber equipment markers are already in the map data from the backend
    }

    // Add potential customer markers
    if (potentialCustomers.data) {
      for (const pc of potentialCustomers.data) {
        markers.push({
          id: pc.id,
          type: "potential-customer",
          name: pc.name,
          lat: pc.lat,
          lng: pc.lng,
          details: {
            isp: pc.isp,
            signalStrength: pc.signalStrength,
            confidence: pc.confidence,
            source: pc.source,
          },
        });
      }
    }

    return markers;
  }, [mapData, potentialCustomers.data, fiberSummary.data]);

  const filteredMarkers = useMemo(() => {
    if (filter === "all") {
      return allMarkers.filter((m) => {
        if (!showPotential && m.type === "potential-customer") return false;
        if (!showFiber && m.type === "fiber-equipment") return false;
        return true;
      });
    }
    return allMarkers.filter((m) => m.type === filter);
  }, [allMarkers, filter, showFiber, showPotential]);

  const handleWifiScan = useCallback(async (routerId: string) => {
    setScanning(true);
    try {
      await api.post(`/business-ai/advanced/wifi-scan/${routerId}`);
      potentialCustomers.reload();
      fiberSummary.reload();
    } finally {
      setScanning(false);
    }
  }, [potentialCustomers, fiberSummary]);

  if (loading) return <LoadingState />;
  if (error || !mapData) {
    return <ErrorState message={error ?? "Failed to load map data"} onRetry={reload} />;
  }

  const potentialCount = potentialCustomers.data?.length || 0;
  const fiberCount = allMarkers.filter((m) => m.type === "fiber-equipment").length;

  return (
    <div>
      <PageHeader
        title="Network Map & Fiber Discovery"
        subtitle="Track customers, discover fiber users, and find potential customers in your area"
        action={
          <Button variant="secondary" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard label="Locations" value={mapData.stats.totalLocations} icon={<Icon name="location" />} accent="purple" />
        <StatCard label="Routers" value={mapData.stats.totalRouters} icon={<Icon name="router" />} accent="blue" />
        <StatCard label="Customers" value={mapData.stats.totalCustomers} icon={<Icon name="users" />} accent="teal" />
        <StatCard label="Fiber Detected" value={fiberSummary.data?.confirmed || 0} icon={<Icon name="dashboard" />} accent="green" sub={`${fiberSummary.data?.likely || 0} likely`} />
        <StatCard label="Potential Customers" value={potentialCount} icon={<Icon name="users" />} accent="red" sub="Nearby fiber users" />
      </div>

      {/* ISP Breakdown */}
      {fiberSummary.data && fiberSummary.data.topISPs.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">📡 Detected ISPs in Your Area</h3>
          <div className="flex flex-wrap gap-2">
            {fiberSummary.data.topISPs.map((isp) => (
              <span key={isp.isp} className="px-3 py-1 rounded-full bg-accent-blue/10 text-accent-blue text-sm font-medium">
                {isp.isp} ({isp.count})
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "all" ? "bg-accent-blue text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          All ({allMarkers.length})
        </button>
        <button
          onClick={() => setFilter("customer")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "customer" ? "bg-accent-green text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          Customers ({allMarkers.filter((m) => m.type === "customer").length})
        </button>
        <button
          onClick={() => setFilter("router")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "router" ? "bg-amber-500 text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          Routers ({allMarkers.filter((m) => m.type === "router").length})
        </button>
        <button
          onClick={() => setFilter("potential-customer")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "potential-customer" ? "bg-rose-500 text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          🎯 Potential ({potentialCount})
        </button>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={showFiber} onChange={(e) => setShowFiber(e.target.checked)} className="rounded" />
            Fiber coverage
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={showPotential} onChange={(e) => setShowPotential(e.target.checked)} className="rounded" />
            Potential customers
          </label>
        </div>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <div style={{ height: "600px" }}>
          <MapContainer
            center={mapData.center}
            markers={filteredMarkers}
            fiberAreas={showFiber ? mapData.fiberAreas : []}
            selectedMarker={selectedMarker}
            onMarkerClick={setSelectedMarker}
          />
        </div>
      </Card>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-accent-purple" />
          Location
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          Router
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-accent-green" />
          Customer
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          Fiber equipment
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          Potential customer
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/20" />
          ISP coverage
        </div>
      </div>

      {/* Selected marker details */}
      {selectedMarker && (
        <Card className="mt-4 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-body font-semibold">
                {selectedMarker.type === "customer" && "👤 "}
                {selectedMarker.type === "router" && "📡 "}
                {selectedMarker.type === "location" && "📍 "}
                {selectedMarker.type === "fiber-equipment" && "🔌 "}
                {selectedMarker.type === "potential-customer" && "🎯 "}
                {selectedMarker.name}
              </h3>
              <div className="mt-2 space-y-1 text-sm text-text-secondary">
                {selectedMarker.details.phone && <p>📱 Phone: {selectedMarker.details.phone}</p>}
                {selectedMarker.details.router && <p>📶 Router: {selectedMarker.details.router}</p>}
                {selectedMarker.details.plan && <p>📋 Plan: {selectedMarker.details.plan}</p>}
                {selectedMarker.details.macAddress && <p>🔗 MAC: {selectedMarker.details.macAddress}</p>}
                {selectedMarker.details.isp && <p>📡 ISP: {selectedMarker.details.isp}</p>}
                {selectedMarker.details.manufacturer && <p>🏭 Equipment: {selectedMarker.details.manufacturer}</p>}
                {selectedMarker.details.customerCount !== undefined && <p>👥 Customers: {selectedMarker.details.customerCount}</p>}
                {selectedMarker.details.routerCount !== undefined && <p>📡 Routers: {selectedMarker.details.routerCount}</p>}
                {selectedMarker.details.confidence !== undefined && <p>📊 Confidence: {Math.round(selectedMarker.details.confidence * 100)}%</p>}
                {selectedMarker.details.signalStrength !== undefined && <p>📶 Signal: {selectedMarker.details.signalStrength} dBm</p>}
                {selectedMarker.details.providers && <p>🏢 Providers: {selectedMarker.details.providers.join(", ")}</p>}
                {selectedMarker.details.source && <p>🔍 Source: {selectedMarker.details.source}</p>}
                <p>🌐 Coords: {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSelectedMarker(null)}>✕</Button>
          </div>
        </Card>
      )}

      {/* Fiber Discovery Info */}
      <Card className="mt-4 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">🔍 How Fiber Discovery Works</h3>
        <div className="text-sm text-text-secondary space-y-1">
          <p>• <strong>MAC OUI Detection:</strong> When customers connect to your routers, their device MAC addresses are checked against a database of known ISP equipment (Huawei, ZTE, etc.)</p>
          <p>• <strong>WiFi Scanning:</strong> OpenWrt routers can scan for nearby WiFi networks and detect ISP-provided equipment by SSID patterns (HALOTEL, TTCL, YAS, etc.)</p>
          <p>• <strong>Potential Customers:</strong> People using other ISPs nearby are marked as potential customers you can approach with your services</p>
        </div>
      </Card>
    </div>
  );
}
