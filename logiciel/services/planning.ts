import { doc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface VehicleTrip {
  vehicle_id: string;
  session_id: string; // Lien vers la tournée
  start_time: Date;
  end_time: Date;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
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

// Fonction pour vérifier si un véhicule est libre sur un créneau [start, end]
export async function isVehicleBusy(vehicleId: string, start: Date, end: Date): Promise<boolean> {
  const q = query(
    collection(db, "vehicle_trips"),
    where("vehicle_id", "==", vehicleId),
    where("status", "in", ["PLANNED", "IN_PROGRESS"])
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.some(doc => {
    const data = doc.data();
    const tripStart = data.start_time.toDate();
    const tripEnd = data.end_time.toDate();
    // Chevauchement : (DébutA < FinB) ET (FinA > DébutB)
    return start < tripEnd && end > tripStart;
  });
}