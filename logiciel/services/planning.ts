import { doc, setDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface VehicleTrip {
  vehicle_id: string;
  driver_id: string | null;
  session_id: string; // Lien vers la tournée
  start_time: Date;
  end_time: Date;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

// NOUVEAU : Fonction pour effacer les anciens trajets d'une session avant de la sauvegarder à nouveau
export async function clearSessionTrips(sessionId: string) {
  if (!sessionId) return;
  const q = query(collection(db, "vehicle_trips"), where("session_id", "==", sessionId));
  const snapshot = await getDocs(q);
  
  // On supprime tous les anciens documents liés à cette tournée
  const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "vehicle_trips", d.id)));
  await Promise.all(deletePromises);
}

export async function saveVehicleTrips(trips: VehicleTrip[]) {
  const tripCollection = collection(db, "vehicle_trips");
  for (const trip of trips) {
    const tripRef = doc(tripCollection); // ID auto-généré
    await setDoc(tripRef, {
      ...trip,
      start_time: Timestamp.fromDate(trip.start_time),
      end_time: Timestamp.fromDate(trip.end_time),
      createdAt: Timestamp.now()
    });
  }
}

// Ajout du paramètre "excludeSessionId" pour ignorer les conflits avec la tournée en cours de modification
export async function isVehicleBusy(vehicleId: string, start: Date, end: Date, excludeSessionId?: string): Promise<boolean> {
  const q = query(
    collection(db, "vehicle_trips"),
    where("vehicle_id", "==", vehicleId),
    where("status", "in", ["PLANNED", "IN_PROGRESS"])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.some(docSnap => {
    const data = docSnap.data();
    // On ignore si le conflit vient de la session qu'on est en train d'écraser
    if (excludeSessionId && data.session_id === excludeSessionId) return false;
    
    const tripStart = data.start_time.toDate();
    const tripEnd = data.end_time.toDate();
    return start < tripEnd && end > tripStart;
  });
}

// Ajout du paramètre "excludeSessionId" pour ignorer les conflits avec la tournée en cours de modification
export async function isDriverBusy(driverId: string, start: Date, end: Date, excludeSessionId?: string): Promise<boolean> {
  if (!driverId) return false;
  
  const q = query(
    collection(db, "vehicle_trips"),
    where("driver_id", "==", driverId),
    where("status", "in", ["PLANNED", "IN_PROGRESS"])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.some(docSnap => {
    const data = docSnap.data();
    // On ignore si le conflit vient de la session qu'on est en train d'écraser
    if (excludeSessionId && data.session_id === excludeSessionId) return false;
    
    const tripStart = data.start_time.toDate();
    const tripEnd = data.end_time.toDate();
    return start < tripEnd && end > tripStart;
  });
}