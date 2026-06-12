"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { geocodeAddress } from "@/services/geocoding";
import { KIND_LABEL, incidentMeta, type TrafficIncident, type TrafficKind, type TrafficSeverity } from "@/services/traffic";
import { TrafficCone } from "lucide-react";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface CustomWaypoint {
  latLng: L.LatLng;
  shortText: string;
  label: string;
  isDepot: boolean;
}

interface RouteProps {
  waypoints: CustomWaypoint[];
  color: string;
  name: string;
}

function Routing({ waypoints, color, name }: RouteProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || waypoints.length < 2) return;

    const controlOptions: any = {
      waypoints: waypoints,
      routeWhileDragging: false,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: { styles: [{ color: color, weight: 5, opacity: 0.8 }] },
      show: false,
      
      createMarker: function(i: number, wp: any, nWps: number) {
        const customData = waypoints[i];
        const isLoop = waypoints[0].latLng.equals(waypoints[nWps - 1].latLng);
        
        let shortText = customData.shortText;
        let label = customData.label;

        if (i === 0 && isLoop) {
          shortText = "D/A";
          label = "Départ & Arrivée";
        }

        const isOverlapWithStart = i > 0 && customData.latLng.equals(waypoints[0].latLng);
        if (isOverlapWithStart) {
          return L.marker(wp.latLng, { opacity: 0, interactive: false, draggable: false });
        }

        const customIcon = L.divIcon({
          className: "numbered-icon",
          html: `<div style="background:${customData.isDepot ? '#1e293b' : color}; color:white; border-radius:14px; padding: 0 6px; min-width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:11px; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); white-space:nowrap;">
                  ${shortText}
                 </div>`,
          iconAnchor: [14, 14]
        });

        return L.marker(wp.latLng, {
          icon: customIcon,
          draggable: false
        }).bindPopup(`<div class="text-center font-medium text-slate-700">${label}</div>`);
      }
    };

    const routingControl = L.Routing.control(controlOptions).addTo(map);
    return () => { map.removeControl(routingControl); };
  }, [map, waypoints, color, name]);

  return null;
}

function MapResizer({ isFullScreen }: { isFullScreen?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 300);
    return () => clearTimeout(timer);
  }, [map, isFullScreen]);
  return null;
}

function RecenterButton({ position }: { position: L.LatLngExpression }) {
  const map = useMap();
  const handleRecenter = () => map.flyTo(position, 5, { animate: true, duration: 1.5 });

  return (
    <div 
      className="absolute bottom-4 left-4 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur p-2.5 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-200 z-[1000] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2c2c2e] transition-all pointer-events-auto group"
      onClick={handleRecenter}
    >
      <div className="text-xs font-bold text-opti-blue flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Vue d'ensemble
      </div>
    </div>
  );
}

// --- Marqueurs trafic (incidents Bison Futé) ---

const TRAFFIC_SEVERITY_COLOR: Record<TrafficSeverity, string> = {
  highest: "#dc2626",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#3b82f6",
  unknown: "#64748b",
};

const TRAFFIC_KIND_EMOJI: Record<TrafficKind, string> = {
  accident: "⚠️",
  bouchon: "🚗",
  travaux: "🚧",
  fermeture: "⛔",
  info: "ℹ️",
};

function trafficDivIcon(incident: TrafficIncident) {
  const color = TRAFFIC_SEVERITY_COLOR[incident.severity];
  const emoji = TRAFFIC_KIND_EMOJI[incident.kind];
  return L.divIcon({
    className: "traffic-icon",
    html: `<div style="background:${color}; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.35);">${emoji}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function formatPopupTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TrafficMarkers({ incidents }: { incidents: TrafficIncident[] }) {
  return (
    <>
      {incidents
        .filter((i) => i.coordinates)
        .map((i) => {
          const meta = incidentMeta(i);
          const start = formatPopupTime(i.startTime);
          return (
            <Marker key={i.id} position={[i.coordinates!.lat, i.coordinates!.lon]} icon={trafficDivIcon(i)}>
              <Popup>
                <div className="text-slate-700">
                  <div className="font-bold text-opti-blue">
                    {KIND_LABEL[i.kind]}
                    {i.road ? ` — ${i.road}` : ""}
                  </div>
                  {i.town && <div className="text-xs">{i.town}</div>}
                  {meta && <div className="text-xs text-slate-500">{meta}</div>}
                  <div className="text-xs mt-1">{i.location}</div>
                  {start && <div className="text-[11px] text-slate-400 mt-1">Depuis le {start}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
}

export default function DynamicMap({ isFullScreen, activeSessions = [], trafficIncidents = [] }: { isFullScreen?: boolean; activeSessions?: any[]; trafficIncidents?: TrafficIncident[] }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");
  const [routesToRender, setRoutesToRender] = useState<any[]>([]);
  const [showTraffic, setShowTraffic] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark"; // calque infos routières (incidents Bison Futé)
  
  const centerPosition: L.LatLngExpression = [46.2276, 2.2137];
  const colors = ["#0ea5e9", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

  // RÉINITIALISATION AUTO : Si l'utilisateur coche/décoche des tournées dans le composant parent, on remet à zéro les filtres de la carte
  useEffect(() => {
    setSelectedSessionId("all");
    setSelectedVehicleId("all");
  }, [activeSessions]);

  const handleSessionChange = (e: any) => {
    setSelectedSessionId(e.target.value);
    setSelectedVehicleId("all"); // On réinitialise le camion quand on change de tournée manuellement
  };

  // LOGIQUE INTELLIGENTE : Si on a sélectionné une seule tournée dans le parent, on l'utilise par défaut pour le menu des camions
  const displayedSession = selectedSessionId !== "all" 
    ? activeSessions.find(s => s.id === selectedSessionId) 
    : (activeSessions.length === 1 ? activeSessions[0] : null);

  const vehiclesForSession = displayedSession?.optimized_routes || [];

  useEffect(() => {
    let isActive = true;

    async function buildRoutes() {
      const parsedRoutes: any[] = [];
      const filteredSessions = selectedSessionId === "all" ? activeSessions : activeSessions.filter(s => s.id === selectedSessionId);
      
      for (let sIdx = 0; sIdx < filteredSessions.length; sIdx++) {
        const session = filteredSessions[sIdx];
        const originGeo = await geocodeAddress(session.origin_node.address);
        const endGeo = await geocodeAddress(session.end_node.address);
        const allNodes = session.clusters?.flatMap((c: any) => c.nodes) || [];

        session.optimized_routes?.forEach((vehicle: any, vIdx: number) => {
          // Filtre par camion
          if (selectedVehicleId !== "all" && vehicle.vehicle_id !== selectedVehicleId) return;

          let currentTripIndex = 1;
          let stepInTrip = 0;
          const waypoints: CustomWaypoint[] = [];

          if (vehicle.route && Array.isArray(vehicle.route)) {
            vehicle.route.forEach((step: any) => {
              const st = step.stop_type;
              const cid = step.client_id;
              
              if (st === "DEPOT_START" && originGeo) {
                waypoints.push({
                  latLng: L.latLng(originGeo.lat, originGeo.lng),
                  shortText: "D",
                  label: "Départ",
                  isDepot: true
                });
              } else if (st === "DEPOT_END" && endGeo) {
                waypoints.push({
                  latLng: L.latLng(endGeo.lat, endGeo.lng),
                  shortText: "A",
                  label: "Arrivée Finale",
                  isDepot: true
                });
              } else if (st === "RELOAD" && originGeo) {
                currentTripIndex++;
                stepInTrip = 0;
                waypoints.push({
                  latLng: L.latLng(originGeo.lat, originGeo.lng),
                  shortText: "🔄",
                  label: `Rechargement (avant Tour ${currentTripIndex})`,
                  isDepot: true
                });
              } else if (st === "DELIVERY" || (!cid.startsWith("PAUSE") && st !== "BREAK")) {
                const baseId = cid.split('_PART_')[0];
                const node = allNodes.find((n: any) => n.id === baseId);
                
                if (node) {
                  stepInTrip++;
                  waypoints.push({
                    latLng: L.latLng(node.lat, node.lng),
                    shortText: `${currentTripIndex}.${stepInTrip}`,
                    label: `Tour ${currentTripIndex} - Client ${stepInTrip}`,
                    isDepot: false
                  });
                }
              }
            });
          }

          if (waypoints.length >= 2) {
            parsedRoutes.push({ 
              id: `${session.id}-${vehicle.vehicle_id}-${vIdx}`, 
              name: session.meta?.name || "Tournée", 
              color: colors[(sIdx + vIdx) % colors.length], 
              waypoints 
            });
          }
        });
      }
      
      if (isActive) setRoutesToRender(parsedRoutes);
    }
    
    buildRoutes();
    return () => { isActive = false; };
  }, [activeSessions, selectedSessionId, selectedVehicleId]);

  return (
    <MapContainer center={centerPosition} zoom={5} style={{ height: "100%", width: "100%", zIndex: 0 }}>
      <MapResizer isFullScreen={isFullScreen} />
      <RecenterButton position={centerPosition} />

      <TileLayer
        key={isDark ? "dark" : "light"}
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>'
        url={isDark
          ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
          : "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
        }
      />
      
      {/* Panneaux de filtres sur la carte */}
      <div className="absolute top-4 left-16 z-[1000] bg-white dark:bg-[#1c1c1e] rounded-lg shadow-md border border-gray-200 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-700 overflow-hidden">

        {/* Calque "Infos routières" : afficher/masquer les incidents trafic pour bien voir les tournées */}
        <button
          onClick={() => setShowTraffic((v) => !v)}
          title={showTraffic ? "Masquer les infos routières" : "Afficher les infos routières"}
          aria-pressed={showTraffic}
          className={`flex items-center gap-2 text-xs font-bold p-2.5 outline-none cursor-pointer transition-colors ${
            showTraffic ? "text-amber-600 bg-amber-50/70 hover:bg-amber-50" : "text-slate-400 hover:bg-gray-50"
          }`}
        >
          <TrafficCone className="w-4 h-4 shrink-0" />
          Infos routières
        </button>

        {/* On ne montre le sélecteur de "Tournée" QUE s'il y a plus d'une tournée cochée dans le menu parent */}
        {activeSessions.length > 1 && (
          <select 
            className="text-xs font-bold text-slate-700 bg-transparent p-2.5 outline-none cursor-pointer hover:bg-gray-50" 
            onChange={handleSessionChange} 
            value={selectedSessionId}
          >
            <option value="all">Toutes les tournées affichées</option>
            {activeSessions.map(s => <option key={s.id} value={s.id}>{s.meta?.name || "Tournée " + s.id.slice(0,4)}</option>)}
          </select>
        )}

        {/* Le sélecteur de "Camion" s'affiche dès qu'on a isolé UNE tournée (soit dans la carte, soit via le parent) */}
        {displayedSession && vehiclesForSession.length > 0 && (
          <select 
            className="text-xs font-bold text-opti-blue bg-blue-50/50 p-2.5 outline-none cursor-pointer hover:bg-blue-50" 
            onChange={(e) => setSelectedVehicleId(e.target.value)} 
            value={selectedVehicleId}
          >
            <option value="all">Tous les camions de la tournée ({vehiclesForSession.length})</option>
            {vehiclesForSession.map((v: any, i: number) => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                Camion {i + 1} ({v.vehicle_id.slice(0,4)})
              </option>
            ))}
          </select>
        )}

      </div>

      {routesToRender.map((r) => <Routing key={r.id} {...r} />)}

      {showTraffic && <TrafficMarkers incidents={trafficIncidents} />}
    </MapContainer>
  );
}