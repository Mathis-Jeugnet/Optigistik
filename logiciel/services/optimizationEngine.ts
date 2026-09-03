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

    const allDailyIncidents = await getIncidentsForDate(sessionDateStr);
    const sessionStartSec = timeToSeconds(sessionStartStr);
    const sessionEndSec = sessionStartSec + (11 * 3600); 

    const relevantIncidents = allDailyIncidents.filter(inc => {
      const incStartSec = timeToSeconds(inc.time);
      const incEndSec = timeToSeconds(inc.endTime || "23:59"); 
      return (sessionStartSec <= incEndSec) && (sessionEndSec >= incStartSec);
    });
    
    const currentSignature = generateSessionSignature(session, relevantIncidents);
    const hasSessionClusters = (session.clusters?.length ?? 0) > 0;
    const hasSessionAffretement = (session.affretement_report?.length ?? 0) > 0;

    if (session.optimization_signature === currentSignature && (hasSessionClusters || hasSessionAffretement)) {
      console.log("⚡ Cache valide, aucun recalcul nécessaire.");
      return { 
        cached: true, 
        clusters: session.clusters || [], 
        unlocated: session.unlocated_points || [], 
        affretement: session.affretement_report || [] 
      };
    }

    // ---------------------------------------------------------
    // 🌟 DYNAMIC ROUTING : HORLOGE & ÉTAT D'AVANCEMENT 🌟
    // ---------------------------------------------------------
    const now = new Date();
    let currentSeconds = 0;
    
    // Avance l'horloge uniquement si la tournée est aujourd'hui
    if (now.toDateString() === new Date(sessionDateStr).toDateString()) {
      const currentDaySeconds = now.getHours() * 3600 + now.getMinutes() * 60;
      if (currentDaySeconds > sessionStartSec) {
        currentSeconds = currentDaySeconds;
      }
    }

    const deliveredPointIds = new Set<string>();
    const lockedVehiclesMap = new Map<string, string>();
    const isVirtualDepotForVehicle = new Map<string, string>(); // Associe un ID de point à un Camion

    // On parcourt la tournée pour trouver le "Dernier point livré" de chaque camion
    if (session.clusters && session.clusters.length > 0) {
      session.clusters.forEach((cluster: any) => {
        let lastDeliveredId: string | null = null;
        
        cluster.nodes.forEach((node: any) => {
          if (node.step_type === 'DELIVERY') {
            // Remplace 'DELIVERED' par le vrai nom de ton statut (ex: 'LIVRE', 'FAIT')
            if (node.status === 'DELIVERED' || node.status === 'LIVRE') {
              deliveredPointIds.add(node.id);
              lastDeliveredId = node.id;
            } else {
              lockedVehiclesMap.set(node.id, cluster.group_id);
            }
          }
        });

        // Si le camion a déjà livré des clients, le dernier devient son nouveau point de départ !
        if (lastDeliveredId) {
          isVirtualDepotForVehicle.set(lastDeliveredId, cluster.group_id);
        }
      });
    }
    // ---------------------------------------------------------

    const nodesForSolver: any[] = [];
    const failed: string[] = [];

    // 3. Géocodage et Filtrage Amnésique
    for (const point of session.delivery_points) {
      const isVirtualDepot = isVirtualDepotForVehicle.has(point.id);
      
      // 🌟 Amnésie : Si c'est livré ET que ce n'est pas le nouveau point de départ, on le supprime !
      if (deliveredPointIds.has(point.id) && !isVirtualDepot) {
        continue;
      }

      const geo = await geocodeAddress(point.address);
      if (geo) {
        const processedPoint = { ...point, lat: geo.lat, lng: geo.lng };
        
        // 🌟 Dépôt Virtuel : On annule la charge et le temps, c'est juste un repère GPS
        if (isVirtualDepot) {
          processedPoint.pallets = 0;
          processedPoint.unloading_time_at_client = 0;
          processedPoint.loading_time_at_depot = 0;
        }
        
        nodesForSolver.push(processedPoint);
      } else {
        if (!isVirtualDepot) failed.push(point.address);
      }
    }

    const [originGeo, endGeo] = await Promise.all([
      geocodeAddress(session.origin_node.address),
      geocodeAddress(session.end_node.address),
    ]);

    const matrixPoints: MatrixPoint[] = [];
    if (originGeo) matrixPoints.push({ id: 'depot_origin', address: session.origin_node.address, lat: originGeo.lat, lng: originGeo.lng, role: 'origin' });
    
    for (const node of nodesForSolver) {
      matrixPoints.push({ id: node.id, address: node.address, lat: node.lat, lng: node.lng, role: 'delivery' });
    }
    
    if (endGeo) matrixPoints.push({ id: 'depot_end', address: session.end_node.address, lat: endGeo.lat, lng: endGeo.lng, role: 'end' });

    if (matrixPoints.length < 2) {
      throw new Error("Pas assez de points pour calculer une tournée (Peut-être tout est déjà livré ?).");
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

    // 🌟 On crée une fausse session avec nos points nettoyés pour tromper le Mapper
    const sessionForSolver = { ...session, delivery_points: nodesForSolver };
    const solverPayload = buildSolverPayload(sessionForSolver, res, trulyAvailableVehicles);
    
    // ---------------------------------------------------------
    // 🌟 DYNAMIC ROUTING : INJECTION DANS LE PAYLOAD DU SOLVEUR
    // ---------------------------------------------------------
    solverPayload.current_time = currentSeconds;
    
    solverPayload.nodes.forEach((n: any, index: number) => {
      // On verrouille les colis restants dans leur camion
      if (lockedVehiclesMap.has(n.id)) {
        n.locked_vehicle_id = lockedVehiclesMap.get(n.id);
      }
      
      // On déplace le point de départ du camion vers le dépôt virtuel
      if (isVirtualDepotForVehicle.has(n.id)) {
        const targetVehicleId = isVirtualDepotForVehicle.get(n.id);
        const targetVehicle = solverPayload.vehicles.find((v: any) => v.id === targetVehicleId);
        if (targetVehicle) {
          targetVehicle.start_node_idx = index; // Le solveur comprendra qu'il démarre ici !
        }
      }
    });
    // ---------------------------------------------------------

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
      if (v.route.length === 0) continue; // Sécurité si un camion ne fait plus rien
      
      const tripStart = new Date(new Date(sessionDateStr).setSeconds(v.route[0].arrival_time * 60));
      const tripEnd = new Date(new Date(sessionDateStr).setSeconds(v.route[v.route.length - 1].arrival_time * 60));
      let assignedDriver = null;

      // On essaie de garder le même chauffeur s'il est déjà sur la route !
      // (La logique classique essaiera de toute façon de piocher dans assignedVehicles)
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
          // On va chercher dans la session d'origine pour récupérer toutes les infos
          const point = session.delivery_points.find((p: any) => p.id === baseId);
          
          // 🌟 Astuce : Si c'est notre dépôt virtuel, on ne l'affiche pas comme une livraison à faire !
          if (isVirtualDepotForVehicle.has(point?.id)) {
             return { step_type: 'DEPOT_START', address: point.address, arrival_time: stop.arrival_time, action_duration: 0, uid: `start-${index}` };
          }
          
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
      // Les points non localisés peuvent être poussés ici (on garde les anciens + les nouveaux failed)
      unlocated_points: Array.from(new Set([...(session.unlocated_points || []), ...failed])),
      optimized_routes: optimizationResult.vehicles,
      summary: optimizationResult.summary,
      affretement_report: newAffretementReport,
      optimization_signature: currentSignature,
      updatedAt: new Date()
    });
    
    // 9. Mise à jour Zustand
    const currentStoreSession = useDeliveryStore.getState().session;
    if (currentStoreSession && currentStoreSession.id === session.id) {
      useDeliveryStore.setState((state) => ({
        session: {
          ...state.session!,
          status: "VALIDATED",
          clusters: realClusters,
          unlocated_points: Array.from(new Set([...(state.session!.unlocated_points || []), ...failed])),
          optimized_routes: optimizationResult.vehicles,
          summary: optimizationResult.summary,
          affretement_report: newAffretementReport,
          optimization_signature: currentSignature,
          updatedAt: new Date() as any
        }
      }));
    }
    
    console.log(`✅ Session ${session.id} recalculée avec succès en mode dynamique.`);
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