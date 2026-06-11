import React, { createContext, useState, useContext, ReactNode } from 'react';

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
