import { DeliverySession } from "@/types/logistics";
import { Vehicle } from "@/services/fleet";
import { DistanceMatrixResult } from "@/services/distanceMatrix";

// Interface stricte correspondant au modèle Pydantic Python
interface SolverNode {
  id: string;
  x: number;
  y: number;
  demand: number;
  loading_time: number;
  unloading_time: number;
  time_window: { start: number; end: number };
  allowed_vehicle_types: string[] | null;
  required_skills: string[] | null;
  priority_level: number;
}

export function timeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 3600) + (minutes * 60);
}

export function buildSolverPayload(
  session: DeliverySession,
  matrixResult: DistanceMatrixResult,
  availableVehicles: Vehicle[]
) {
  // 1. Fini le bridage ! On envoie toute la flotte disponible au solveur.
  // C'est l'IA qui décidera combien de camions sont réellement nécessaires.
  const vehiclesToDispatch = availableVehicles;

  // 2. Construction de la matrice des Nœuds
  const nodes: SolverNode[] = [
    {
      id: "DEPOT_START",
      x: matrixResult.points[0].lng,
      y: matrixResult.points[0].lat,
      demand: 0,
      loading_time: 0,
      unloading_time: 0,
      time_window: { start: 0, end: 86400 },
      allowed_vehicle_types: null,
      required_skills: null,
      priority_level: 1
    }
  ];

  session.delivery_points.forEach((point) => {
    const geoPoint = matrixResult.points.find(p => p.id === point.id);
    nodes.push({
      id: point.id,
      x: geoPoint?.lng || 0,
      y: geoPoint?.lat || 0,
      demand: point.pallets,
      loading_time: point.loading_time_at_depot * 60,
      unloading_time: point.unloading_time_at_client * 60,
      time_window: {
        start: timeToSeconds(point.time_window.start),
        end: timeToSeconds(point.time_window.end)
      },
      // Transmission des VRAIES contraintes métiers
      allowed_vehicle_types: point.allowed_vehicle_types && point.allowed_vehicle_types.length > 0 ? point.allowed_vehicle_types : null,
      required_skills: point.required_skills && point.required_skills.length > 0 ? point.required_skills : null,
      priority_level: 1
    });
  });

  const isSymmetric = session.origin_node.address === session.end_node.address;
  if (!isSymmetric) {
    const endPoint = matrixResult.points[matrixResult.points.length - 1];
    nodes.push({
      id: "DEPOT_END",
      x: endPoint.lng,
      y: endPoint.lat,
      demand: 0,
      loading_time: 0,
      unloading_time: 0,
      time_window: { start: 0, end: 86400 },
      allowed_vehicle_types: null,
      required_skills: null,
      priority_level: 1
    });
  }

  const endDepotIndex = isSymmetric ? 0 : nodes.length - 1;

  // 3. Mapping de la Flotte
  const mappedVehicles = vehiclesToDispatch.map((v) => ({
    id: v.id,
    capacity: v.capacity_palettes,
    max_service_time: 43200, 
    // On passe le vrai type du camion pour le matching physique
    vehicle_type: v.typeId || "STANDARD", 
    start_node_idx: 0,
    end_node_idx: endDepotIndex,
    // On passe les vraies compétences du camion
    skills: v.specialty ? [v.specialty] : []
  }));

  // 4. Payload final
  return {
    distance_matrix: matrixResult.distance_matrix.map(row => row.map(Math.round)),
    time_matrix: matrixResult.duration_matrix.map(row => row.map(Math.round)), 
    nodes: nodes,
    vehicles: mappedVehicles,
    time_window_penalty: 0,
    enforce_break: true,
    break_duration_seconds: 2700, // 45min
    max_continuous_driving_seconds: 16200, // 4h30
    max_continuous_work_seconds: 21600, // 6h00
    current_time: timeToSeconds(session.meta.start_time || "08:00"), 
    allow_multi_trip: true
  };
}