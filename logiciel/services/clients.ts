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
import {
  Client,
  ClientConstraints,
  DeliveryWindow,
  TimeSlot,
  Weekday,
  WEEKDAYS,
} from "@/types";

/**
 * Fenêtre de livraison par défaut pour un jour : fermé, aucun créneau.
 */
function defaultWindow(): DeliveryWindow {
  return { open: false, slots: [] };
}

/**
 * Contraintes par défaut (7 jours fermés, aucune restriction).
 * Permet de tolérer les documents Firestore partiels saisis à la main.
 */
export function defaultConstraints(): ClientConstraints {
  const deliveryWindows = {} as Record<Weekday, DeliveryWindow>;
  for (const day of WEEKDAYS) {
    deliveryWindows[day] = defaultWindow();
  }
  return {
    deliveryWindows,
    allowedVehicleTypes: [],
    requiredEquipment: [],
    instructions: "",
  };
}

/**
 * Normalise un tableau de strings venant de Firestore (gère les valeurs nulles/non-array).
 */
function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/**
 * Normalise un créneau horaire.
 */
function normalizeSlot(value: unknown): TimeSlot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const start = typeof v.start === "string" ? v.start : "";
  const end = typeof v.end === "string" ? v.end : "";
  if (!start && !end) return null;
  return { start, end };
}

/**
 * Normalise une fenêtre de livraison (jour) venant de Firestore.
 */
function normalizeWindow(value: unknown): DeliveryWindow {
  if (!value || typeof value !== "object") return defaultWindow();
  const v = value as Record<string, unknown>;
  const slots = Array.isArray(v.slots)
    ? v.slots.map(normalizeSlot).filter((s): s is TimeSlot => s !== null)
    : [];
  return { open: Boolean(v.open), slots };
}

/**
 * Normalise les contraintes d'un client, en complétant les jours manquants.
 */
function normalizeConstraints(value: unknown): ClientConstraints {
  const base = defaultConstraints();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const rawWindows = (v.deliveryWindows ?? {}) as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    base.deliveryWindows[day] = normalizeWindow(rawWindows[day]);
  }

  base.allowedVehicleTypes = normalizeStringArray(v.allowedVehicleTypes);
  base.requiredEquipment = normalizeStringArray(v.requiredEquipment);
  base.instructions = typeof v.instructions === "string" ? v.instructions : "";
  if (typeof v.updatedAt === "string") base.updatedAt = v.updatedAt;

  return base;
}

/**
 * Normalise les données d'un client depuis Firestore pour gérer
 * les documents partiels (saisie manuelle en console).
 */
function normalizeClient(data: Record<string, unknown>, id: string): Client {
  return {
    id,
    name: (data.name as string) || "",
    role: (data.role as string) || "",
    company: (data.company as string) || "",
    email: (data.email as string) || "",
    address: (data.address as string) || "",
    avatarUrl: (data.avatarUrl as string) || undefined,
    subscriptionActive: Boolean(data.subscriptionActive),
    constraints: normalizeConstraints(data.constraints),
  };
}

export const subscribeToClients = (
  onData: (clients: Client[]) => void,
): (() => void) => {
  const q = query(collection(db, "clients"), orderBy("company", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnap) =>
          normalizeClient(docSnap.data() as Record<string, unknown>, docSnap.id),
        ),
      );
    },
    (error) => {
      console.error("Error subscribing to clients:", error);
    },
  );
};

export const getClients = async (): Promise<Client[]> => {
  try {
    const q = query(collection(db, "clients"), orderBy("company", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docSnap) =>
      normalizeClient(docSnap.data() as Record<string, unknown>, docSnap.id),
    );
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
};

export const getClientById = async (id: string): Promise<Client | null> => {
  try {
    const docRef = doc(db, "clients", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return normalizeClient(
        docSnap.data() as Record<string, unknown>,
        docSnap.id,
      );
    }
    return null;
  } catch (error) {
    console.error("Error fetching client:", error);
    return null;
  }
};

export const addClient = async (
  data: Omit<Client, "id">,
): Promise<Client | null> => {
  try {
    const docRef = await addDoc(collection(db, "clients"), data);
    return { id: docRef.id, ...data };
  } catch (error) {
    console.error("Error adding client:", error);
    return null;
  }
};

export const updateClient = async (
  id: string,
  data: Partial<Omit<Client, "id">>,
): Promise<boolean> => {
  try {
    const docRef = doc(db, "clients", id);
    await updateDoc(docRef, data);
    return true;
  } catch (error) {
    console.error("Error updating client:", error);
    return false;
  }
};

export const deleteClient = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, "clients", id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error("Error deleting client:", error);
    return false;
  }
};

/**
 * Met à jour uniquement les contraintes logistiques d'un client,
 * en posant automatiquement la date de dernière modification.
 */
export const updateClientConstraints = async (
  id: string,
  constraints: ClientConstraints,
): Promise<boolean> => {
  const withTimestamp: ClientConstraints = {
    ...constraints,
    updatedAt: new Date().toISOString(),
  };
  return updateClient(id, { constraints: withTimestamp });
};
