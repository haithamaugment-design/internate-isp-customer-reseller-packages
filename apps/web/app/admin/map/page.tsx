"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

// Map component — client-only, SSR-safe
function LeafletMap({ center, markers, fiberAreas, onMarkerClick }: {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  fiberAreas: FiberArea[];
  onMarkerClick: (marker: MapMarker) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import Leaflet on client only
    import("leaflet").then((leafletMod) => {
      const L = leafletMod.default || leafletMod;
      if (!containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = { map, L };

      // Initial render of markers
      renderMarkers(L, map, markers, fiberAreas, onMarkerClick);
    }).catch(() => {
      // Leaflet import failed — show fallback
    });

    return () => {
      if (mapRef.current?.map) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const { L, map } = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    renderMarkers(L, map, markers, fiberAreas, onMarkerClick);
  }, [markers, fiberAreas, onMarkerClick]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "600px" }} />;
}

function renderMarkers(L: any, map: any, markers: MapMarker[], fiberAreas: FiberArea[], onMarkerClick: (m: MapMarker) => void) {
  // Add fiber coverage circles
  fiberAreas.forEach((area) => {
    const circle = L.circle([area.lat, area.lng], {
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.08,
      radius: area.radius * 1000,
      weight: 1,
    }).addTo(map).bindPopup(
      `<div style="min-width:150px"><strong>${area.name}</strong><br/><small>Providers: ${area.providers.join(", ")}</small></div>`
    );
  });

  // Add markers
  const colors: Record<string, string> = {
    location: "#8b5cf6",
    router: "#f59e0b",
    customer: "#10b981",
    "fiber-equipment": "#06b6d4",
    "potential-customer": "#f43f5e",
  };

  markers.forEach((marker) => {
    const color = colors[marker.type] || "#6b7280";
    const size = ["fiber-equipment", "potential-customer"].includes(marker.type) ? 14 : 12;

    const icon = L.divIcon({
      html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
      className: "",
      iconSize: [size + 4, size + 4],
      iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    });

    const m = L.marker([marker.lat, marker.lng], { icon }).addTo(map);

    let popup = "";
    if (marker.type === "customer") {
      popup = `<div style="min-width:170px;font-family:system-ui"><b>👤 ${marker.name}</b><br/>📱 ${marker.details.phone || "—"}<br/>📶 ${marker.details.router || "—"}<br/>📋 ${marker.details.plan || "—"}</div>`;
    } else if (marker.type === "router") {
      popup = `<div style="min-width:160px;font-family:system-ui"><b>🔗 ${marker.name}</b><br/>MAC: ${marker.details.macAddress || "—"}<br/>👥 ${marker.details.customerCount || 0} customers</div>`;
    } else if (marker.type === "location") {
      popup = `<div style="min-width:160px;font-family:system-ui"><b>📍 ${marker.name}</b><br/>📡 ${marker.details.routerCount || 0} routers<br/>👥 ${marker.details.customerCount || 0} customers</div>`;
    } else if (marker.type === "fiber-equipment") {
      popup = `<div style="min-width:170px;font-family:system-ui"><b>🔌 ${marker.name}</b><br/>🏭 ${marker.details.manufacturer || "—"}<br/>📡 ${marker.details.isp || "—"}<br/><small style="color:#0e7490">Fiber confirmed</small></div>`;
    } else if (marker.type === "potential-customer") {
      popup = `<div style="min-width:170px;font-family:system-ui"><b>🎯 ${marker.name}</b><br/>📡 ${marker.details.isp || "—"}<br/>📶 ${marker.details.signalStrength || "?"} dBm<br/><small style="color:#9f1239">Potential customer</small></div>`;
    }

    m.bindPopup(popup);
    m.on("click", () => onMarkerClick(marker));
  });
}

export default function AdminMapPage() {
  const { data, loading, error, reload } = useApi<MapData>("/map", [], 30000);
  const fiberSummary = useApi<FiberCoverageSummary>("/fiber/fiber-coverage-summary", [], 60000);
  const potentialCustomers = useApi<PotentialCustomer[]>("/fiber/potential-customers", [], 60000);

  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [filter, setFilter] = useState<"all" | "customer" | "router" | "location" | "potential-customer">("all");
  const [showFiber, setShowFiber] = useState(true);
  const [showPotential, setShowPotential] = useState(true);

  const mapData = data;

  const allMarkers = useMemo(() => {
    if (!mapData) return [];
    const markers = [...mapData.markers];
    if (potentialCustomers.data) {
      for (const pc of potentialCustomers.data) {
        markers.push({
          id: pc.id,
          type: "potential-customer",
          name: pc.name,
          lat: pc.lat,
          lng: pc.lng,
          details: { isp: pc.isp, signalStrength: pc.signalStrength, confidence: pc.confidence, source: pc.source },
        });
      }
    }
    return markers;
  }, [mapData, potentialCustomers.data]);

  const filteredMarkers = useMemo(() => {
    if (filter === "all") {
      return allMarkers.filter((m) => {
        if (!showPotential && m.type === "potential-customer") return false;
        return true;
      });
    }
    return allMarkers.filter((m) => m.type === filter);
  }, [allMarkers, filter, showPotential]);

  const handleMarkerClick = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
  }, []);

  if (loading) return <LoadingState />;
  if (error || !mapData) {
    return <ErrorState message={error ?? "Failed to load map data"} onRetry={reload} />;
  }

  const potentialCount = potentialCustomers.data?.length || 0;

  return (
    <div>
      <PageHeader
        title="Network Map & Fiber Discovery"
        subtitle="Track customers, discover fiber users, and find potential customers"
        action={<Button variant="secondary" onClick={reload}><Icon name="refresh" size={16} /><span className="hidden sm:inline">Refresh</span></Button>}
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
        {(["all", "customer", "router", "location", "potential-customer"] as const).map((f) => {
          const labels: Record<string, string> = { all: `All (${allMarkers.length})`, customer: `Customers (${allMarkers.filter((m) => m.type === "customer").length})`, router: `Routers (${allMarkers.filter((m) => m.type === "router").length})`, location: `Locations (${allMarkers.filter((m) => m.type === "location").length})`, "potential-customer": `🎯 Potential (${potentialCount})` };
          const activeColors: Record<string, string> = { all: "bg-accent-blue text-white", customer: "bg-accent-green text-white", router: "bg-amber-500 text-white", location: "bg-accent-purple text-white", "potential-customer": "bg-rose-500 text-white" };
          return (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? activeColors[f] : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}>
              {labels[f]}
            </button>
          );
        })}
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
          <LeafletMap
            center={mapData.center}
            markers={filteredMarkers}
            fiberAreas={showFiber ? mapData.fiberAreas : []}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      </Card>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent-purple" /> Location</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Router</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent-green" /> Customer</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-500" /> Fiber equipment</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Potential customer</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/20" /> ISP coverage</div>
      </div>

      {/* Selected marker */}
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
                {selectedMarker.details.confidence !== undefined && <p>📊 Confidence: {Math.round(selectedMarker.details.confidence * 100)}%</p>}
                {selectedMarker.details.signalStrength !== undefined && <p>📶 Signal: {selectedMarker.details.signalStrength} dBm</p>}
                {selectedMarker.details.source && <p>🔍 Source: {selectedMarker.details.source}</p>}
                <p>🌐 Coords: {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSelectedMarker(null)}>✕</Button>
          </div>
        </Card>
      )}

      {/* Info */}
      <Card className="mt-4 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">🔍 How Fiber Discovery Works</h3>
        <div className="text-sm text-text-secondary space-y-1">
          <p>• <strong>MAC OUI Detection:</strong> Customer device MACs are checked against known ISP equipment (Huawei, ZTE, etc.)</p>
          <p>• <strong>WiFi Scanning:</strong> OpenWrt routers scan for nearby ISP networks (HALOTEL, TTCL, YAS, etc.)</p>
          <p>• <strong>Potential Customers:</strong> People using other ISPs nearby — approach them with your services</p>
        </div>
      </Card>
    </div>
  );
}
