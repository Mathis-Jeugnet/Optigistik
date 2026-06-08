"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Maximize, Minimize, Calendar, Route, Loader2 } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Import dynamique sans SSR pour Leaflet
const DynamicMap = dynamic(() => import("./DynamicMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-red"></div>
    </div>
  ),
});

export default function MapSection() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // États pour les filtres
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0] // Date du jour par défaut (YYYY-MM-DD)
  );
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Charger les tournées (delivery_sessions) validées pour la date sélectionnée
  useEffect(() => {
    async function fetchSessionsForDate() {
      setIsLoadingSessions(true);
      try {
        const q = query(
          collection(db, "delivery_sessions"),
          where("meta.date", "==", selectedDate),
          where("status", "==", "VALIDATED")
        );
        
        const snapshot = await getDocs(q);
        const fetchedSessions: any[] = [];
        const initialIds: string[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const sessionItem = { id: doc.id, ...data };
          fetchedSessions.push(sessionItem);
          initialIds.push(doc.id); // Par défaut, on coche toutes les tournées trouvées
        });

        setSessions(fetchedSessions);
        setSelectedSessionIds(initialIds);
      } catch (error) {
        console.error("Erreur lors de la récupération des tournées :", error);
      } finally {
        setIsLoadingSessions(false);
      }
    }

    fetchSessionsForDate();
  }, [selectedDate]);

  // Filtrer les sessions à passer à la carte en fonction des cases cochées
  const activeSessionsOnMap = sessions.filter((s) =>
    selectedSessionIds.includes(s.id)
  );

  // Gestion de la multi-sélection des tournées
  const handleToggleSession = (sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const handleSelectAll = () => {
    setSelectedSessionIds(sessions.map((s) => s.id));
  };

  const handleSelectNone = () => {
    setSelectedSessionIds([]);
  };

  return (
    <div className="space-y-4">
      {/* --- BANDEAU DES FILTRES --- */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Filtre de Date */}
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 w-full md:w-auto">
          <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
          <div className="flex flex-col flex-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date d'exploitation</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Filtre des Tournées de la journée */}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Route className="w-4 h-4 text-gray-400" />
              <span>Tournées disponibles ({sessions.length})</span>
              {isLoadingSessions && <Loader2 className="w-3 h-3 animate-spin text-opti-blue" />}
            </div>
            {sessions.length > 0 && (
              <div className="flex gap-2 text-[11px] font-bold text-opti-blue">
                <button onClick={handleSelectAll} className="hover:underline">Toutes</button>
                <span className="text-gray-300">|</span>
                <button onClick={handleSelectNone} className="hover:underline">Aucune</button>
              </div>
            )}
          </div>

          {sessions.length === 0 && !isLoadingSessions ? (
            <p className="text-xs text-gray-400 italic bg-gray-50 p-2.5 rounded-xl border border-dashed border-gray-200">
              Aucune tournée optimisée et validée pour cette date.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-[80px] overflow-y-auto pr-2">
              {sessions.map((sessionItem) => {
                const isChecked = selectedSessionIds.includes(sessionItem.id);
                return (
                  <button
                    key={sessionItem.id}
                    onClick={() => handleToggleSession(sessionItem.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 flex items-center gap-2 ${
                      isChecked
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-gray-200 text-slate-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isChecked ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <span className="truncate max-w-[150px]">
                      {sessionItem.meta?.name || `Tournée #${sessionItem.id.slice(0, 4)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- BLOC CARTOGRAPHIQUE --- */}
      <div 
        className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ${
          isFullScreen 
            ? "fixed inset-0 z-[5000] w-screen h-screen rounded-none border-none" 
            : "rounded-3xl border border-gray-100 h-[500px] relative"
        }`}
      >
        {/* On passe les sessions actives (filtrées) directement au composant de la carte */}
        <DynamicMap isFullScreen={isFullScreen} activeSessions={activeSessionsOnMap} />

        {/* Bouton pour basculer en plein écran */}
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur p-2.5 rounded-lg shadow-sm border border-gray-200 text-gray-700 hover:text-opti-blue hover:bg-white transition-all duration-200"
          title={isFullScreen ? "Réduire" : "Plein écran"}
        >
          {isFullScreen ? (
            <Minimize size={20} className="stroke-2" />
          ) : (
            <Maximize size={20} className="stroke-2" />
          )}
        </button>
      </div>
    </div>
  );
}