
// 1. Configuration (Singleton)
export interface CompanySettings {
  name: string;
  siret: string;
  mapCenter: {
    lat: number;
    lng: number;
  };
}

// 2. Les Ressources
export interface User {
  uid: string;
  email: string;
  role: "ADMIN" | "DISPATCHER" | "DRIVER";
  name: string;
}

export interface Vehicle {
  id: string; 
  licensePlate: string;
  type: "Frigo" | "Semi" | "VUL";
  capacity: number; 
}

// 3. Le Métier (Commandes)
export interface Location {
  address: string;
  lat: number;
  lng: number;
  contactName?: string;
  contactPhone?: string;
}

export interface Order {
  id: string;
  customerName: string;
  status: "PENDING" | "ASSIGNED" | "DONE";
  pickup: Location;
  delivery: Location;
  weight?: number;
}

// 4. L'Optimisation (Tournées)
export interface RouteStep {
  type: "PICKUP" | "DELIVERY";
  orderId: string;
  status: "PENDING" | "DONE" | "FAILED";
  estimatedArrival?: Date;
}

export interface Route {
  id: string;
  date: Date;
  driverId: string;
  vehicleId: string;
  steps: RouteStep[];
  metrics?: {
    totalKm: number;
    totalTimeSeconds: number;
  };
}

// 5. Les Conducteurs
export type DriverRegime = "GRAND_ROUTIER" | "AUTRE_PERSONNEL";
export type DriverStatus = "EN_MISSION" | "DISPONIBLE" | "INDISPONIBLE";

export interface DriverUnavailability {
  id: string;
  type: "CONGES_ANNUELS" | "FORMATION" | "MALADIE" | "AUTRE";
  label: string;
  startDate: string;
  endDate: string;
  approvedBy?: string;
  note?: string;
}

export interface AssignedVehicle {
  vehicleId: string;
  label: string;
  role: "PRINCIPAL" | "REMPLACEMENT";
  isActive: boolean;
  lastMaintenance?: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;

  // Profil contractuel (ticket Jira)
  regime: DriverRegime;
  nightWorkAuthorized: boolean;

  // Infos techniques
  licenseTypes: string[];
  licenseExpiry?: string;
  employeeId: string;
  seniority: string;
  languages: string[];

  // Rattachement
  role: string;

  status: DriverStatus;
  unavailabilities: DriverUnavailability[];
  assignedVehicles: AssignedVehicle[];
}

// 6. Les Clients
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Créneau horaire d'accès, ex. { start: "08:00", end: "12:00" }
export interface TimeSlot {
  start: string;
  end: string;
}

// Fenêtre de livraison pour un jour donné
export interface DeliveryWindow {
  open: boolean; // false => "Fermé"
  slots: TimeSlot[]; // 0..n créneaux
}

// Contraintes logistiques et fenêtres d'accès d'un client
export interface ClientConstraints {
  deliveryWindows: Record<Weekday, DeliveryWindow>;
  allowedVehicleTypes: string[]; // ids de docs vehicle_types autorisés
  requiredEquipment: string[]; // noms/ids issus de specialties
  instructions: string; // notes pour le conducteur
  updatedAt?: string; // ISO, pour "Dernière mise à jour le…"
}

export interface Client {
  id: string;
  name: string; // contact, ex. "Jean Morel"
  role: string; // ex. "CEO", "Responsable logistique"
  company: string; // ex. "TransLogis"
  email: string;
  address: string;
  avatarUrl?: string;
  subscriptionActive: boolean; // badge Actif / Inactif
  constraints: ClientConstraints;
}
