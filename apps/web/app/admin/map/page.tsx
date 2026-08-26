"use client";

import { useState, useEffect, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";

interface MapMarker {
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

    // Add fiber coverage areas as circles
    fiberAreas.forEach((area) => {
      L.circle([area.lat, area.lng], {
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        radius: area.radius * 1000,
        weight: 1,
      }).addTo(map).bindPopup(
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
      };
      const color = colors[type] || "#6b7280";
      return L.divIcon({
        html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
        className: "custom-marker",
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
    };

    markers.forEach((marker) => {
      const icon = createIcon(marker.type);
      const m = L.marker([marker.lat, marker.lng], { icon }).addTo(map);

      let popupContent = "";
      if (marker.type === "customer") {
        popupContent = `
          <div style="min-width:180px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">${marker.name}</div>
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
            <div style="font-size:11px;margin-top:4px;padding:2px 6px;border-radius:4px;display:inline-block;background:${marker.details.status === "ACTIVE" ? "#d1fae5" : "#fee2e2"};color:${marker.details.status === "ACTIVE" ? "#065f46" : "#991b1b"}">${marker.details.status || "Unknown"}</div>
          </div>`;
      } else if (marker.type === "location") {
        popupContent = `
          <div style="min-width:160px;font-family:system-ui">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">📍 ${marker.name}</div>
            <div style="font-size:12px;color:#666">📡 ${marker.details.routerCount || 0} routers</div>
            <div style="font-size:12px;color:#666">👥 ${marker.details.customerCount || 0} customers</div>
          </div>`;
      }

      m.bindPopup(popupContent);
      m.on("click", () => onMarkerClick(marker));
    });

    setMapReady(true);

    return () => {
      map.remove();
      setMapReady(false);
    };
  }, [L, center, markers, fiberAreas, onMarkerClick]);

  return (
    <div id="admin-map" style={{ width: "100%", height: "100%", minHeight: "600px", borderRadius: "12px" }} />
  );
}

export default function AdminMapPage() {
  const { data, loading, error, reload } = useApi<MapData>("/map", [], 30000);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [filter, setFilter] = useState<"all" | "customer" | "router" | "location">("all");
  const [showFiber, setShowFiber] = useState(true);

  const mapData = data;

  const filteredMarkers = useMemo(() => {
    if (!mapData) return [];
    if (filter === "all") return mapData.markers;
    return mapData.markers.filter((m) => m.type === filter);
  }, [mapData, filter]);

  if (loading) return <LoadingState />;
  if (error || !mapData) {
    return <ErrorState message={error ?? "Failed to load map data"} onRetry={reload} />;
  }

  return (
    <div>
      <PageHeader
        title="Network Map"
        subtitle="View all reseller customers, routers, and fiber coverage across Tanzania"
        action={
          <Button variant="secondary" onClick={reload}>
            <Icon name="refresh" size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Locations" value={mapData.stats.totalLocations} icon={<Icon name="location" />} accent="purple" />
        <StatCard label="Routers" value={mapData.stats.totalRouters} icon={<Icon name="router" />} accent="blue" />
        <StatCard label="Customers" value={mapData.stats.totalCustomers} icon={<Icon name="users" />} accent="teal" />
        <StatCard label="Mapped" value={`${mapData.stats.locationsWithCoords}/${mapData.stats.totalLocations}`} icon={<Icon name="dashboard" />} accent="green" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "all" ? "bg-accent-blue text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          All ({mapData.markers.length})
        </button>
        <button
          onClick={() => setFilter("customer")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "customer" ? "bg-accent-green text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          Customers ({mapData.markers.filter((m) => m.type === "customer").length})
        </button>
        <button
          onClick={() => setFilter("router")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "router" ? "bg-amber-500 text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          Routers ({mapData.markers.filter((m) => m.type === "router").length})
        </button>
        <button
          onClick={() => setFilter("location")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === "location" ? "bg-accent-purple text-white" : "bg-white/60 border border-white/60 text-text-secondary hover:bg-white/80"}`}
        >
          Locations ({mapData.markers.filter((m) => m.type === "location").length})
        </button>
        <div className="ml-auto">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={showFiber}
              onChange={(e) => setShowFiber(e.target.checked)}
              className="rounded"
            />
            Show fiber coverage
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
          <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/20" />
          Fiber coverage
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
                {selectedMarker.name}
              </h3>
              <div className="mt-2 space-y-1 text-sm text-text-secondary">
                {selectedMarker.details.phone && <p>📱 Phone: {selectedMarker.details.phone}</p>}
                {selectedMarker.details.router && <p>📶 Router: {selectedMarker.details.router}</p>}
                {selectedMarker.details.plan && <p>📋 Plan: {selectedMarker.details.plan}</p>}
                {selectedMarker.details.macAddress && <p>🔗 MAC: {selectedMarker.details.macAddress}</p>}
                {selectedMarker.details.customerCount !== undefined && <p>👥 Customers: {selectedMarker.details.customerCount}</p>}
                {selectedMarker.details.routerCount !== undefined && <p>📡 Routers: {selectedMarker.details.routerCount}</p>}
                {selectedMarker.details.providers && <p>🏢 Providers: {selectedMarker.details.providers.join(", ")}</p>}
                <p>🌐 Coords: {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setSelectedMarker(null)}>✕</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
