import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";

export async function getAllVehicles(): Promise<Vehicle[]> {
  try {
    const snapshot = await getDocs(collection(db, "vehicles"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
  } catch (error) {
    console.error("Erreur lors de la récupération des véhicules:", error);
    return [];
  }
}

export interface VehicleType {
  id: string;
  name: string;
  is_active: boolean;
  capacity_palettes: number;
  description?: string;
  plate: string;
}

export interface Specialty {
  id: string;
  name: string;
}

export interface Motorization {
  id: string;
  name: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  dimensions: string;
  motorization: string;
  typeId: string;
  specialty: string;
  capacity_palettes: number;
  inspection_date: Date;
  is_active: boolean;
  unavailability_reason?: string;
}

export const getVehicleTypes = async (): Promise<VehicleType[]> => {
  try {
    const q = query(collection(db, "vehicle_types"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VehicleType));
  } catch (error) {
    console.error("Error fetching vehicle types:", error);
    return [];
  }
};

export const saveVehicleType = async (type: Partial<VehicleType>): Promise<boolean> => {
  try {
    const { id, ...data } = type;
    if (id) {
      await updateDoc(doc(db, "vehicle_types", id), data);
    } else {
      const newDocRef = doc(collection(db, "vehicle_types"));
      await setDoc(newDocRef, data);
    }
    return true;
  } catch (error) {
    console.error("Error saving vehicle type:", error);
    return false;
  }
};

export const deleteVehicleType = async (id: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, "vehicle_types", id));
    return true;
  } catch (error) {
    console.error("Error deleting vehicle type:", error);
    return false;
  }
};

export const getSpecialties = async (): Promise<Specialty[]> => {
  try {
    const q = query(collection(db, "specialties"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Specialty));
  } catch (error) {
    console.error("Error fetching specialties:", error);
    return [];
  }
};

export const saveSpecialty = async (specialty: Partial<Specialty>): Promise<boolean> => {
  try {
    const { id, ...data } = specialty;
    if (id) {
      await updateDoc(doc(db, "specialties", id), data);
    } else {
      const newDocRef = doc(collection(db, "specialties"));
      await setDoc(newDocRef, data);
    }
    return true;
  } catch (error) {
    console.error("Error saving specialty:", error);
    return false;
  }
};

export const deleteSpecialty = async (id: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, "specialties", id));
    return true;
  } catch (error) {
    console.error("Error deleting specialty:", error);
    return false;
  }
};

export const getMotorizations = async (): Promise<Motorization[]> => {
  try {
    const q = query(collection(db, "motorizations"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Motorization));
  } catch (error) {
    console.error("Error fetching motorizations:", error);
    return [];
  }
};

export const saveMotorization = async (motorization: Partial<Motorization>): Promise<boolean> => {
  try {
    const { id, ...data } = motorization;
    if (id) {
      await updateDoc(doc(db, "motorizations", id), data);
    } else {
      const newDocRef = doc(collection(db, "motorizations"));
      await setDoc(newDocRef, data);
    }
    return true;
  } catch (error) {
    console.error("Error saving motorization:", error);
    return false;
  }
};

export const deleteMotorization = async (id: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, "motorizations", id));
    return true;
  } catch (error) {
    console.error("Error deleting motorization:", error);
    return false;
  }
};

export const seedMotorizations = async (): Promise<boolean> => {
  const defaults = ["Diesel", "Essence", "Electrique"];
  try {
    for (const name of defaults) {
      const newDocRef = doc(collection(db, "motorizations"));
      await setDoc(newDocRef, { name });
    }
    return true;
  } catch (error) {
    console.error("Error seeding motorizations:", error);
    return false;
  }
};

export const seedSpecialties = async (): Promise<boolean> => {
  const defaults = [
    "ADR", "HAYON", "GRUE", "CONVOI", "FRIGO", "SAVOYARDE", "SÉCURISÉ", "DOUBLE ÉTAGE"
  ];
  try {
    for (const name of defaults) {
      const newDocRef = doc(collection(db, "specialties"));
      await setDoc(newDocRef, { name });
    }
    return true;
  } catch (error) {
    console.error("Error seeding specialties:", error);
    return false;
  }
};

export const subscribeToVehicles = (onData: (vehicles: Vehicle[]) => void, onError: (err: any) => void) => {
  const q = query(collection(db, "vehicles"));
  
  return onSnapshot(q, 
    (snapshot) => {
      const vehicles = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          inspection_date: data.inspection_date instanceof Timestamp ? data.inspection_date.toDate() : data.inspection_date
        } as Vehicle;
      });
      console.log(`[FleetService] Received ${vehicles.length} vehicles via snapshot`);
      onData(vehicles);
    },
    (error) => {
      console.error("[FleetService] Snapshot error:", error);
      onError(error);
    }
  );
};

export const getVehicles = async (): Promise<Vehicle[]> => {
  // Garder pour la compatibilité mais on va préférer subscribeToVehicles
  try {
    const q = query(collection(db, "vehicles"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        inspection_date: data.inspection_date instanceof Timestamp ? data.inspection_date.toDate() : data.inspection_date
      } as Vehicle;
    });
  } catch (error: any) {
    console.error("[FleetService] Error fetching vehicles:", error);
    return [];
  }
};

export const saveVehicle = async (vehicle: any): Promise<boolean> => {
  try {
    const { id, ...data } = vehicle;
    const vehicleData: any = { ...data };
    
    if (vehicleData.inspection_date instanceof Date) {
      vehicleData.inspection_date = Timestamp.fromDate(vehicleData.inspection_date);
    }

    if (id) {
      await updateDoc(doc(db, "vehicles", id), vehicleData);
    } else {
      const newDocRef = doc(collection(db, "vehicles"));
      await setDoc(newDocRef, vehicleData);
    }
    return true;
  } catch (error) {
    console.error("Error saving vehicle:", error);
    return false;
  }
};

export const checkFutureTours = async (vehicleId: string): Promise<boolean> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const q = query(
      collection(db, "tours"),
      where("vehicleId", "==", vehicleId),
      where("date", ">=", today)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking future tours (probably missing index or collection):", error);
    return false; // On laisse passer en cas d'erreur de base de données (ex: index manquant)
  }
};

export const deleteVehicle = async (vehicleId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, "vehicles", vehicleId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return false;
  }
};

export interface MaintenanceLog {
  id?: string;
  vehicleId: string;
  date: Date;
  type: 'Maintenance' | 'Panne' | 'Avarie' | 'Réactivation' | 'Autre';
  description: string;
  author?: string;
}

export const getMaintenanceLogs = async (vehicleId: string): Promise<MaintenanceLog[]> => {
  try {
    const q = query(
      collection(db, "maintenance_logs"),
      where("vehicleId", "==", vehicleId)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date
      } as MaintenanceLog;
    });
    // Tri manuel par date décroissante (plus récent en haut)
    return logs.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error fetching maintenance logs:", error);
    return [];
  }
};

export const addMaintenanceLog = async (log: Omit<MaintenanceLog, 'id'>): Promise<boolean> => {
  try {
    const logData: any = { ...log };
    if (logData.date instanceof Date) {
      logData.date = Timestamp.fromDate(logData.date);
    }
    const newDocRef = doc(collection(db, "maintenance_logs"));
    await setDoc(newDocRef, logData);
    return true;
  } catch (error) {
    console.error("Error adding maintenance log:", error);
    return false;
  }
};

export const updateMaintenanceLog = async (logId: string, data: Partial<MaintenanceLog>): Promise<boolean> => {
  try {
    const logData: any = { ...data };
    if (logData.date instanceof Date) {
      logData.date = Timestamp.fromDate(logData.date);
    }
    const docRef = doc(db, "maintenance_logs", logId);
    await updateDoc(docRef, logData);
    return true;
  } catch (error) {
    console.error("Error updating maintenance log:", error);
    return false;
  }
};

export const deleteMaintenanceLog = async (logId: string): Promise<boolean> => {
  try {
    const docRef = doc(db, "maintenance_logs", logId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting maintenance log:", error);
    return false;
  }
};
