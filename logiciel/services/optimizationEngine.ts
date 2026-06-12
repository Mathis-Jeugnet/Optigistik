import { getAllVehicles } from '@/services/fleet'
import { getDrivers } from '@/services/drivers'
import { getIncidentsForDate } from '@/services/incidents'
import { geocodeAddress } from '@/services/geocoding'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { buildSolverPayload, timeToSeconds } from '@/utils/solverMapper'
import { generateAndSaveDistanceMatrix, MatrixPoint } from '@/services/distanceMatrix'
import { saveVehicleTrips, isDriverBusy, clearSessionTrips } from '@/services/planning'
import { useDeliveryStore } from '@/stores/deliveryStore'
import type { DeliverySession } from '@/types/logistics'

export function generateSessionSignature(session: any, activeIncidents: any[] = []): string {
  if (!session || !session.delivery_points) return '';
  
  const mappedPoints = session.delivery_points.map((p: any) => ({
    id: p.id,
    addr: p.address,
    pal: p.pallets,
    lt: p.loading_time_at_depot,
    ut: p.unloading_time_at_client,
    tw: `${p.time_window?.start}-${p.time_window?.end}`,
    avt: (p.allowed_vehicle_types || []).join(','),
    rs: (p.required_skills || []).join(',')
  })).sort((a: any, b: any) => a.id.localeCompare(b.id));

  const payloadToHash = {
    date: session.meta?.date,
    start_time: session.meta?.start_time,
    vehicles: session.meta?.resources_active,
    origin: session.origin_node?.address,
    end: session.end_node?.address,
    points: mappedPoints,
    incidents: activeIncidents.map(i => i.id).sort()
  };

  return JSON.stringify(payloadToHash);
}

export async function runOptimization(session: DeliverySession): Promise<any> {
  console.log(`🚀 Démarrage de l'optimisation pour la session : ${session.id}`);

  try {
    const sessionDateStr = session.meta.date || new Date().toISOString().split('T')[0];
    const sessionStartStr = session.meta.start_time || "08:00";

    // 1. RÈGLE DU CHEVAUCHEMENT (OVERLAP)
    const allDailyIncidents = await getIncidentsForDate(sessionDateStr);
    const sessionStartSec = timeToSeconds(sessionStartStr);
    const sessionEndSec = sessionStartSec + (11 * 3600); 

    const relevantIncidents = allDailyIncidents.filter(inc => {
      const incStartSec = timeToSeconds(inc.time);
      const incEndSec = timeToSeconds(inc.endTime || "23:59"); 
      return (sessionStartSec <= incEndSec) && (sessionEndSec >= incStartSec);
    });
    
    // 2. Vérification du Cache (Signature)
    const currentSignature = generateSessionSignature(session, relevantIncidents);
    const hasSessionClusters = (session.clusters?.length ?? 0) > 0;
    const hasSessionAffretement = (session.affretement_report?.length ?? 0) > 0;

    // Si la signature n'a pas bougé et qu'on a déjà des résultats, on ne recalcule pas !
    if (session.optimization_signature === currentSignature && (hasSessionClusters || hasSessionAffretement)) {
      console.log("⚡ Cache valide, aucun recalcul nécessaire.");
      return { 
        cached: true, 
        clusters: session.clusters || [], 
        unlocated: session.unlocated_points || [], 
        affretement: session.affretement_report || [] 
      };
    }

    const nodes: any[] = [];
    const failed: string[] = [];

    // 3. Géocodage
    for (const point of session.delivery_points) {
      const geo = await geocodeAddress(point.address)
      if (geo) {
        nodes.push({
          ...point,
          lat: geo.lat,
          lng: geo.lng,
          demand: point.pallets,
          service_time: point.unloading_time_at_client * 60,
          allowed_vehicle_types: point.allowed_vehicle_types || null,
          required_skills: point.required_skills || null,
          time_window: {
            start: parseInt(point.time_window.start.split(':')[0]) * 3600 + parseInt(point.time_window.start.split(':')[1]) * 60,
            end: parseInt(point.time_window.end.split(':')[0]) * 3600 + parseInt(point.time_window.end.split(':')[1]) * 60,
          }
        })
      } else {
        failed.push(point.address)
      }
    }

    const [originGeo, endGeo] = await Promise.all([
      geocodeAddress(session.origin_node.address),
      geocodeAddress(session.end_node.address),
    ])

    const matrixPoints: MatrixPoint[] = [];
    if (originGeo) matrixPoints.push({ id: 'depot_origin', address: session.origin_node.address, lat: originGeo.lat, lng: originGeo.lng, role: 'origin' })
    for (const node of nodes) matrixPoints.push({ id: node.id, address: node.address, lat: node.lat, lng: node.lng, role: 'delivery' })
    if (endGeo) matrixPoints.push({ id: 'depot_end', address: session.end_node.address, lat: endGeo.lat, lng: endGeo.lng, role: 'end' })

    if (matrixPoints.length < 2) {
      throw new Error("Pas assez de points géocodés pour optimiser.");
    }

    // 4. Matrice & Ressources
    const res = await generateAndSaveDistanceMatrix(session.id, matrixPoints, relevantIncidents);
    
    const [allVehicles, allDrivers] = await Promise.all([
      getAllVehicles(),
      getDrivers()
    ]);
    
    const trulyAvailableVehicles = allVehicles.filter(v => {
      if (!v.is_active) return false;
      const inspectionDate = (v.inspection_date as any).toDate ? (v.inspection_date as any).toDate() : new Date(v.inspection_date);
      if (inspectionDate <= new Date(sessionDateStr)) return false;
      return true; 
    });

    const solverPayload = buildSolverPayload(session, res, trulyAvailableVehicles);
    
    // 5. Solveur
    const solverResponse = await fetch("http://localhost:8000/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(solverPayload)
    });
    
    if (!solverResponse.ok) throw new Error(`Erreur Solveur ${solverResponse.status}`);
                
    const optimizationResult = await solverResponse.json();

    if (optimizationResult.status !== "success" && optimizationResult.status !== "partial_success") {
        throw new Error("Le solveur n'a pas pu trouver de solution.");
    }
      
    // 6. Assignation des chauffeurs
    const assignedDriverIds = new Set<string>();
    const driverAssignments: Record<string, any> = {};

    const isDriverAvailableOnDate = (driver: any) => {
      if (driver.status !== "DISPONIBLE") return false;
      if (driver.unavailabilities && driver.unavailabilities.length > 0) {
        const targetDate = new Date(sessionDateStr);
        targetDate.setHours(0,0,0,0);
        
        for (const unavail of driver.unavailabilities) {
          const startRaw = unavail.startDate?.toDate ? unavail.startDate.toDate() : new Date(unavail.startDate || unavail.start);
          const endRaw = unavail.endDate?.toDate ? unavail.endDate.toDate() : new Date(unavail.endDate || unavail.end);
          if (startRaw && endRaw && !isNaN(startRaw.getTime()) && !isNaN(endRaw.getTime())) {
            startRaw.setHours(0,0,0,0);
            endRaw.setHours(23,59,59,999);
            if (targetDate >= startRaw && targetDate <= endRaw) return false; 
          }
        }
      }
      return true;
    };

    const availableDriversToday = allDrivers.filter(isDriverAvailableOnDate);
    const tripsToSave: any[] = [];

    for (const v of optimizationResult.vehicles) {
      const tripStart = new Date(new Date(sessionDateStr).setSeconds(v.route[0].arrival_time * 60));
      const tripEnd = new Date(new Date(sessionDateStr).setSeconds(v.route[v.route.length - 1].arrival_time * 60));
      let assignedDriver = null;

      const potentialDrivers = availableDriversToday.filter(d => !assignedDriverIds.has(d.id) && (d.assignedVehicles || []).includes(v.vehicle_id));
      for (const d of potentialDrivers) {
        if (!(await isDriverBusy(d.id, tripStart, tripEnd, session.id))) {
          assignedDriver = d; break;
        }
      }

      if (!assignedDriver) {
        for (const d of availableDriversToday) {
          if (!assignedDriverIds.has(d.id)) {
            if (!(await isDriverBusy(d.id, tripStart, tripEnd, session.id))) {
              assignedDriver = d; break;
            }
          }
        }
      }

      if (assignedDriver) assignedDriverIds.add(assignedDriver.id);
      driverAssignments[v.vehicle_id] = assignedDriver;

      tripsToSave.push({
        vehicle_id: v.vehicle_id,
        driver_id: assignedDriver?.id || null, 
        session_id: session.id,
        start_time: tripStart,
        end_time: tripEnd,
        status: 'PLANNED'
      });
    }

    await clearSessionTrips(session.id);
    await saveVehicleTrips(tripsToSave);

    // 7. Mapping des clusters
    const realClusters = optimizationResult.vehicles.map((v: any) => {
      const vehicleDb = allVehicles.find(veh => veh.id === v.vehicle_id);
      const assignedDriver = driverAssignments[v.vehicle_id];

      const mappedNodes = v.route.map((stop: any, index: number) => {
        const baseId = stop.client_id ? stop.client_id.split('_PART_')[0] : '';
        if (stop.stop_type === 'DELIVERY') {
          const point = session.delivery_points.find((p: any) => p.id === baseId);
          return {
            ...point, step_type: 'DELIVERY', arrival_time: stop.arrival_time,
            action_duration: stop.action_duration || 0, pallets: stop.delivered_pallets || point?.pallets, uid: `del-${index}`
          };
        } else if (stop.stop_type === 'RELOAD') {
          return { step_type: 'RELOAD', address: 'Retour Dépôt (Rechargement)', arrival_time: stop.arrival_time, action_duration: stop.action_duration || 0, uid: `rel-${index}` };
        } else if (stop.stop_type === 'DEPOT_START') {
          return { step_type: 'DEPOT_START', address: session.origin_node.address, arrival_time: stop.arrival_time, action_duration: stop.action_duration || 0, uid: `start-${index}` };
        } else if (stop.stop_type === 'DEPOT_END') {
          return { step_type: 'DEPOT_END', address: session.end_node.address, arrival_time: stop.arrival_time, action_duration: 0, uid: `end-${index}` };
        } else if (stop.stop_type === 'BREAK') {
          return { step_type: 'BREAK', address: stop.client_id === 'PAUSE_ATTENTE' ? 'Pause optimisée' : 'Pause RSE', arrival_time: stop.arrival_time, action_duration: stop.action_duration || 45, uid: `break-${index}` };
        }
        return null;
      }).filter(Boolean);

      return {
        group_id: v.vehicle_id,
        vehicle_name: vehicleDb?.plate || vehicleDb?.name || v.vehicle_id,
        driver_id: assignedDriver?.id || null, 
        driver_name: assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}`.trim() : null, 
        nodes: mappedNodes
      };
    });

    const newAffretementReport = optimizationResult.rapport_affretement || [];

    // 8. Sauvegarde Globale
    await updateDoc(doc(db, 'delivery_sessions', session.id), {
      status: "VALIDATED",
      clusters: realClusters,
      unlocated_points: failed,
      optimized_routes: optimizationResult.vehicles,
      summary: optimizationResult.summary,
      affretement_report: newAffretementReport,
      optimization_signature: currentSignature,
      updatedAt: new Date()
    });
    
    // 9. Mise à jour Zustand UNIQUEMENT SI c'est la session active à l'écran
    const currentStoreSession = useDeliveryStore.getState().session;
    if (currentStoreSession && currentStoreSession.id === session.id) {
      useDeliveryStore.setState((state) => ({
        session: {
          ...state.session!,
          status: "VALIDATED",
          clusters: realClusters,
          unlocated_points: failed,
          optimized_routes: optimizationResult.vehicles,
          summary: optimizationResult.summary,
          affretement_report: newAffretementReport,
          optimization_signature: currentSignature,
          updatedAt: new Date() as any
        }
      }));
    }
    
    console.log(`✅ Session ${session.id} recalculée avec succès.`);
    return {
      success: true,
      clusters: realClusters,
      unlocated: failed,
      affretement: newAffretementReport,
      solverMessage: optimizationResult.message_exploitant || null
    };

  } catch (error: any) {
    console.error(`❌ Erreur lors du recalcul de la session ${session.id}:`, error);
    return { success: false, error: error.message };
  }
}