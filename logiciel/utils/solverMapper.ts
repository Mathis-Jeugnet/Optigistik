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
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 3600) + (minutes * 60);
}

export function buildSolverPayload(
  session: DeliverySession,
  matrixResult: DistanceMatrixResult,
  availableVehicles: Vehicle[]
) {
  // 1. Filtrage dynamique : on ne garde que les véhicules demandés par l'UI
  const maxVehicles = session.meta.resources_active || availableVehicles.length;
  const vehiclesToDispatch = availableVehicles.slice(0, maxVehicles);

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
      // Conversion des minutes saisies en secondes
      loading_time: point.loading_time_at_depot * 60,
      unloading_time: point.unloading_time_at_client * 60,
      time_window: {
        start: timeToSeconds(point.time_window.start),
        end: timeToSeconds(point.time_window.end)
      },
      allowed_vehicle_types: null,
      required_skills: null,
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
    vehicle_type: "STANDARD",
    start_node_idx: 0,
    end_node_idx: endDepotIndex,
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