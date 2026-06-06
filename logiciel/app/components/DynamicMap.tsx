"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { geocodeAddress } from "@/services/geocoding"; // AJOUT DE L'IMPORT

// Fix Leaflet's default icon path issues avec React/Next.js
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

interface RouteProps {
  waypoints: L.LatLng[];
  color: string;
  name: string;
}

function Routing({ waypoints, color, name }: RouteProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || waypoints.length < 2) return;

    const controlOptions: any = {
      waypoints: waypoints,
      routeWhileDragging: true,
      showAlternatives: false,
      fitSelectedRoutes: false,
      lineOptions: {
        styles: [{ color: color, weight: 5, opacity: 0.8 }],
        extendToWaypoints: true,
        missingRouteTolerance: 0
      },
      show: false,
      
      createMarker: function(i: number, wp: any, nWps: number) {
        const isStart = i === 0;
        const isEnd = i === nWps - 1;
        
        let label = `Étape (${name})`;
        if (isStart) label = `Départ : ${name}`;
        if (isEnd) label = `Arrivée : ${name}`;

        const customIcon = L.divIcon({
          className: "custom-routing-marker",
          html: `
            <div style="
              width: 24px; 
              height: 24px; 
              background-color: ${color}; 
              border-radius: 50%; 
              border: 2px solid white; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%; opacity: 0.9;"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -12]
        });

        const marker = L.marker(wp.latLng, {
          icon: customIcon,
          draggable: true 
        });
        
        marker.bindPopup(`<div class="text-center font-medium">${label}</div>`);
        return marker;
      }
    };

    const routingControl = L.Routing.control(controlOptions).addTo(map);

    return () => {
      try {
        map.removeControl(routingControl);
      } catch (e) {
        console.error("Erreur de nettoyage routing", e);
      }
    };
  }, [map, waypoints, color, name]);

  return null;
}

function MapResizer({ isFullScreen }: { isFullScreen?: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => clearTimeout(timer);
  }, [map, isFullScreen]);

  return null;
}

function RecenterButton({ position }: { position: L.LatLngExpression }) {
  const map = useMap();

  const handleRecenter = () => {
    map.flyTo(position, 5, {
      animate: true,
      duration: 1.5
    });
  };

  return (
    <div 
      className="absolute bottom-4 left-4 bg-white/95 backdrop-blur p-2.5 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-gray-200 z-[1000] cursor-pointer hover:bg-gray-50 hover:scale-105 active:scale-95 transition-all pointer-events-auto group"
      onClick={handleRecenter}
    >
      <div className="text-xs font-bold text-opti-blue flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Vue d'ensemble de la flotte
      </div>
    </div>
  );
}

interface DynamicMapProps {
  isFullScreen?: boolean;
  activeSessions?: any[];
}

export default function DynamicMap({ isFullScreen, activeSessions = [] }: DynamicMapProps) {
  const centerPosition: L.LatLngExpression = [46.2276, 2.2137];
  const colors = ["#0ea5e9", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

  const [routesToRender, setRoutesToRender] = useState<any[]>([]);

  // Construction asynchrone des routes pour résoudre les coordonnées
  useEffect(() => {
    let isActive = true;

    async function buildRoutes() {
      const parsedRoutes: any[] = [];
      
      for (let sIdx = 0; sIdx < activeSessions.length; sIdx++) {
        const session = activeSessions[sIdx];

        // 1. Résolution des dépôts (s'ils n'ont pas déjà leurs coordonnées dans la DB)
        const originGeo = await geocodeAddress(session.origin_node.address);
        const endGeo = await geocodeAddress(session.end_node.address);

        // 2. Indexation de tous les points de livraison pour recherche rapide
        const allNodes = session.clusters ? session.clusters.flatMap((c: any) => c.nodes) : [];

        if (session.optimized_routes && Array.isArray(session.optimized_routes)) {
          session.optimized_routes.forEach((vehicle: any, vIdx: number) => {
            const waypoints: L.LatLng[] = [];

            if (vehicle.route && Array.isArray(vehicle.route)) {
              vehicle.route.forEach((step: any) => {
                const cid = step.client_id;

                // A. Le Dépôt de départ (ou un rechargement au dépôt)
                if (cid === "DEPOT_START" && originGeo) {
                  waypoints.push(L.latLng(originGeo.lat, originGeo.lng));
                } 
                // B. Le Dépôt d'arrivée
                else if (cid === "DEPOT_END" && endGeo) {
                  waypoints.push(L.latLng(endGeo.lat, endGeo.lng));
                } 
                // C. Les Pauses (on ne trace rien géographiquement)
                else if (cid.startsWith("PAUSE") || step.stop_type === "BREAK") {
                  return;
                } 
                // D. Les vrais points de livraison
                else {
                  // Le solveur peut fractionner une livraison : "ID_PART_1", "ID_PART_FINAL"
                  // On récupère l'ID original en coupant au niveau de "_PART_"
                  const baseId = cid.split('_PART_')[0];
                  const node = allNodes.find((n: any) => n.id === baseId);
                  
                  if (node && node.lat && node.lng) {
                    waypoints.push(L.latLng(node.lat, node.lng));
                  }
                }
              });
            }

            if (waypoints.length >= 2) {
              parsedRoutes.push({
                id: `${session.id}-${vehicle.vehicle_id}-${vIdx}`,
                name: `${session.meta?.name || 'Tournée'} - Veh. ${vIdx + 1}`,
                color: colors[(sIdx + vIdx) % colors.length],
                waypoints: waypoints
              });
            }
          });
        }
      }

      if (isActive) {
        setRoutesToRender(parsedRoutes);
      }
    }

    buildRoutes();

    return () => {
      isActive = false;
    };
  }, [activeSessions]);

  return (
    <MapContainer
      center={centerPosition}
      zoom={5}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%", zIndex: 0 }}
    >
      <MapResizer isFullScreen={isFullScreen} />
      <RecenterButton position={centerPosition} />

      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
      />

      {routesToRender.map((route) => (
        <Routing
          key={route.id}
          name={route.name}
          color={route.color}
          waypoints={route.waypoints}
        />
      ))}
    </MapContainer>
  );
}