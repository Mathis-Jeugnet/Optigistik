'use client'

import { getAllVehicles } from '@/services/fleet'
import { getDrivers } from '@/services/drivers'
import { getIncidentsForDate } from '@/services/incidents'
import { useState } from 'react'
import { useDeliveryStore } from '@/stores/deliveryStore'
import { geocodeAddress } from '@/services/geocoding'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { 
  X, Loader2, MapPin, AlertCircle, AlertTriangle, Sparkles, 
  Truck, Home, Flag, RefreshCw, Coffee, User
} from 'lucide-react'
import { buildSolverPayload, timeToSeconds } from '@/utils/solverMapper'
import { generateAndSaveDistanceMatrix, MatrixPoint } from '@/services/distanceMatrix'
import { saveVehicleTrips, isDriverBusy, clearSessionTrips } from '@/services/planning'

// --- DICTIONNAIRES ET HELPERS ---

function formatRaisonRejet(raison: string): string {
  const map: Record<string, string> = {
    "SATURE_CAPACITE_POIDS_VOLUME": "Capacité max atteinte (Poids/Volume)",
    "SATURE_AMPLITUDE_TEMPS_OU_FENETRES_HORAIRES": "Hors créneaux horaires / Amplitude",
    "INCOMPATIBILITE_VEHICULE_FLOTTE": "Aucun véhicule compatible",
    "INCOMPATIBILITE_COMPETENCES_FLOTTE": "Compétence requise manquante",
    "SATURE_FLOTTE_GENERALE": "Flotte saturée",
    "ERREUR_LOCKED_NODE_HORAIRE_DEPASSE": "Heure dépassée (Verrouillé)"
  }
  return map[raison] || raison
}

function formatMinutes(minutes: number): string {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '--h--';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
}

function generateSessionSignature(session: any, activeIncidents: any[] = []): string {
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

const getNodeStyle = (type: string) => {
  switch(type) {
    case 'DEPOT_START': return { icon: Home, color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' };
    case 'DEPOT_END': return { icon: Flag, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    case 'RELOAD': return { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' };
    case 'BREAK': return { icon: Coffee, color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' };
    default: return { icon: MapPin, color: 'text-opti-red', bg: 'bg-red-100', border: 'border-red-200' };
  }
}

// --- COMPOSANT PRINCIPAL ---

export default function GenerateTourneeButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [localCache, setLocalCache] = useState<{
    signature: string;
    clusters: any[];
    unlocated: string[];
    affretement: any[];
  } | null>(null)
  
  const [result, setResult] = useState<any | null>(null)
  const [unlocated, setUnlocated] = useState<string[]>([])
  const [affretement, setAffretement] = useState<Array<{client_id: string, raison_rejet: string}>>([])
  const [solverMessage, setSolverMessage] = useState<string | null>(null)

  const session = useDeliveryStore((s) => s.session)
  const selectValidationErrors = useDeliveryStore((s) => s.selectValidationErrors)
  const errors = selectValidationErrors()
  const canGenerate = errors.length === 0 && (session?.delivery_points.length ?? 0) > 0

  const handleGenerate = async () => {
    if (!session) return
    setIsOpen(true)
    setIsProcessing(true)
    setResult(null)
    setUnlocated([])
    setAffretement([])
    setSolverMessage(null)

    try {
      const sessionDateStr = session.meta.date || new Date().toISOString().split('T')[0];
      const sessionStartStr = session.meta.start_time || "08:00";

      // 1. RÈGLE DU CHEVAUCHEMENT (OVERLAP)
      const allDailyIncidents = await getIncidentsForDate(sessionDateStr);
      const sessionStartSec = timeToSeconds(sessionStartStr);
      const sessionEndSec = sessionStartSec + (11 * 3600); // Fin de tournée estimée

      const relevantIncidents = allDailyIncidents.filter(inc => {
        const incStartSec = timeToSeconds(inc.time);
        const incEndSec = timeToSeconds(inc.endTime || "23:59"); 
        
        // Formule mathématique du chevauchement : DébutA <= FinB ET FinA >= DébutB
        return (sessionStartSec <= incEndSec) && (sessionEndSec >= incStartSec);
      });
      
      const currentSignature = generateSessionSignature(session, relevantIncidents);

      if (localCache?.signature === currentSignature) {
        setResult({ clusters: localCache.clusters });
        setUnlocated(localCache.unlocated);
        setAffretement(localCache.affretement);
        setIsProcessing(false);
        return;
      }

      const hasSessionClusters = (session.clusters?.length ?? 0) > 0;
      const hasSessionAffretement = (session.affretement_report?.length ?? 0) > 0;

      if (session.optimization_signature === currentSignature && (hasSessionClusters || hasSessionAffretement)) {
        setResult({ clusters: session.clusters || [] });
        setUnlocated(session.unlocated_points || []);
        setAffretement(session.affretement_report || []);
        setIsProcessing(false);
        return; 
      }

      const nodes: any[] = []
      const failed: string[] = []

      // 3. Géocodage des adresses
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

      const matrixPoints: MatrixPoint[] = []
      if (originGeo) matrixPoints.push({ id: 'depot_origin', address: session.origin_node.address, lat: originGeo.lat, lng: originGeo.lng, role: 'origin' })
      for (const node of nodes) matrixPoints.push({ id: node.id, address: node.address, lat: node.lat, lng: node.lng, role: 'delivery' })
      if (endGeo) matrixPoints.push({ id: 'depot_end', address: session.end_node.address, lat: endGeo.lat, lng: endGeo.lng, role: 'end' })

      if (matrixPoints.length >= 2) {
        
        // 4. GÉNÉRATION DE MATRICE AVEC INCIDENTS
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
        
        // 5. Appel au solveur Python
        const solverResponse = await fetch("http://localhost:8000/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(solverPayload)
        });
        
        if (!solverResponse.ok) throw new Error(`Erreur ${solverResponse.status}`);
                    
        const optimizationResult = await solverResponse.json();

        if (optimizationResult.status === "success" || optimizationResult.status === "partial_success") {
          
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
                  if (targetDate >= startRaw && targetDate <= endRaw) {
                    return false; 
                  }
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
              const isBusy = await isDriverBusy(d.id, tripStart, tripEnd, session.id); 
              if (!isBusy) {
                assignedDriver = d;
                break;
              }
            }

            if (!assignedDriver) {
              for (const d of availableDriversToday) {
                if (!assignedDriverIds.has(d.id)) {
                  const isBusy = await isDriverBusy(d.id, tripStart, tripEnd, session.id); 
                  if (!isBusy) {
                    assignedDriver = d;
                    break;
                  }
                }
              }
            }

            if (assignedDriver) {
              assignedDriverIds.add(assignedDriver.id);
            }

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

          const realClusters = optimizationResult.vehicles.map((v: any) => {
            const vehicleDb = allVehicles.find(veh => veh.id === v.vehicle_id);
            const vehicleName = vehicleDb?.plate || vehicleDb?.name || v.vehicle_id;
            
            const assignedDriver = driverAssignments[v.vehicle_id];

            const mappedNodes = v.route.map((stop: any, index: number) => {
              const baseId = stop.client_id ? stop.client_id.split('_PART_')[0] : '';

              if (stop.stop_type === 'DELIVERY') {
                const point = session.delivery_points.find((p: any) => p.id === baseId);
                return {
                  ...point,
                  step_type: 'DELIVERY',
                  arrival_time: stop.arrival_time,
                  action_duration: stop.action_duration || 0,
                  pallets: stop.delivered_pallets || point?.pallets, 
                  uid: `del-${index}`
                };
              } else if (stop.stop_type === 'RELOAD') {
                return {
                  step_type: 'RELOAD',
                  address: 'Retour Dépôt (Rechargement)',
                  arrival_time: stop.arrival_time,
                  action_duration: stop.action_duration || 0,
                  uid: `rel-${index}`
                };
              } else if (stop.stop_type === 'DEPOT_START') {
                return {
                  step_type: 'DEPOT_START',
                  address: session.origin_node.address,
                  arrival_time: stop.arrival_time,
                  action_duration: stop.action_duration || 0,
                  uid: `start-${index}`
                };
              } else if (stop.stop_type === 'DEPOT_END') {
                return {
                  step_type: 'DEPOT_END',
                  address: session.end_node.address,
                  arrival_time: stop.arrival_time,
                  action_duration: 0,
                  uid: `end-${index}`
                };
              } else if (stop.stop_type === 'BREAK') {
                const isWaitBreak = stop.client_id === 'PAUSE_ATTENTE';
                return {
                  step_type: 'BREAK',
                  address: isWaitBreak ? 'Pause optimisée (Attente ouverture client)' : 'Pause Réglementaire (RSE)',
                  arrival_time: stop.arrival_time,
                  action_duration: stop.action_duration || 45,
                  uid: `break-${index}`
                };
              }
              return null;
            }).filter(Boolean);

            return {
              group_id: v.vehicle_id,
              vehicle_name: vehicleName,
              driver_id: assignedDriver?.id || null, 
              driver_name: assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}`.trim() : null, 
              nodes: mappedNodes
            };
          });

          const newAffretementReport = optimizationResult.rapport_affretement || [];

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
          
          setLocalCache({
            signature: currentSignature,
            clusters: realClusters,
            unlocated: failed,
            affretement: newAffretementReport
          });
          
          useDeliveryStore.setState((state) => ({
            session: state.session ? {
              ...state.session,
              status: "VALIDATED",
              clusters: realClusters,
              unlocated_points: failed,
              optimized_routes: optimizationResult.vehicles,
              summary: optimizationResult.summary,
              affretement_report: newAffretementReport,
              optimization_signature: currentSignature,
              updatedAt: new Date() as any
            } : null
          }));
          
          setAffretement(newAffretementReport);
          setSolverMessage(optimizationResult.message_exploitant || null);
          setResult({ clusters: realClusters });
          setUnlocated(failed);
          setIsProcessing(false);
        } else {
           setIsProcessing(false);
        }
      } else {
        setIsProcessing(false);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'optimisation. Veuillez réessayer.");
      setIsProcessing(false);
    }
  }

  // --- RENDER ---

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-opti-blue text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-blue-100 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
      >
        <Sparkles className="w-4 h-4" />
        Optimiser la tournée
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isProcessing && setIsOpen(false)} />
          
          <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in duration-200">
            
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-opti-blue font-display">Itinéraires & Plannings</h3>
                <p className="text-slate-500 text-sm mt-1">Généré par le moteur d'intelligence artificielle</p>
              </div>
              <button 
                onClick={() => !isProcessing && setIsOpen(false)} 
                disabled={isProcessing}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors disabled:opacity-30"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="relative mb-6">
                    <Loader2 className="w-16 h-16 text-opti-blue animate-spin" />
                    <MapPin className="w-6 h-6 text-opti-red absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <h4 className="text-xl font-bold text-opti-blue mb-2">Traitement en cours...</h4>
                  <p className="text-slate-500 max-w-xs">Calcul des tournées et intégration du trafic...</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  
                  {unlocated.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                      <div className="flex items-center gap-3 text-opti-red mb-4">
                        <AlertCircle className="w-6 h-6" />
                        <h4 className="font-bold">Adresses non localisées ({unlocated.length})</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {unlocated.map((addr, i) => (
                          <div key={i} className="text-xs font-medium text-red-600 bg-white/50 px-3 py-2 rounded-lg border border-red-50 truncate">
                            {addr}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {affretement.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-3 text-amber-700 mb-4">
                        <AlertTriangle className="w-6 h-6" />
                        <h4 className="text-lg font-bold font-display">À Affréter / Sous-traiter ({affretement.length} points)</h4>
                      </div>

                      {solverMessage && (
                        <p className="text-sm text-amber-700/80 mb-5 font-medium bg-amber-100/50 p-3 rounded-lg border border-amber-100">
                          {solverMessage}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {affretement.map((item, i) => {
                          const point = session?.delivery_points.find(p => p.id === item.client_id)
                          return (
                            <div key={i} className="flex flex-col bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                              <span className="text-sm font-bold text-slate-700 truncate mb-2">
                                {point?.address || item.client_id}
                              </span>
                              <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-md w-fit">
                                {formatRaisonRejet(item.raison_rejet)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {result?.clusters.map((cluster: any) => {
                      const deliveryCount = cluster.nodes.filter((n: any) => n.step_type === 'DELIVERY' || !n.step_type).length;

                      return (
                        <div key={cluster.group_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                          
                          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            
                            <div className="flex flex-col gap-1.5">
                              <span className="text-sm font-bold text-opti-blue tracking-wider flex items-center gap-2">
                                <Truck className="w-4 h-4 text-opti-red" />
                                {cluster.vehicle_name || `Véhicule ${String(cluster.group_id).slice(0, 8)}`}
                              </span>
                              
                              {cluster.driver_id ? (
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5" />
                                  {cluster.driver_name}
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1.5 w-fit">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Aucun chauffeur disponible
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] font-bold bg-white text-slate-500 px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                              {deliveryCount} livraisons
                            </span>
                          </div>

                          <div className="p-5 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                            {cluster.nodes.map((node: any, idx: number) => {
                              const stepType = node.step_type || 'DELIVERY';
                              const { icon: Icon, color, bg, border } = getNodeStyle(stepType);
                              
                              const arrivalStr = formatMinutes(node.arrival_time);
                              const hasDuration = node.action_duration > 0; 
                              const departureStr = hasDuration ? formatMinutes(node.arrival_time + node.action_duration) : null;

                              return (
                                <div key={node.uid || idx} className="flex gap-4 group">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${bg} ${color} ${border}`}>
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    {idx !== cluster.nodes.length - 1 && (
                                      <div className="w-0.5 min-h-[32px] flex-1 bg-slate-100 group-hover:bg-slate-200 transition-colors my-1" />
                                    )}
                                  </div>

                                  <div className={`flex-1 pb-6 pt-1.5 ${idx === cluster.nodes.length - 1 ? 'pb-0' : ''}`}>
                                    <p className={`text-xs font-bold ${stepType === 'DELIVERY' ? 'text-slate-700' : 'text-slate-500'} truncate`} title={node.address}>
                                      {node.address}
                                    </p>
                                    
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                        {arrivalStr} {hasDuration && `— ${departureStr} (${node.action_duration} min)`}
                                      </span>
                                      
                                      {stepType === 'DELIVERY' && node.pallets && (
                                        <span className="text-[10px] font-bold text-opti-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                          {node.pallets} palettes
                                        </span>
                                      )}

                                      {stepType === 'DELIVERY' && node.time_window && (
                                        <span className="text-[10px] font-medium text-slate-400">
                                          Créneau : {node.time_window.start} - {node.time_window.end}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>

            {!isProcessing && (
              <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-end bg-white sticky bottom-0">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-opti-blue hover:bg-slate-800 transition-colors shadow-md active:scale-95"
                >
                  Fermer le rapport
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}