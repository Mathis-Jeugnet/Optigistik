'use client'

import { getAllVehicles } from '@/services/fleet'
import { useState } from 'react'
import { useDeliveryStore } from '@/stores/deliveryStore'
import { geocodeAddress } from '@/services/geocoding'
import { ClusteringResult } from '@/services/clustering'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { X, Loader2, MapPin, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react'
import { buildSolverPayload, timeToSeconds } from '@/utils/solverMapper'
import { generateAndSaveDistanceMatrix, MatrixPoint } from '@/services/distanceMatrix'
import { saveVehicleTrips } from '@/services/planning'

// Dictionnaire métier pour l'affrètement
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

// Génération de la signature stricte pour le cache
function generateSessionSignature(session: any): string {
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
    vehicles: session.meta?.resources_active,
    origin: session.origin_node?.address,
    end: session.end_node?.address,
    points: mappedPoints
  };

  return JSON.stringify(payloadToHash);
}

export default function GenerateTourneeButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  // États des données
  const [result, setResult] = useState<ClusteringResult | null>(null)
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
    
    // --- 1. VÉRIFICATION DU CACHE (Totalement synchronisé via Zustand) ---
    const currentSignature = generateSessionSignature(session);
    const hasClusters = (session.clusters?.length ?? 0) > 0;
    const hasAffretement = (session.affretement_report?.length ?? 0) > 0;

    // Si on a la même signature en mémoire et qu'un résultat existe, on coupe court.
    if (session.optimization_signature === currentSignature && (hasClusters || hasAffretement)) {
      setResult({ clusters: session.clusters || [] });
      setUnlocated(session.unlocated_points || []);
      setAffretement(session.affretement_report || []);
      setIsProcessing(false);
      return; 
    }

    // --- NOUVELLE OPTIMISATION ---
    setIsProcessing(true)
    setResult(null)
    setUnlocated([])
    setAffretement([])
    setSolverMessage(null)

    const nodes: any[] = []
    const failed: string[] = []

    // 2. Géocodage
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

    // 3. Matrice & Solveur
    if (matrixPoints.length >= 2) {
      try {
        const res = await generateAndSaveDistanceMatrix(session.id, matrixPoints);
        const allVehicles = await getAllVehicles();
        
        const startTimes = session.delivery_points.map(p => timeToSeconds(p.time_window.start));
        const endTimes = session.delivery_points.map(p => timeToSeconds(p.time_window.end));
        const minStart = new Date(session.meta.date); minStart.setSeconds(Math.min(...startTimes) - 18000);
        const maxEnd = new Date(session.meta.date); maxEnd.setSeconds(Math.max(...endTimes) + 18000);

        const trulyAvailableVehicles = allVehicles.filter(v => {
          if (!v.is_active) return false;
          const inspectionDate = (v.inspection_date as any).toDate ? (v.inspection_date as any).toDate() : new Date(v.inspection_date);
          if (inspectionDate <= new Date(session.meta.date)) return false;
          return true; 
        });

        const solverPayload = buildSolverPayload(session, res, trulyAvailableVehicles);
        
        const solverResponse = await fetch("http://localhost:8000/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(solverPayload)
        });
        
        if (!solverResponse.ok) throw new Error(`Erreur ${solverResponse.status}`);
                    
        const optimizationResult = await solverResponse.json();

        if (optimizationResult.status === "success" || optimizationResult.status === "partial_success") {
          
          const trips = optimizationResult.vehicles.map((v: any) => ({
            vehicle_id: v.vehicle_id,
            session_id: session.id,
            start_time: new Date(new Date(session.meta.date).setSeconds(v.route[0].arrival_time)),
            end_time: new Date(new Date(session.meta.date).setSeconds(v.route[v.route.length-1].arrival_time)),
            status: 'PLANNED'
          }));
          await saveVehicleTrips(trips);

          const realClusters = optimizationResult.vehicles.map((v: any) => ({
            group_id: v.vehicle_id,
            nodes: v.route
              .filter((stop: any) => stop.stop_type === 'DELIVERY')
              .map((stop: any) => session.delivery_points.find(p => p.id === stop.client_id))
              .filter(Boolean)
          }));

          const newAffretementReport = optimizationResult.rapport_affretement || [];

          // SAUVEGARDE DANS FIREBASE
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
          
          // LA VRAIE CORRECTION EST ICI : On force la mise à jour immédiate de l'état Zustand
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
        }

      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'optimisation. Veuillez réessayer.");
        setIsProcessing(false);
      }
    } else {
        setIsProcessing(false);
    }
  }

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
            
            {/* Header épuré */}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {isProcessing ? (
                
                // Loader simple et élégant
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="relative mb-6">
                    <Loader2 className="w-16 h-16 text-opti-blue animate-spin" />
                    <MapPin className="w-6 h-6 text-opti-red absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <h4 className="text-xl font-bold text-opti-blue mb-2">Traitement en cours...</h4>
                  <p className="text-slate-500 max-w-xs">Optimisation algorithmique et sauvegarde sécurisée.</p>
                </div>

              ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  
                  {/* Alertes d'adresses non localisées */}
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

                  {/* Rapport d'Affrètement */}
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

                  {/* Routes Optimisées */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result?.clusters.map((cluster) => (
                      <div key={cluster.group_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-sm font-bold text-opti-blue uppercase tracking-wider flex items-center gap-2">
                            Véhicule {String(cluster.group_id).slice(0, 8)}
                          </span>
                          <span className="text-[10px] font-bold bg-white text-slate-500 px-2 py-1 rounded-md border border-slate-200">
                            {cluster.nodes.length} arrêts
                          </span>
                        </div>
                        <div className="p-5 space-y-3 max-h-60 overflow-y-auto">
                          {cluster.nodes.map((node: any) => (
                            <div key={node.id} className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-opti-blue mt-1.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 truncate" title={node.address}>{node.address}</p>
                                <div className="flex gap-2 mt-1">
                                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {node.pallets} palettes
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                    {node.time_window.start} - {node.time_window.end}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
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