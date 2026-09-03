import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { getApiUrl, fetchWithRetry } from './api';

interface ActiveTourContextType {
  driverId: string | null;
  activeTour: any | null;
  setDriverId: (id: string | null) => void;
  selectTour: (tour: any | null) => void;
  clearSession: () => void;
}

const ActiveTourContext = createContext<ActiveTourContextType | undefined>(undefined);

export function ActiveTourProvider({ children }: { children: ReactNode }) {
  const [driverId, setDriverIdState] = useState<string | null>(null);
  const [activeTour, setActiveTourState] = useState<any | null>(null);

  const setDriverId = (id: string | null) => {
    setDriverIdState(id);
  };

  const selectTour = (tour: any | null) => {
    setActiveTourState(tour);
  };

  const clearSession = () => {
    setDriverIdState(null);
    setActiveTourState(null);
  };

  // ---------------------------------------------------------
  // 🌟 DYNAMIC ROUTING : POLLING EN ARRIÈRE-PLAN
  // ---------------------------------------------------------
  useEffect(() => {
    // On ne lance la vérification que si le chauffeur est en train de faire une tournée
    if (!activeTour || !driverId) return;

    // Récupération de l'ID unique de la tournée en cours
    const currentSessionId = activeTour.id || activeTour.sessionId;

    const pollInterval = setInterval(async () => {
      try {
        const apiUrl = getApiUrl();
        // On interroge ton API existante qui renvoie les tournées du chauffeur
        const { response, data } = await fetchWithRetry(`${apiUrl}/api/driver/tours?driverId=${driverId}`);

        if (response.ok && data.success && data.tours) {
          // On cherche notre tournée actuelle dans les résultats du serveur
          const latestTourData = data.tours.find((t: any) => t.sessionId === currentSessionId);

          if (latestTourData) {
            // Pour éviter que l'écran ne "clignote" toutes les 15 secondes,
            // on compare mathématiquement l'ancienne route et la nouvelle.
            const currentNodesStr = JSON.stringify(activeTour.nodes || []);
            const latestNodesStr = JSON.stringify(latestTourData.nodes || []);

            // S'il y a une différence (ordre changé par le solveur, point ajouté, etc.)
            if (currentNodesStr !== latestNodesStr) {
              console.log('🔄 Mise à jour de la tournée détectée en arrière-plan !');
              
              // On met à jour l'état, ce qui va rafraîchir le JourneyScreen automatiquement
              setActiveTourState((prev: any) => ({
                ...prev,
                ...latestTourData,
                id: currentSessionId // On s'assure de garder la propriété "id" intacte
              }));
            }
          }
        }
      } catch (error) {
        // Erreur silencieuse : si le chauffeur passe dans un tunnel sans réseau,
        // l'application ne plantera pas, elle réessaiera dans 15 secondes.
      }
    }, 15000); // Vérification toutes les 15 secondes

    // Nettoyage de l'intervalle si on quitte la tournée
    return () => clearInterval(pollInterval);
  }, [activeTour, driverId]);
  // ---------------------------------------------------------

  return (
    <ActiveTourContext.Provider
      value={{
        driverId,
        activeTour,
        setDriverId,
        selectTour,
        clearSession,
      }}
    >
      {children}
    </ActiveTourContext.Provider>
  );
}

export function useActiveTour() {
  const context = useContext(ActiveTourContext);
  if (context === undefined) {
    throw new Error('useActiveTour must be used within an ActiveTourProvider');
  }
  return context;
}