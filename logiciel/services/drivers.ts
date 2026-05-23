import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { Driver } from "@/types";

/**
 * Normalise un champ array de Firestore.
 * Gère plusieurs cas courants d'erreur de saisie dans l'UI Firebase :
 * - Un seul string contenant un JSON array : '["a", "b"]'
 * - Un string simple : "a"
 * - Un vrai array : ["a", "b"]
 */
function normalizeStringArray(value: unknown): string[] {
  if (!value) return [];

  // Si c'est un string simple (pas un array)
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v: unknown) => String(v));
      } catch {
        // fallthrough
      }
    }
    return trimmed ? [trimmed] : [];
  }

  if (!Array.isArray(value)) return [];
  if (value.length === 0) return [];

  // Si le premier (et seul) élément est un string qui ressemble à un JSON array
  if (
    value.length === 1 &&
    typeof value[0] === "string" &&
    value[0].trim().startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(value[0]);
      if (Array.isArray(parsed)) return parsed.map((v: unknown) => String(v));
    } catch {
      // Pas du JSON valide
    }
  }

  return value.map((v) => String(v));
}

/**
 * Normalise les données d'un conducteur depuis Firestore
 * pour gérer les formats de données inconsistants.
 */
function normalizeDriver(data: Record<string, unknown>, id: string): Driver {
  return {
    id,
    firstName: (data.firstName as string) || "",
    lastName: (data.lastName as string) || "",
    email: (data.email as string) || "",
    phone: (data.phone as string) || "",
    avatarUrl: (data.avatarUrl as string) || undefined,
    regime: (data.regime as Driver["regime"]) || "AUTRE_PERSONNEL",
    nightWorkAuthorized: Boolean(data.nightWorkAuthorized),
    licenseTypes: normalizeStringArray(data.licenseTypes),
    licenseExpiry: (data.licenseExpiry as string) || undefined,
    employeeId: (data.employeeId as string) || "",
    seniority: (data.seniority as string) || "",
    languages: normalizeStringArray(data.languages),
    role: (data.role as string) || "",
    status: (data.status as Driver["status"]) || "DISPONIBLE",
    unavailabilities: Array.isArray(data.unavailabilities)
      ? data.unavailabilities
      : [],
    assignedVehicles: Array.isArray(data.assignedVehicles)
      ? data.assignedVehicles
      : [],
  };
}

export const subscribeToDrivers = (
  onData: (drivers: Driver[]) => void,
): (() => void) => {
  const q = query(collection(db, "drivers"), orderBy("lastName", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnap) =>
          normalizeDriver(docSnap.data() as Record<string, unknown>, docSnap.id),
        ),
      );
    },
    (error) => {
      console.error("Error subscribing to drivers:", error);
    },
  );
};

export const getDrivers = async (): Promise<Driver[]> => {
  try {
    const q = query(collection(db, "drivers"), orderBy("lastName", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) =>
      normalizeDriver(
        docSnap.data() as Record<string, unknown>,
        docSnap.id,
      ),
    );
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return [];
  }
};

export const getDriverById = async (id: string): Promise<Driver | null> => {
  try {
    const docRef = doc(db, "drivers", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return normalizeDriver(
        docSnap.data() as Record<string, unknown>,
        docSnap.id,
      );
    }
    return null;
  } catch (error) {
    console.error("Error fetching driver:", error);
    return null;
  }
};

export const updateDriver = async (
  id: string,
  data: Partial<Omit<Driver, "id">>,
): Promise<boolean> => {
  try {
    const docRef = doc(db, "drivers", id);
    await updateDoc(docRef, data);
    return true;
  } catch (error) {
    console.error("Error updating driver:", error);
    return false;
  }
};

export const addDriver = async (
  data: Omit<Driver, "id">,
): Promise<Driver | null> => {
  try {
    const docRef = await addDoc(collection(db, "drivers"), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    return null;
  }
};

export const deleteDriver = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, "drivers", id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting driver:", error);
    return false;
  }
};
